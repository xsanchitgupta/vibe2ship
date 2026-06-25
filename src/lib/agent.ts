import { Type, FunctionCallingConfigMode } from '@google/genai';
import type { Content, FunctionDeclaration, Part } from '@google/genai';
import { gemini, genContent, hasGemini, MODEL, parseJson } from './gemini';
import { CATEGORIES, DEPARTMENTS, computePriority } from './departments';
import { createIssue, findNearbyDuplicates } from './data';
import { cosine, embedMany } from './embeddings';
import type {
  AgentStep,
  GeoPoint,
  Issue,
  IssueCategory,
  Severity,
} from './types';

export interface TriageInput {
  imageBase64?: string;
  mimeType?: string;
  imageDataUrl?: string;
  imageUrl?: string;
  location: string;
  geo: GeoPoint;
  notes?: string;
  reporter?: string;
  reporterId?: string | null;
  /** Language for the citizen-facing text (e.g. "English", "Hindi"). */
  language?: string;
}

export type AgentEvent =
  | { type: 'step'; step: AgentStep }
  | { type: 'result'; issue: Issue; warning?: string };

interface VisionResult {
  isCivicIssue: boolean;
  category: IssueCategory;
  severity: Severity;
  title: string;
  description: string;
  tags: string[];
  safetyRisk: string;
  confidence: number;
}

let stepSeq = 0;
function step(
  icon: string,
  title: string,
  detail: string,
  status: 'running' | 'done',
  extra: Partial<AgentStep> = {},
): AgentStep {
  return {
    id: `s${++stepSeq}`,
    icon,
    title,
    detail,
    status,
    at: new Date().toISOString(),
    ...extra,
  };
}

const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

// ----- Gemini Vision: classify the photo --------------------------------------

const VISION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isCivicIssue: { type: Type.BOOLEAN },
    category: { type: Type.STRING, enum: CATEGORIES as string[] },
    severity: { type: Type.STRING, enum: SEVERITIES as string[] },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    safetyRisk: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
  },
  required: [
    'isCivicIssue',
    'category',
    'severity',
    'title',
    'description',
    'tags',
    'safetyRisk',
    'confidence',
  ],
};

async function analyzePhoto(input: TriageInput): Promise<VisionResult> {
  const fallback: VisionResult = heuristicVision(input);
  if (!hasGemini() || !input.imageBase64) return fallback;

  const prompt = `You are a municipal infrastructure inspector for the city.
Analyse the citizen-submitted photo and classify the community issue.
Context provided by the reporter: location="${input.location}", notes="${
    input.notes ?? 'none'
  }".
- Pick the single best category from the allowed list.
- Severity reflects danger to people and disruption: Critical = immediate danger / emergency-access blocked; High = significant safety or many affected; Medium = moderate; Low = minor.
- title: a crisp 4-7 word headline.
- description: 1-2 factual sentences about what is visible.
- tags: 2-4 short lowercase keywords.
- safetyRisk: one short sentence on the danger; if none, say "No immediate safety risk".
- confidence: 0..1 for how sure you are this is the chosen category.
- isCivicIssue: false only if the photo clearly shows no public/community problem.${
    input.language && input.language !== 'English'
      ? `\n- IMPORTANT: write title, description and safetyRisk in ${input.language}. Keep category and severity EXACTLY as the allowed English values.`
      : ''
  }`;

  try {
    const res = await genContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: input.imageBase64,
                mimeType: input.mimeType || 'image/jpeg',
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: VISION_SCHEMA,
        temperature: 0.2,
      },
    });
    const parsed = parseJson<Partial<VisionResult>>(res.text ?? '', {});
    return normalizeVision(parsed, fallback);
  } catch (err) {
    console.error('vision analysis failed, using heuristic', err);
    return fallback;
  }
}

function normalizeVision(
  p: Partial<VisionResult>,
  fb: VisionResult,
): VisionResult {
  const category = (CATEGORIES as string[]).includes(p.category as string)
    ? (p.category as IssueCategory)
    : fb.category;
  const severity = SEVERITIES.includes(p.severity as Severity)
    ? (p.severity as Severity)
    : fb.severity;
  return {
    isCivicIssue: p.isCivicIssue ?? true,
    category,
    severity,
    title: (p.title ?? fb.title).slice(0, 80),
    description: p.description ?? fb.description,
    tags: Array.isArray(p.tags) && p.tags.length ? p.tags.slice(0, 4) : fb.tags,
    safetyRisk: p.safetyRisk ?? fb.safetyRisk,
    confidence:
      typeof p.confidence === 'number'
        ? Math.max(0, Math.min(1, p.confidence))
        : fb.confidence,
  };
}

// Keyword heuristic so the product still works without a key / on API errors.
function heuristicVision(input: TriageInput): VisionResult {
  const text = `${input.notes ?? ''} ${input.location}`.toLowerCase();
  const rules: [IssueCategory, string[]][] = [
    ['Pothole', ['pothole', 'crater', 'road', 'tar', 'asphalt']],
    ['Streetlight', ['light', 'lamp', 'dark', 'bulb']],
    ['Water Leak', ['water', 'pipe', 'leak', 'burst']],
    ['Garbage', ['garbage', 'trash', 'waste', 'dump', 'litter']],
    ['Drainage', ['drain', 'sewage', 'sewer', 'manhole', 'flood']],
    ['Tree / Hazard', ['tree', 'branch', 'fallen', 'hazard']],
    ['Traffic Signal', ['signal', 'traffic light']],
    ['Stray Animals', ['dog', 'animal', 'cattle', 'stray']],
    ['Public Toilet', ['toilet', 'restroom', 'urinal']],
    ['Encroachment', ['encroach', 'vendor', 'illegal']],
  ];
  const category =
    rules.find(([, kws]) => kws.some((k) => text.includes(k)))?.[0] ?? 'Other';
  return {
    isCivicIssue: true,
    category,
    severity: 'Medium',
    title: input.notes?.slice(0, 60) || `${category} reported`,
    description:
      input.notes ||
      `A ${category.toLowerCase()} issue was reported at ${input.location}.`,
    tags: [category.toLowerCase().split(' ')[0]],
    safetyRisk: 'Assessed from reporter notes; pending field confirmation.',
    confidence: 0.45,
  };
}

// ----- Agent tools (function declarations) ------------------------------------

const TOOLS: FunctionDeclaration[] = [
  {
    name: 'find_duplicate_reports',
    description:
      'Check whether neighbours have already filed an open report of the same category near this location. Returns the count and the nearest match.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, enum: CATEGORIES as string[] },
      },
      required: ['category'],
    },
  },
  {
    name: 'lookup_department',
    description:
      'Find the municipal department responsible for a category, its service-level target (SLA) in hours, and escalation contact.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, enum: CATEGORIES as string[] },
      },
      required: ['category'],
    },
  },
  {
    name: 'assess_priority',
    description:
      'Compute a 0-100 priority score from severity, number of nearby duplicate reports, the department SLA in hours, and whether there is a safety risk.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        severity: { type: Type.STRING, enum: SEVERITIES as string[] },
        duplicateCount: { type: Type.INTEGER },
        slaHours: { type: Type.INTEGER },
        hasSafetyRisk: { type: Type.BOOLEAN },
      },
      required: ['severity', 'duplicateCount', 'slaHours', 'hasSafetyRisk'],
    },
  },
  {
    name: 'file_work_order',
    description:
      'Finalise the triage: file the work order with the responsible department. Provide a crisp official summary, a warm plain-language advisory for the citizen, the final priority score, and the single most important recommended action.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        officialSummary: { type: Type.STRING },
        citizenAdvisory: { type: Type.STRING },
        priority: { type: Type.INTEGER },
        recommendedAction: { type: Type.STRING },
      },
      required: [
        'title',
        'officialSummary',
        'citizenAdvisory',
        'priority',
        'recommendedAction',
      ],
    },
  },
];

const SYSTEM_INSTRUCTION = `You are the Community Hero Civic Triage Agent.
A citizen photo has already been analysed for you. Your job is to triage the report end-to-end so the right city department can act fast.

Work step by step and use your tools — never guess values a tool can give you:
1. Call find_duplicate_reports to see if neighbours already reported this nearby.
2. Call lookup_department to find who is responsible and their SLA.
3. Call assess_priority with the severity, the duplicate count you found, the SLA hours, and whether there is a safety risk.
4. Finally call file_work_order with a precise official summary, a friendly citizen advisory, the final priority, and the single most important recommended action.

Call one tool at a time. After file_work_order, stop.`;

// ----- The agent loop ---------------------------------------------------------

const ICON: Record<string, string> = {
  find_duplicate_reports: 'Layers',
  lookup_department: 'Building2',
  assess_priority: 'Gauge',
  file_work_order: 'FileCheck2',
};
const TOOL_TITLE: Record<string, string> = {
  find_duplicate_reports: 'Checking for duplicate reports nearby',
  lookup_department: 'Routing to the right department',
  assess_priority: 'Scoring priority',
  file_work_order: 'Filing the work order',
};

interface DupResult {
  near: { issue: Issue; distanceM: number }[];
  semantic: { issue: Issue; sim: number }[];
  count: number;
  nearest?: { issue: Issue; distanceM: number };
  topSemantic?: { issue: Issue; sim: number };
}

// Combines geo-proximity dedup with Gemini-embedding semantic similarity, so the
// same recurring problem is caught even when reported in different words or spots.
async function detectDuplicates(
  category: IssueCategory,
  geo: GeoPoint,
  text: string,
  excludeId?: string,
): Promise<DupResult> {
  const cityWide = await findNearbyDuplicates(category, geo, 60000, excludeId);
  const near = cityWide.filter((r) => r.distanceM <= 450);
  let semantic: { issue: Issue; sim: number }[] = [];
  if (cityWide.length) {
    const cand = cityWide.slice(0, 12);
    const vecs = await embedMany([text, ...cand.map((c) => `${c.issue.title}. ${c.issue.description}`)]);
    const q = vecs[0];
    if (q) {
      semantic = cand
        .map((c, i) => ({ issue: c.issue, sim: vecs[i + 1] ? cosine(q, vecs[i + 1]!) : 0 }))
        .filter((s) => s.sim >= 0.88)
        .sort((a, b) => b.sim - a.sim);
    }
  }
  const ids = new Set<string>([
    ...near.map((n) => n.issue.id),
    ...semantic.filter((s) => s.sim >= 0.9).map((s) => s.issue.id),
  ]);
  return { near, semantic, count: ids.size, nearest: near[0], topSemantic: semantic[0] };
}

export async function* runTriageAgent(
  input: TriageInput,
): AsyncGenerator<AgentEvent> {
  const reporter = input.reporter?.trim() || 'You';

  // 1) Vision
  yield {
    type: 'step',
    step: step('ScanSearch', 'Analyzing photo with Gemini Vision', 'Detecting the issue, severity and safety risk…', 'running'),
  };
  const vision = await analyzePhoto(input);
  yield {
    type: 'step',
    step: step(
      'ScanSearch',
      'Vision analysis complete',
      `${vision.category} · ${vision.severity} severity · ${Math.round(
        vision.confidence * 100,
      )}% confidence`,
      'done',
      { tool: 'vision', data: { ...vision } },
    ),
  };

  // collected state
  let department = DEPARTMENTS[vision.category];
  let duplicateCount = 0;
  let nearestDup: { issue: Issue; distanceM: number } | undefined;
  let semanticTop: { issue: Issue; sim: number } | undefined;
  let priority = computePriority({
    severity: vision.severity,
    duplicateCount: 0,
    slaHours: department.slaHours,
    hasSafetyRisk: hasRisk(vision.safetyRisk),
  });
  let advisory = '';
  let officialSummary = '';
  let recommendedAction = '';
  let finalTitle = vision.title;
  let finalized = false;

  const runTool = async (name: string, args: Record<string, unknown>) => {
    const cat = pickCategory(args.category, vision.category);
    switch (name) {
      case 'find_duplicate_reports': {
        const dup = await detectDuplicates(cat, input.geo, `${vision.title}. ${vision.description}`);
        duplicateCount = dup.count;
        nearestDup = dup.nearest;
        semanticTop = dup.topSemantic;
        return {
          count: dup.count,
          nearest: dup.nearest
            ? {
                id: dup.nearest.issue.ref ?? dup.nearest.issue.id,
                title: dup.nearest.issue.title,
                distanceMeters: Math.round(dup.nearest.distanceM),
                verifications: dup.nearest.issue.verifications,
              }
            : null,
          semanticMatch: dup.topSemantic
            ? {
                id: dup.topSemantic.issue.ref ?? dup.topSemantic.issue.id,
                title: dup.topSemantic.issue.title,
                similarity: Number(dup.topSemantic.sim.toFixed(2)),
              }
            : null,
        };
      }
      case 'lookup_department': {
        department = DEPARTMENTS[cat];
        return {
          name: department.name,
          slaHours: department.slaHours,
          contact: department.contact,
          escalation: department.escalation,
        };
      }
      case 'assess_priority': {
        priority = computePriority({
          severity: pickSeverity(args.severity, vision.severity),
          duplicateCount: numArg(args.duplicateCount, duplicateCount),
          slaHours: numArg(args.slaHours, department.slaHours),
          hasSafetyRisk:
            typeof args.hasSafetyRisk === 'boolean'
              ? args.hasSafetyRisk
              : hasRisk(vision.safetyRisk),
        });
        return { priorityScore: priority, scale: '0-100' };
      }
      case 'file_work_order': {
        finalTitle = (args.title as string)?.trim() || finalTitle;
        officialSummary = (args.officialSummary as string) ?? '';
        advisory = (args.citizenAdvisory as string) ?? '';
        recommendedAction = (args.recommendedAction as string) ?? '';
        if (typeof args.priority === 'number') priority = args.priority;
        finalized = true;
        return { status: 'filed', accepted: true };
      }
      default:
        return { error: 'unknown tool' };
    }
  };

  if (hasGemini()) {
    const contents: Content[] = [
      {
        role: 'user',
        parts: [
          {
            text: `Triage this report.\nReporter notes: ${
              input.notes || 'none'
            }\nLocation: ${input.location}\nCoordinates: ${input.geo.lat.toFixed(
              5,
            )}, ${input.geo.lng.toFixed(5)}\nVision analysis: ${JSON.stringify({
              category: vision.category,
              severity: vision.severity,
              title: vision.title,
              description: vision.description,
              safetyRisk: vision.safetyRisk,
              tags: vision.tags,
            })}${
              input.language && input.language !== 'English'
                ? `\nWrite the file_work_order citizenAdvisory and title in ${input.language}.`
                : ''
            }`,
          },
        ],
      },
    ];

    try {
      for (let i = 0; i < 6 && !finalized; i++) {
        const res = await gemini().models.generateContent({
          model: MODEL,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: [{ functionDeclarations: TOOLS }],
            toolConfig: {
              functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
            },
            temperature: 0.2,
          },
        });

        const calls = res.functionCalls ?? [];
        if (!calls.length) break;

        const modelContent = res.candidates?.[0]?.content;
        if (modelContent) contents.push(modelContent);

        const responseParts: Part[] = [];
        for (const call of calls) {
          const name = call.name ?? '';
          const args = (call.args ?? {}) as Record<string, unknown>;
          yield {
            type: 'step',
            step: step(
              ICON[name] ?? 'Bot',
              TOOL_TITLE[name] ?? name,
              describeCall(name, args, vision),
              'running',
              { tool: name },
            ),
          };
          const result = await runTool(name, args);
          yield {
            type: 'step',
            step: step(
              ICON[name] ?? 'Bot',
              doneTitle(name),
              summarizeResult(name, result),
              'done',
              { tool: name, data: result as Record<string, unknown> },
            ),
          };
          responseParts.push({ functionResponse: { name, response: result } });
        }
        contents.push({ role: 'user', parts: responseParts });
      }
    } catch (err) {
      console.error('agent loop failed, finishing deterministically', err);
    }
  }

  // 2) Ensure complete result even if the model stopped early or has no key.
  if (!finalized) {
    yield {
      type: 'step',
      step: step('Layers', 'Checking for duplicate reports nearby', describeCall('find_duplicate_reports', {}, vision), 'running', { tool: 'find_duplicate_reports' }),
    };
    const dup = await detectDuplicates(vision.category, input.geo, `${vision.title}. ${vision.description}`);
    duplicateCount = dup.count;
    nearestDup = dup.nearest;
    semanticTop = dup.topSemantic;
    yield {
      type: 'step',
      step: step('Layers', 'Duplicate check complete', dup.count ? `Found ${dup.count} related report(s)${dup.topSemantic ? ` (semantic match ${Math.round(dup.topSemantic.sim * 100)}%)` : ''} — linking for stronger signal.` : 'No duplicates — this is a fresh report.', 'done', { tool: 'find_duplicate_reports', data: { count: dup.count } }),
    };

    department = DEPARTMENTS[vision.category];
    yield {
      type: 'step',
      step: step('Building2', 'Routed to department', `${department.name} · SLA ${slaText(department.slaHours)}`, 'done', { tool: 'lookup_department' }),
    };

    priority = computePriority({
      severity: vision.severity,
      duplicateCount,
      slaHours: department.slaHours,
      hasSafetyRisk: hasRisk(vision.safetyRisk),
    });
    yield {
      type: 'step',
      step: step('Gauge', 'Priority scored', `Priority ${priority}/100`, 'done', { tool: 'assess_priority', data: { priority } }),
    };

    advisory = `Your report has been routed to ${department.name} with priority ${priority}/100. Target resolution within ${slaText(department.slaHours)}. You'll be notified as it progresses; escalation contact is ${department.escalation}.`;
    officialSummary = vision.description;
    recommendedAction =
      vision.severity === 'Critical' || vision.severity === 'High'
        ? 'Dispatch a field crew on priority and barricade the area if unsafe.'
        : 'Schedule inspection and remediation within the SLA window.';
  }

  if (!advisory) {
    advisory = `Routed to ${department.name}. Target resolution within ${slaText(
      department.slaHours,
    )}.`;
  }

  // 3) Build, persist and emit the issue.
  const duplicateLink =
    nearestDup && nearestDup.distanceM < 120
      ? nearestDup.issue.id
      : semanticTop && semanticTop.sim >= 0.9
        ? semanticTop.issue.id
        : undefined;

  const issue = await createIssue({
    title: finalTitle,
    description: vision.description,
    category: vision.category,
    severity: vision.severity,
    status: 'Reported',
    priority,
    confidence: vision.confidence,
    safetyRisk: vision.safetyRisk,
    tags: vision.tags,
    location: input.location,
    geo: input.geo,
    department: department.name,
    slaHours: department.slaHours,
    advisory,
    imageUrl: input.imageUrl ?? input.imageDataUrl,
    reporter,
    reporterId: input.reporterId ?? null,
    verifications: duplicateCount > 0 ? duplicateCount : 1,
    duplicateOf: duplicateLink,
    recommendedAction,
  });

  yield {
    type: 'step',
    step: step('FileCheck2', `Work order ${issue.workOrderId} filed`, `${department.name} · priority ${priority}/100`, 'done', { tool: 'file_work_order', data: { workOrderId: issue.workOrderId } }),
  };

  yield {
    type: 'result',
    issue,
    warning: vision.isCivicIssue
      ? undefined
      : 'This photo may not show a public community issue — please double-check before it reaches the department.',
  };
}

// ----- helpers ----------------------------------------------------------------

function hasRisk(s: string): boolean {
  return !/no (immediate )?(safety )?risk/i.test(s) && s.trim().length > 0;
}
function pickCategory(v: unknown, fb: IssueCategory): IssueCategory {
  return (CATEGORIES as string[]).includes(v as string)
    ? (v as IssueCategory)
    : fb;
}
function pickSeverity(v: unknown, fb: Severity): Severity {
  return SEVERITIES.includes(v as Severity) ? (v as Severity) : fb;
}
function numArg(v: unknown, fb: number): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : fb;
}
function slaText(hours: number): string {
  if (hours < 24) return `${hours} hours`;
  const d = Math.round(hours / 24);
  return `${d} day${d > 1 ? 's' : ''}`;
}
function describeCall(
  name: string,
  args: Record<string, unknown>,
  vision: VisionResult,
): string {
  switch (name) {
    case 'find_duplicate_reports':
      return `Searching open ${
        (args.category as string) || vision.category
      } reports within 450m…`;
    case 'lookup_department':
      return `Looking up who handles ${
        (args.category as string) || vision.category
      }…`;
    case 'assess_priority':
      return 'Blending severity, duplicates, SLA and safety risk…';
    case 'file_work_order':
      return 'Drafting the official summary and citizen advisory…';
    default:
      return 'Working…';
  }
}
function doneTitle(name: string): string {
  return (
    {
      find_duplicate_reports: 'Duplicate check complete',
      lookup_department: 'Department identified',
      assess_priority: 'Priority scored',
      file_work_order: 'Work order filed',
    }[name] ?? 'Done'
  );
}
function summarizeResult(name: string, result: Record<string, unknown>): string {
  switch (name) {
    case 'find_duplicate_reports': {
      const r = result as {
        count: number;
        nearest?: { distanceMeters: number };
        semanticMatch?: { id: string; similarity: number };
      };
      if (!r.count) return 'No duplicates — this is a fresh report.';
      const bits: string[] = [`Found ${r.count} related report(s)`];
      if (r.nearest) bits.push(`closest ${r.nearest.distanceMeters}m away`);
      if (r.semanticMatch) bits.push(`semantic match ${Math.round(r.semanticMatch.similarity * 100)}% (${r.semanticMatch.id})`);
      return bits.join(' · ') + '.';
    }
    case 'lookup_department': {
      const r = result as { name: string; slaHours: number };
      return `${r.name} · SLA ${slaText(r.slaHours)}`;
    }
    case 'assess_priority':
      return `Priority ${(result as { priorityScore: number }).priorityScore}/100`;
    case 'file_work_order':
      return 'Routed to the department for action.';
    default:
      return '';
  }
}
