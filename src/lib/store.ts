import type {
  Citizen,
  GeoPoint,
  Issue,
  IssueCategory,
  IssueStatus,
  Severity,
} from './types';
import { reportPoints } from './departments';
import { haversine } from './geo';

// ---------------------------------------------------------------------------
// Single shared in-memory store. Pinned to globalThis so Next.js HMR (and the
// route handlers that each import this module) all read the same data within a
// running instance. Swap these functions for Firestore/Cloud SQL to persist
// across instances — the surface stays identical.
// ---------------------------------------------------------------------------

interface DB {
  issues: Issue[];
  citizens: Citizen[];
  seq: number;
  wo: number;
}

const g = globalThis as unknown as { __communityHeroDB?: DB };

function init(): DB {
  // Start empty — no seeded/demo data. Real reports fill it in.
  return { issues: [], citizens: [], seq: 1000, wo: 5200 };
}

function db(): DB {
  if (!g.__communityHeroDB) g.__communityHeroDB = init();
  return g.__communityHeroDB;
}

// ----- reads ---------------------------------------------------------------

export interface IssueFilter {
  category?: IssueCategory | 'all';
  status?: IssueStatus | 'all';
  q?: string;
}

export function listIssues(filter: IssueFilter = {}): Issue[] {
  let rows = [...db().issues];
  if (filter.category && filter.category !== 'all')
    rows = rows.filter((i) => i.category === filter.category);
  if (filter.status && filter.status !== 'all')
    rows = rows.filter((i) => i.status === filter.status);
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

export function getIssue(id: string): Issue | undefined {
  return db().issues.find((i) => i.id === id);
}

/** Same-category open issues near a point — the agent's dedup signal. */
export function findNearbyDuplicates(
  category: IssueCategory,
  geo: GeoPoint,
  withinM = 450,
  excludeId?: string,
): { issue: Issue; distanceM: number }[] {
  return db()
    .issues.filter(
      (i) =>
        i.id !== excludeId &&
        i.category === category &&
        i.status !== 'Resolved',
    )
    .map((issue) => ({ issue, distanceM: haversine(geo, issue.geo) }))
    .filter((r) => r.distanceM <= withinM)
    .sort((a, b) => a.distanceM - b.distanceM);
}

// ----- writes --------------------------------------------------------------

export function nextWorkOrder(): string {
  const d = db();
  d.wo += 9;
  return `WO-${d.wo}`;
}

export function nextIssueId(): string {
  const d = db();
  d.seq += 1;
  return `CH-${d.seq}`;
}

export function addIssue(issue: Issue): Issue {
  db().issues.unshift(issue);
  // credit the reporter
  awardReport(issue.reporter, issue.severity);
  return issue;
}

export function verifyIssue(id: string, by = 'You'): Issue | undefined {
  const issue = getIssue(id);
  if (!issue) return undefined;
  issue.verifications += 1;
  issue.updatedAt = new Date().toISOString();
  // upgrade priority slightly as community confirms impact
  issue.priority = Math.min(100, issue.priority + 2);
  awardVerification(by);
  return issue;
}

const STATUS_ORDER: IssueStatus[] = [
  'Reported',
  'Acknowledged',
  'In Progress',
  'Resolved',
];

export function advanceStatus(id: string, note?: string): Issue | undefined {
  const issue = getIssue(id);
  if (!issue) return undefined;
  const idx = STATUS_ORDER.indexOf(issue.status);
  if (idx >= STATUS_ORDER.length - 1) return issue;
  const next = STATUS_ORDER[idx + 1];
  issue.status = next;
  const at = new Date().toISOString();
  issue.updatedAt = at;
  issue.timeline.push({
    status: next,
    note: note ?? `Status moved to ${next} by ${issue.department}.`,
    actor: issue.department,
    at,
  });
  if (next === 'Resolved') {
    const c = db().citizens.find((x) => x.name === issue.reporter);
    if (c) {
      c.resolvedImpact += 1;
      c.points += 15;
    }
  }
  return issue;
}

function citizen(name: string): Citizen {
  const d = db();
  let c = d.citizens.find((x) => x.name === name);
  if (!c) {
    c = {
      id: `u${d.citizens.length + 1}`,
      name,
      avatar: '🧑',
      points: 0,
      reports: 0,
      verifications: 0,
      resolvedImpact: 0,
    };
    d.citizens.push(c);
  }
  return c;
}

function awardReport(name: string, severity: Severity) {
  const c = citizen(name);
  c.reports += 1;
  c.points += reportPoints(severity);
}

function awardVerification(name: string) {
  const c = citizen(name);
  c.verifications += 1;
  c.points += 5;
}

// ----- analytics -----------------------------------------------------------

export function getStats() {
  const issues = db().issues;
  const byStatus = countBy(issues, (i) => i.status);
  const bySeverity = countBy(issues, (i) => i.severity);
  const byCategory = countBy(issues, (i) => i.category);

  const resolved = issues.filter((i) => i.status === 'Resolved');
  const avgResolutionH = resolved.length
    ? Math.round(
        resolved.reduce(
          (s, i) =>
            s +
            (new Date(i.updatedAt).getTime() - new Date(i.createdAt).getTime()) /
              3600_000,
          0,
        ) / resolved.length,
      )
    : 0;

  // 7-day trend of reports
  const trend: { day: string; count: number }[] = [];
  for (let d = 6; d >= 0; d--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - d);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const count = issues.filter((i) => {
      const t = new Date(i.createdAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    }).length;
    trend.push({
      day: start.toLocaleDateString('en-US', { weekday: 'short' }),
      count,
    });
  }

  return {
    total: issues.length,
    open: issues.filter((i) => i.status !== 'Resolved').length,
    critical: issues.filter((i) => i.severity === 'Critical').length,
    pending: (byStatus['Reported'] ?? 0) + (byStatus['Acknowledged'] ?? 0),
    inProgress: byStatus['In Progress'] ?? 0,
    resolved: resolved.length,
    verifications: issues.reduce((s, i) => s + i.verifications, 0),
    avgResolutionH,
    byStatus,
    bySeverity,
    byCategory,
    trend,
  };
}

export interface Hotspot {
  area: string;
  count: number;
  topCategory: IssueCategory;
  maxSeverity: Severity;
  openCount: number;
  geo: GeoPoint;
}

export function getHotspots(): Hotspot[] {
  const groups = new Map<string, Issue[]>();
  for (const i of db().issues) {
    const area = i.location.split(',')[0].trim();
    const arr = groups.get(area) ?? [];
    arr.push(i);
    groups.set(area, arr);
  }
  const sevRank: Record<Severity, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };
  return [...groups.entries()]
    .map(([area, arr]) => {
      const cat = countBy(arr, (i) => i.category);
      const topCategory = Object.entries(cat).sort(
        (a, b) => b[1] - a[1],
      )[0][0] as IssueCategory;
      const maxSeverity = arr
        .map((i) => i.severity)
        .sort((a, b) => sevRank[b] - sevRank[a])[0];
      return {
        area,
        count: arr.length,
        topCategory,
        maxSeverity,
        openCount: arr.filter((i) => i.status !== 'Resolved').length,
        geo: arr[0].geo,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function getLeaderboard(): Citizen[] {
  return [...db().citizens].sort((a, b) => b.points - a.points);
}

function countBy<T, K extends string>(arr: T[], key: (t: T) => K): Record<K, number> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<K, number>);
}
