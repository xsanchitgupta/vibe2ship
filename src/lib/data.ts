import { supabaseEnabled } from './config';
import * as repo from './repo';
import type { NewIssue } from './repo';
import type { Stats, Hotspot } from './analytics';
import {
  addIssue,
  advanceStatus as memAdvance,
  findNearbyDuplicates as memDuplicates,
  getIssue as memGetIssue,
  getHotspots as memHotspots,
  getLeaderboard as memLeaderboard,
  getStats as memStats,
  listIssues as memList,
  nextIssueId,
  nextWorkOrder,
  verifyIssue as memVerify,
} from './store';
import type {
  Citizen,
  GeoPoint,
  Issue,
  IssueCategory,
  IssueStatus,
} from './types';

export type { NewIssue } from './repo';

interface Filter {
  category?: IssueCategory | 'all';
  status?: IssueStatus | 'all';
  q?: string;
}

const useDb = () => supabaseEnabled();

export async function listIssues(filter: Filter = {}): Promise<Issue[]> {
  return useDb() ? repo.listIssues(filter) : memList(filter);
}

export async function getIssue(id: string): Promise<Issue | undefined> {
  return useDb() ? repo.getIssue(id) : memGetIssue(id);
}

export async function findNearbyDuplicates(
  category: IssueCategory,
  geo: GeoPoint,
  withinM = 450,
  excludeId?: string,
): Promise<{ issue: Issue; distanceM: number }[]> {
  return useDb()
    ? repo.findNearbyDuplicates(category, geo, withinM, excludeId)
    : memDuplicates(category, geo, withinM, excludeId);
}

export async function createIssue(input: NewIssue): Promise<Issue> {
  if (useDb()) return repo.createIssue(input);
  return memCreate(input);
}

export async function verifyIssue(id: string, userId?: string): Promise<Issue | undefined> {
  return useDb() ? repo.verifyIssue(id, userId) : memVerify(id, userId ?? 'You');
}

export async function advanceStatus(
  id: string,
  note?: string,
  actor?: string,
): Promise<Issue | undefined> {
  return useDb() ? repo.advanceStatus(id, note, actor) : memAdvance(id, note);
}

export async function setStatus(
  id: string,
  status: IssueStatus,
  note?: string,
  actor?: string,
): Promise<Issue | undefined> {
  if (useDb()) return repo.setStatus(id, status, note, actor);
  const issue = memGetIssue(id);
  if (!issue) return undefined;
  issue.status = status;
  issue.updatedAt = new Date().toISOString();
  issue.timeline.push({
    status,
    note: note ?? `Status set to ${status}.`,
    actor: actor ?? issue.department,
    at: issue.updatedAt,
  });
  return issue;
}

export async function resolveWithProof(
  id: string,
  proof: { afterImageUrl?: string; verified: boolean; confidence: number; note: string },
  actor = 'Authority',
): Promise<Issue | undefined> {
  if (useDb()) return repo.resolveWithProof(id, proof, actor);
  const issue = memGetIssue(id);
  if (!issue) return undefined;
  const now = new Date().toISOString();
  issue.status = 'Resolved';
  issue.updatedAt = now;
  issue.afterImageUrl = proof.afterImageUrl;
  issue.resolutionVerified = proof.verified;
  issue.resolutionConfidence = proof.confidence;
  issue.resolutionNote = proof.note;
  issue.timeline.push({ status: 'Resolved', note: proof.note, actor, at: now });
  return issue;
}

export async function escalateOverdue(): Promise<number> {
  if (useDb()) return repo.escalateOverdue();
  const now = Date.now();
  let count = 0;
  for (const i of memList()) {
    if (i.status === 'Resolved' || i.escalated) continue;
    if (now > new Date(i.createdAt).getTime() + i.slaHours * 3600_000) {
      i.escalated = true;
      i.priority = Math.min(100, i.priority + 15);
      i.updatedAt = new Date().toISOString();
      i.timeline.push({
        status: i.status,
        note: 'Auto-escalated: SLA breached — priority raised.',
        actor: 'System',
        at: i.updatedAt,
      });
      count++;
    }
  }
  return count;
}

export async function getStats(): Promise<Stats> {
  return useDb() ? repo.getStats() : (memStats() as Stats);
}

export async function getHotspots(): Promise<Hotspot[]> {
  return useDb() ? repo.getHotspots() : (memHotspots() as Hotspot[]);
}

export async function getLeaderboard(): Promise<Citizen[]> {
  return useDb() ? repo.getLeaderboard() : memLeaderboard();
}

// ----- in-memory createIssue (fallback) ------------------------------------
function memCreate(input: NewIssue): Issue {
  const now = new Date().toISOString();
  const id = nextIssueId();
  const issue: Issue = {
    id,
    ref: id,
    title: input.title,
    description: input.description,
    category: input.category,
    severity: input.severity,
    status: input.status,
    priority: input.priority,
    confidence: input.confidence,
    safetyRisk: input.safetyRisk,
    tags: input.tags,
    location: input.location,
    geo: input.geo,
    department: input.department,
    slaHours: input.slaHours,
    workOrderId: nextWorkOrder(),
    advisory: input.advisory,
    imageDataUrl: input.imageUrl,
    reporter: input.reporter,
    verifications: input.verifications ?? 1,
    duplicateOf: input.duplicateOf,
    createdAt: now,
    updatedAt: now,
    timeline: [
      {
        status: 'Reported',
        note: `Filed by ${input.reporter} and triaged by the AI agent. ${input.recommendedAction ?? ''}`.trim(),
        actor: 'Triage Agent',
        at: now,
      },
    ],
  };
  addIssue(issue);
  return issue;
}
