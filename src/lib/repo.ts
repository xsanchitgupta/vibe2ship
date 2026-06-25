import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './supabase/server';
import { computeHotspots, computeStats, type Hotspot, type Stats } from './analytics';
import { haversine } from './geo';
import { reportPoints } from './departments';
import { seedIssues } from './seed';
import type {
  Citizen,
  GeoPoint,
  Issue,
  IssueCategory,
  IssueStatus,
  Severity,
  StatusEvent,
} from './types';

export interface NewIssue {
  title: string;
  description: string;
  category: IssueCategory;
  severity: Severity;
  status: IssueStatus;
  priority: number;
  confidence: number;
  safetyRisk: string;
  tags: string[];
  location: string;
  geo: GeoPoint;
  department: string;
  slaHours: number;
  advisory: string;
  imageUrl?: string;
  reporter: string;
  reporterId?: string | null;
  duplicateOf?: string;
  verifications?: number;
  recommendedAction?: string;
}

interface IssueRow {
  id: string;
  ref: string;
  title: string;
  description: string;
  category: IssueCategory;
  severity: Severity;
  status: IssueStatus;
  priority: number;
  confidence: number;
  safety_risk: string;
  tags: string[];
  location: string;
  lat: number | null;
  lng: number | null;
  department: string;
  sla_hours: number;
  work_order_id: string | null;
  advisory: string;
  image_url: string | null;
  reporter_id: string | null;
  reporter_name: string;
  verifications: number;
  duplicate_of: string | null;
  after_image_url?: string | null;
  resolution_verified?: boolean | null;
  resolution_confidence?: number | null;
  resolution_note?: string | null;
  escalated?: boolean | null;
  created_at: string;
  updated_at: string;
}

let admin: SupabaseClient | null | undefined;
function db(): SupabaseClient {
  if (admin === undefined) admin = createServiceClient();
  if (!admin) throw new Error('Supabase service client unavailable');
  return admin;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rowToIssue(r: IssueRow, timeline: StatusEvent[] = []): Issue {
  return {
    id: r.id,
    ref: r.ref,
    title: r.title,
    description: r.description,
    category: r.category,
    severity: r.severity,
    status: r.status,
    priority: r.priority,
    confidence: Number(r.confidence),
    safetyRisk: r.safety_risk,
    tags: r.tags ?? [],
    location: r.location,
    geo: { lat: r.lat ?? 0, lng: r.lng ?? 0 },
    department: r.department,
    slaHours: r.sla_hours,
    workOrderId: r.work_order_id ?? '',
    advisory: r.advisory,
    imageDataUrl: r.image_url ?? undefined,
    reporter: r.reporter_name,
    verifications: r.verifications,
    duplicateOf: r.duplicate_of ?? undefined,
    afterImageUrl: r.after_image_url ?? undefined,
    resolutionVerified: r.resolution_verified ?? undefined,
    resolutionConfidence: r.resolution_confidence ?? undefined,
    resolutionNote: r.resolution_note ?? undefined,
    escalated: r.escalated ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    timeline,
  };
}

async function issueCount(): Promise<number> {
  const { count } = await db().from('issues').select('id', { count: 'exact', head: true });
  return count ?? 0;
}

// ----- lazy seed (runs once per process) -----------------------------------
let seedPromise: Promise<void> | null = null;
function ensureSeed(): Promise<void> {
  if (!seedPromise) seedPromise = doSeed();
  return seedPromise;
}
async function doSeed(): Promise<void> {
  try {
    if ((await issueCount()) >= 16) return;
    const seeds = seedIssues();
    const rows = seeds.map((s) => ({
      ref: s.id, // seed ids (CH-10xx) become refs
      title: s.title,
      description: s.description,
      category: s.category,
      severity: s.severity,
      status: s.status,
      priority: s.priority,
      confidence: s.confidence,
      safety_risk: s.safetyRisk,
      tags: s.tags,
      location: s.location,
      lat: s.geo.lat,
      lng: s.geo.lng,
      department: s.department,
      sla_hours: s.slaHours,
      work_order_id: s.workOrderId,
      advisory: s.advisory,
      reporter_name: s.reporter,
      verifications: s.verifications,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    }));
    const { data: inserted } = await db()
      .from('issues')
      .upsert(rows, { onConflict: 'ref', ignoreDuplicates: true })
      .select('id, ref');
    if (inserted?.length) {
      const byRef = new Map(seeds.map((s) => [s.id, s]));
      const events = inserted.flatMap((row: { id: string; ref: string }) => {
        const s = byRef.get(row.ref);
        return (s?.timeline ?? []).map((ev) => ({
          issue_id: row.id,
          status: ev.status,
          note: ev.note,
          actor: ev.actor,
          at: ev.at,
        }));
      });
      if (events.length) await db().from('timeline_events').insert(events);
    }
  } catch (err) {
    console.error('supabase seed failed', err);
  }
}

// ----- reads ----------------------------------------------------------------
export async function listIssues(filter: {
  category?: IssueCategory | 'all';
  status?: IssueStatus | 'all';
  q?: string;
} = {}): Promise<Issue[]> {
  await ensureSeed();
  let query = db().from('issues').select('*');
  if (filter.category && filter.category !== 'all') query = query.eq('category', filter.category);
  if (filter.status && filter.status !== 'all') query = query.eq('status', filter.status);
  const { data } = await query;
  let rows = (data ?? []).map((r) => rowToIssue(r as IssueRow));
  if (filter.q) {
    const q = filter.q.toLowerCase();
    rows = rows.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        i.tags.some((t) => t.includes(q)),
    );
  }
  return rows.sort(
    (a, b) =>
      b.priority - a.priority ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function getIssue(id: string): Promise<Issue | undefined> {
  await ensureSeed();
  const col = UUID_RE.test(id) ? 'id' : 'ref';
  const { data } = await db().from('issues').select('*').eq(col, id).maybeSingle();
  if (!data) return undefined;
  const row = data as IssueRow;
  const { data: tl } = await db()
    .from('timeline_events')
    .select('*')
    .eq('issue_id', row.id)
    .order('at', { ascending: true });
  const timeline: StatusEvent[] = (tl ?? []).map((e: { status: IssueStatus; note: string; actor: string; at: string }) => ({
    status: e.status,
    note: e.note,
    actor: e.actor,
    at: e.at,
  }));
  return rowToIssue(row, timeline);
}

export async function findNearbyDuplicates(
  category: IssueCategory,
  geo: GeoPoint,
  withinM = 450,
  excludeId?: string,
): Promise<{ issue: Issue; distanceM: number }[]> {
  const { data } = await db()
    .from('issues')
    .select('*')
    .eq('category', category)
    .neq('status', 'Resolved');
  return (data ?? [])
    .map((r) => rowToIssue(r as IssueRow))
    .filter((i) => i.id !== excludeId)
    .map((issue) => ({ issue, distanceM: haversine(geo, issue.geo) }))
    .filter((r) => r.distanceM <= withinM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

export async function getStats(): Promise<Stats> {
  await ensureSeed();
  const { data } = await db().from('issues').select('*');
  return computeStats((data ?? []).map((r) => rowToIssue(r as IssueRow)));
}

export async function getHotspots(): Promise<Hotspot[]> {
  await ensureSeed();
  const { data } = await db().from('issues').select('*');
  return computeHotspots((data ?? []).map((r) => rowToIssue(r as IssueRow)));
}

// ----- writes ---------------------------------------------------------------
export async function createIssue(input: NewIssue): Promise<Issue> {
  const count = await issueCount();
  const ref = `CH-${1000 + count + 1}`;
  const workOrderId = `WO-${5200 + count * 9}`;
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from('issues')
    .insert({
      ref,
      title: input.title,
      description: input.description,
      category: input.category,
      severity: input.severity,
      status: input.status,
      priority: input.priority,
      confidence: input.confidence,
      safety_risk: input.safetyRisk,
      tags: input.tags,
      location: input.location,
      lat: input.geo.lat,
      lng: input.geo.lng,
      department: input.department,
      sla_hours: input.slaHours,
      work_order_id: workOrderId,
      advisory: input.advisory,
      image_url: input.imageUrl ?? null,
      reporter_id: input.reporterId ?? null,
      reporter_name: input.reporter,
      verifications: input.verifications ?? 1,
      duplicate_of: input.duplicateOf ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'insert failed');
  const row = data as IssueRow;
  const event: StatusEvent = {
    status: 'Reported',
    note: `Filed by ${input.reporter} and triaged by the AI agent. ${input.recommendedAction ?? ''}`.trim(),
    actor: 'Triage Agent',
    at: now,
  };
  await db().from('timeline_events').insert({ issue_id: row.id, ...event });
  return rowToIssue(row, [event]);
}

export async function verifyIssue(id: string, userId?: string): Promise<Issue | undefined> {
  const issue = await getIssue(id);
  if (!issue) return undefined;
  if (userId) {
    // trigger handles count + points; ignore duplicate-verify unique violations
    await db().from('verifications').insert({ issue_id: issue.id, user_id: userId });
  } else {
    await db()
      .from('issues')
      .update({ verifications: issue.verifications + 1, priority: Math.min(100, issue.priority + 2) })
      .eq('id', issue.id);
  }
  return getIssue(issue.id);
}

const STATUS_ORDER: IssueStatus[] = ['Reported', 'Acknowledged', 'In Progress', 'Resolved'];

export async function advanceStatus(
  id: string,
  note?: string,
  actor?: string,
): Promise<Issue | undefined> {
  const issue = await getIssue(id);
  if (!issue) return undefined;
  const idx = STATUS_ORDER.indexOf(issue.status);
  if (idx >= STATUS_ORDER.length - 1) return issue;
  const next = STATUS_ORDER[idx + 1];
  const now = new Date().toISOString();
  await db().from('issues').update({ status: next, updated_at: now }).eq('id', issue.id);
  await db().from('timeline_events').insert({
    issue_id: issue.id,
    status: next,
    note: note ?? `Status moved to ${next} by ${issue.department}.`,
    actor: actor ?? issue.department,
    at: now,
  });
  return getIssue(issue.id);
}

export async function setStatus(
  id: string,
  status: IssueStatus,
  note?: string,
  actor?: string,
): Promise<Issue | undefined> {
  const issue = await getIssue(id);
  if (!issue) return undefined;
  const now = new Date().toISOString();
  await db().from('issues').update({ status, updated_at: now }).eq('id', issue.id);
  await db().from('timeline_events').insert({
    issue_id: issue.id,
    status,
    note: note ?? `Status set to ${status}.`,
    actor: actor ?? issue.department,
    at: now,
  });
  return getIssue(issue.id);
}

export async function resolveWithProof(
  id: string,
  proof: { afterImageUrl?: string; verified: boolean; confidence: number; note: string },
  actor = 'Authority',
): Promise<Issue | undefined> {
  const issue = await getIssue(id);
  if (!issue) return undefined;
  const now = new Date().toISOString();
  const { error } = await db()
    .from('issues')
    .update({
      status: 'Resolved',
      updated_at: now,
      after_image_url: proof.afterImageUrl ?? null,
      resolution_verified: proof.verified,
      resolution_confidence: proof.confidence,
      resolution_note: proof.note,
    })
    .eq('id', issue.id);
  if (error) {
    // columns may not exist yet (run migration 0002_resolution.sql) — fall back
    console.error('resolveWithProof: proof columns missing, status-only fallback —', error.message);
    await db().from('issues').update({ status: 'Resolved', updated_at: now }).eq('id', issue.id);
  }
  await db().from('timeline_events').insert({
    issue_id: issue.id,
    status: 'Resolved',
    note: proof.verified
      ? `Resolved with AI-verified proof (${Math.round(proof.confidence * 100)}% confidence). ${proof.note}`
      : `Marked resolved — AI flagged the proof photo: ${proof.note}`,
    actor,
    at: now,
  });
  return getIssue(issue.id);
}

export interface Comment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export async function getComments(issueId: string): Promise<Comment[]> {
  try {
    const { data, error } = await db()
      .from('comments')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return (data ?? []).map((c: { id: string; author_name: string; body: string; created_at: string }) => ({
      id: c.id,
      authorName: c.author_name,
      body: c.body,
      createdAt: c.created_at,
    }));
  } catch {
    return [];
  }
}

export async function addComment(
  issueId: string,
  userId: string,
  authorName: string,
  body: string,
): Promise<Comment | undefined> {
  const { data, error } = await db()
    .from('comments')
    .insert({ issue_id: issueId, user_id: userId, author_name: authorName, body })
    .select()
    .single();
  if (error || !data) return undefined;
  return { id: data.id, authorName: data.author_name, body: data.body, createdAt: data.created_at };
}

// Auto-escalate open issues that have breached their SLA. Idempotent (uses the
// `escalated` flag; falls back to a timeline-note check before the migration).
export async function escalateOverdue(): Promise<number> {
  const { data } = await db().from('issues').select('*').neq('status', 'Resolved');
  const rows = (data ?? []) as IssueRow[];
  const now = Date.now();
  let count = 0;
  for (const r of rows) {
    const overdue = now > new Date(r.created_at).getTime() + r.sla_hours * 3600_000;
    if (!overdue || r.escalated) continue;
    const at = new Date().toISOString();
    const newPriority = Math.min(100, r.priority + 15);
    const { error } = await db()
      .from('issues')
      .update({ escalated: true, priority: newPriority, updated_at: at })
      .eq('id', r.id);
    if (error) {
      // `escalated` column not migrated yet — guard idempotency via the timeline
      const { data: tl } = await db()
        .from('timeline_events')
        .select('id')
        .eq('issue_id', r.id)
        .ilike('note', 'Auto-escalated%')
        .limit(1);
      if (tl && tl.length) continue;
      await db().from('issues').update({ priority: newPriority, updated_at: at }).eq('id', r.id);
    }
    await db().from('timeline_events').insert({
      issue_id: r.id,
      status: r.status,
      note: 'Auto-escalated: SLA breached — priority raised.',
      actor: 'System',
      at,
    });
    count++;
  }
  return count;
}

// ----- leaderboard ----------------------------------------------------------
const SYNTH_AVATARS = ['🧑', '👩‍🔧', '🧑‍💼', '👩‍⚕️', '🧑‍🌾', '👨‍🚒', '🧑‍🎓', '👩‍💻'];

export async function getLeaderboard(): Promise<Citizen[]> {
  await ensureSeed();
  const [{ data: profiles }, { data: issues }] = await Promise.all([
    db().from('profiles').select('*'),
    db().from('issues').select('reporter_id, reporter_name, severity, status'),
  ]);

  const byName = new Map<string, Citizen>();
  (profiles ?? []).forEach((p: { id: string; name: string; avatar: string; points: number; reports: number; verifications: number; resolved_impact: number }) => {
    byName.set(p.name, {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      points: p.points,
      reports: p.reports,
      verifications: p.verifications,
      resolvedImpact: p.resolved_impact,
    });
  });

  // synthesize citizens for seeded reporters that have no real account
  (issues ?? []).forEach((i: { reporter_id: string | null; reporter_name: string; severity: Severity; status: IssueStatus }) => {
    if (i.reporter_id) return; // already counted via their profile triggers
    let c = byName.get(i.reporter_name);
    if (!c) {
      c = {
        id: `seed-${i.reporter_name}`,
        name: i.reporter_name,
        avatar: SYNTH_AVATARS[i.reporter_name.length % SYNTH_AVATARS.length],
        points: 0,
        reports: 0,
        verifications: 0,
        resolvedImpact: 0,
      };
      byName.set(i.reporter_name, c);
    }
    c.reports += 1;
    c.points += reportPoints(i.severity);
    if (i.status === 'Resolved') {
      c.resolvedImpact += 1;
      c.points += 15;
    }
  });

  const list = [...byName.values()];
  list.forEach((c) => {
    if (c.id.startsWith('seed-')) {
      c.verifications = Math.round(c.reports * 2.5);
      c.points += c.verifications * 5;
    }
  });
  return list.sort((a, b) => b.points - a.points);
}

// ----- per-user activity (profile page) ------------------------------------
export async function getMyReports(userId: string): Promise<Issue[]> {
  const { data } = await db()
    .from('issues')
    .select('*')
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((r) => rowToIssue(r as IssueRow));
}

export async function getMyVerifications(userId: string): Promise<Issue[]> {
  const { data } = await db().from('verifications').select('issue_id').eq('user_id', userId);
  const ids = (data ?? []).map((v: { issue_id: string }) => v.issue_id);
  if (!ids.length) return [];
  const { data: issues } = await db().from('issues').select('*').in('id', ids);
  return (issues ?? []).map((r) => rowToIssue(r as IssueRow));
}

export async function getMyRank(userId: string): Promise<number> {
  const board = await getLeaderboard();
  const idx = board.findIndex((c) => c.id === userId);
  return idx === -1 ? board.length + 1 : idx + 1;
}

export interface ActivityItem {
  issueId: string;
  ref?: string;
  title: string;
  status: string;
  note: string;
  at: string;
}

/** Status updates on the issues this user reported — feeds the notification bell. */
export async function getMyActivity(userId: string): Promise<ActivityItem[]> {
  const reports = await getMyReports(userId);
  if (!reports.length) return [];
  const byId = new Map(reports.map((r) => [r.id, r]));
  const { data } = await db()
    .from('timeline_events')
    .select('*')
    .in('issue_id', [...byId.keys()])
    .neq('status', 'Reported')
    .order('at', { ascending: false })
    .limit(25);
  return (data ?? []).map((e: { issue_id: string; status: string; note: string; at: string }) => {
    const iss = byId.get(e.issue_id);
    return {
      issueId: e.issue_id,
      ref: iss?.ref,
      title: iss?.title ?? 'Your report',
      status: e.status,
      note: e.note,
      at: e.at,
    };
  });
}
