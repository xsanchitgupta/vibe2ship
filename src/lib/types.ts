// Core domain types for Community Hero — the hyperlocal problem solver.

export type IssueCategory =
  | 'Pothole'
  | 'Streetlight'
  | 'Water Leak'
  | 'Garbage'
  | 'Drainage'
  | 'Tree / Hazard'
  | 'Traffic Signal'
  | 'Stray Animals'
  | 'Public Toilet'
  | 'Encroachment'
  | 'Other';

export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export type IssueStatus =
  | 'Reported'
  | 'Acknowledged'
  | 'In Progress'
  | 'Resolved';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface StatusEvent {
  status: IssueStatus;
  note: string;
  at: string; // ISO timestamp
  actor: string; // who moved it (Agent, Citizen, Dept)
}

export interface Issue {
  id: string;
  /** human-friendly reference code (e.g. CH-1042); falls back to id in memory mode. */
  ref?: string;
  title: string;
  description: string;
  category: IssueCategory;
  severity: Severity;
  status: IssueStatus;
  /** AI-assigned 0-100 priority score combining severity, duplicates, risk. */
  priority: number;
  /** Confidence (0-1) of the AI vision classification. */
  confidence: number;
  /** Short risk note from the safety assessment. */
  safetyRisk: string;
  tags: string[];
  location: string;
  geo: GeoPoint;
  department: string;
  /** Service-level target in hours. */
  slaHours: number;
  /** Official work-order reference filed by the agent. */
  workOrderId: string;
  /** Citizen-facing advisory drafted by the agent. */
  advisory: string;
  imageDataUrl?: string;
  /** "After" photo uploaded by the authority on resolution. */
  afterImageUrl?: string;
  /** Gemini Vision verdict on whether the after-photo proves a genuine fix. */
  resolutionVerified?: boolean;
  resolutionConfidence?: number;
  resolutionNote?: string;
  reporter: string;
  verifications: number;
  /** auto-escalated because it breached its SLA while still open. */
  escalated?: boolean;
  /** ids of issues the agent flagged as likely duplicates. */
  duplicateOf?: string;
  createdAt: string;
  updatedAt: string;
  timeline: StatusEvent[];
}

export interface Department {
  key: IssueCategory;
  name: string;
  slaHours: number;
  contact: string;
  escalation: string;
}

export interface Citizen {
  id: string;
  name: string;
  avatar: string; // emoji
  points: number;
  reports: number;
  verifications: number;
  resolvedImpact: number;
}

/** A single observable step the triage agent emits while it works. */
export interface AgentStep {
  id: string;
  /** lucide-react icon name rendered on the client. */
  icon: string;
  title: string;
  detail: string;
  status: 'running' | 'done';
  /** optional tool name when this step is a tool call. */
  tool?: string;
  data?: Record<string, unknown>;
  at: string;
}

export interface TriageResult {
  issue: Issue;
  steps: AgentStep[];
  duplicate?: { id: string; title: string; distanceM: number };
}

export interface Insight {
  type: 'hotspot' | 'prediction' | 'recommendation' | 'trend';
  title: string;
  detail: string;
  severity: Severity;
  area?: string;
}
