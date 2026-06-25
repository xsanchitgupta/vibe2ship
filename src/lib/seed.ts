import type { Citizen, Issue, IssueCategory, IssueStatus, Severity } from './types';
import { DEPARTMENTS, computePriority } from './departments';
import { LOCALITIES, jitter } from './geo';

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

let woCounter = 4800;
function workOrder(): string {
  return `WO-${(woCounter += 7)}`;
}

interface SeedSpec {
  title: string;
  description: string;
  category: IssueCategory;
  severity: Severity;
  status: IssueStatus;
  locality: string;
  reporter: string;
  verifications: number;
  ageHours: number;
  safetyRisk: string;
  tags: string[];
  confidence: number;
}

const SPECS: SeedSpec[] = [
  {
    title: 'Deep crater swallowing two-wheelers',
    description:
      'A large pothole roughly 1m wide has formed in the fast lane near the junction; bikes are swerving into oncoming traffic to avoid it.',
    category: 'Pothole',
    severity: 'Critical',
    status: 'In Progress',
    locality: 'MG Road',
    reporter: 'Aarav Mehta',
    verifications: 23,
    ageHours: 5,
    safetyRisk: 'High collision risk for two-wheelers in fast lane.',
    tags: ['road', 'collision-risk', 'junction'],
    confidence: 0.96,
  },
  {
    title: 'Burst pipeline flooding the road',
    description:
      'A water main has burst and is gushing onto the carriageway, wasting drinking water and creating a slippery surface.',
    category: 'Water Leak',
    severity: 'Critical',
    status: 'Acknowledged',
    locality: 'Jayanagar',
    reporter: 'Diya Sharma',
    verifications: 31,
    ageHours: 9,
    safetyRisk: 'Drinking-water loss and slip hazard.',
    tags: ['water-waste', 'flooding', 'pipeline'],
    confidence: 0.93,
  },
  {
    title: 'Entire street in darkness',
    description:
      'A row of five streetlights has been dead for over a week, leaving the stretch unsafe after sundown.',
    category: 'Streetlight',
    severity: 'High',
    status: 'Reported',
    locality: 'HSR Layout',
    reporter: 'Kabir Nair',
    verifications: 14,
    ageHours: 30,
    safetyRisk: 'Poor visibility raises night-time safety concerns.',
    tags: ['lighting', 'night-safety'],
    confidence: 0.9,
  },
  {
    title: 'Overflowing garbage at market corner',
    description:
      'Mixed waste is piling up beside the vegetable market; stray dogs are scattering it across the footpath.',
    category: 'Garbage',
    severity: 'High',
    status: 'Reported',
    locality: 'BTM Layout',
    reporter: 'Ananya Rao',
    verifications: 19,
    ageHours: 14,
    safetyRisk: 'Sanitation and public-health hazard.',
    tags: ['waste', 'public-health', 'market'],
    confidence: 0.88,
  },
  {
    title: 'Clogged drain breeding mosquitoes',
    description:
      'Stagnant black water sits in an uncovered storm drain; residents report a spike in mosquitoes.',
    category: 'Drainage',
    severity: 'Medium',
    status: 'Acknowledged',
    locality: 'Koramangala',
    reporter: 'Vihaan Gupta',
    verifications: 11,
    ageHours: 48,
    safetyRisk: 'Vector-borne disease risk.',
    tags: ['drain', 'stagnant-water', 'mosquito'],
    confidence: 0.84,
  },
  {
    title: 'Fallen branch blocking footpath',
    description:
      'A heavy branch came down after the rain and is blocking the pedestrian path, forcing people onto the road.',
    category: 'Tree / Hazard',
    severity: 'High',
    status: 'Resolved',
    locality: 'Malleshwaram',
    reporter: 'Saanvi Iyer',
    verifications: 8,
    ageHours: 70,
    safetyRisk: 'Pedestrians pushed onto live carriageway.',
    tags: ['tree', 'obstruction', 'post-rain'],
    confidence: 0.92,
  },
  {
    title: 'Traffic signal stuck on red',
    description:
      'The signal at the busy junction is frozen, causing long jams and risky manual crossings.',
    category: 'Traffic Signal',
    severity: 'High',
    status: 'In Progress',
    locality: 'Indiranagar',
    reporter: 'Reyansh Joshi',
    verifications: 27,
    ageHours: 3,
    safetyRisk: 'Uncontrolled junction, high accident risk.',
    tags: ['signal', 'congestion', 'junction'],
    confidence: 0.89,
  },
  {
    title: 'Pothole cluster after monsoon',
    description:
      'Several medium potholes have opened up along a 200m stretch, damaging vehicle suspensions.',
    category: 'Pothole',
    severity: 'Medium',
    status: 'Reported',
    locality: 'Whitefield',
    reporter: 'Myra Reddy',
    verifications: 9,
    ageHours: 26,
    safetyRisk: 'Vehicle damage and sudden braking.',
    tags: ['road', 'monsoon-damage'],
    confidence: 0.87,
  },
  {
    title: 'Streetlight flickering near school',
    description:
      'A streetlight outside the primary school flickers and stays off most nights.',
    category: 'Streetlight',
    severity: 'Medium',
    status: 'Resolved',
    locality: 'Banashankari',
    reporter: 'Aditya Menon',
    verifications: 6,
    ageHours: 96,
    safetyRisk: 'Reduced safety for schoolchildren.',
    tags: ['lighting', 'school-zone'],
    confidence: 0.85,
  },
  {
    title: 'Garbage dumped in vacant plot',
    description:
      'Construction debris and household waste are being illegally dumped in an empty plot.',
    category: 'Garbage',
    severity: 'Low',
    status: 'Reported',
    locality: 'Electronic City',
    reporter: 'Ishaan Verma',
    verifications: 4,
    ageHours: 52,
    safetyRisk: 'Illegal dumping, minor nuisance.',
    tags: ['waste', 'illegal-dumping'],
    confidence: 0.8,
  },
  {
    title: 'Sewage overflow onto street',
    description:
      'A manhole is overflowing and sewage is flowing toward residential gates.',
    category: 'Drainage',
    severity: 'Critical',
    status: 'Acknowledged',
    locality: 'Hebbal',
    reporter: 'Anika Pillai',
    verifications: 17,
    ageHours: 7,
    safetyRisk: 'Biohazard near homes.',
    tags: ['sewage', 'overflow', 'biohazard'],
    confidence: 0.91,
  },
  {
    title: 'Aggressive stray dog pack',
    description:
      'A pack of strays near the bus stop has chased commuters; an elderly resident was nipped.',
    category: 'Stray Animals',
    severity: 'Medium',
    status: 'Reported',
    locality: 'Marathahalli',
    reporter: 'Kiara Das',
    verifications: 12,
    ageHours: 40,
    safetyRisk: 'Bite risk to commuters.',
    tags: ['strays', 'bus-stop'],
    confidence: 0.78,
  },
  {
    title: 'Broken public toilet, no water',
    description:
      'The community toilet block has no water supply and a broken door; unusable for days.',
    category: 'Public Toilet',
    severity: 'Medium',
    status: 'In Progress',
    locality: 'Jayanagar',
    reporter: 'Arjun Kapoor',
    verifications: 7,
    ageHours: 60,
    safetyRisk: 'Sanitation access denied.',
    tags: ['sanitation', 'maintenance'],
    confidence: 0.82,
  },
  {
    title: 'Footpath encroached by vendors',
    description:
      'Permanent stalls have taken over the entire footpath, forcing pedestrians onto the road.',
    category: 'Encroachment',
    severity: 'Low',
    status: 'Reported',
    locality: 'MG Road',
    reporter: 'Saanvi Iyer',
    verifications: 5,
    ageHours: 80,
    safetyRisk: 'Pedestrians forced onto carriageway.',
    tags: ['encroachment', 'footpath'],
    confidence: 0.76,
  },
  {
    title: 'Faded zebra crossing at school gate',
    description:
      'The pedestrian crossing markings are completely worn off outside a busy school gate.',
    category: 'Other',
    severity: 'Medium',
    status: 'Reported',
    locality: 'Koramangala',
    reporter: 'Aarav Mehta',
    verifications: 10,
    ageHours: 34,
    safetyRisk: 'Unsafe crossing for children.',
    tags: ['road-marking', 'school-zone'],
    confidence: 0.74,
  },
  {
    title: 'Pothole near hospital entrance',
    description:
      'A deep pothole right at the hospital gate is jolting ambulances and auto-rickshaws.',
    category: 'Pothole',
    severity: 'High',
    status: 'Acknowledged',
    locality: 'HSR Layout',
    reporter: 'Diya Sharma',
    verifications: 21,
    ageHours: 18,
    safetyRisk: 'Disrupts emergency vehicle access.',
    tags: ['road', 'hospital', 'emergency-access'],
    confidence: 0.94,
  },
];

function buildIssue(spec: SeedSpec, idx: number): Issue {
  const dept = DEPARTMENTS[spec.category];
  const loc = LOCALITIES.find((l) => l.name === spec.locality) ?? LOCALITIES[0];
  const createdAt = hoursAgo(spec.ageHours);
  const priority = computePriority({
    severity: spec.severity,
    duplicateCount: Math.floor(spec.verifications / 8),
    slaHours: dept.slaHours,
    hasSafetyRisk: true,
  });

  const timeline = buildTimeline(spec.status, createdAt, dept.name, spec.reporter);

  return {
    id: `CH-${1000 + idx}`,
    title: spec.title,
    description: spec.description,
    category: spec.category,
    severity: spec.severity,
    status: spec.status,
    priority,
    confidence: spec.confidence,
    safetyRisk: spec.safetyRisk,
    tags: spec.tags,
    location: `${spec.locality}, ${'Bengaluru'}`,
    geo: jitter(loc.geo),
    department: dept.name,
    slaHours: dept.slaHours,
    workOrderId: workOrder(),
    advisory: `Reported to ${dept.name}. Target resolution within ${Math.round(
      dept.slaHours / 24,
    ) || 1} day(s). Escalation: ${dept.escalation}.`,
    reporter: spec.reporter,
    verifications: spec.verifications,
    createdAt,
    updatedAt: timeline[timeline.length - 1]?.at ?? createdAt,
    timeline,
  };
}

function buildTimeline(
  status: IssueStatus,
  createdAt: string,
  dept: string,
  reporter: string,
): Issue['timeline'] {
  const order: IssueStatus[] = ['Reported', 'Acknowledged', 'In Progress', 'Resolved'];
  const upto = order.indexOf(status);
  const base = new Date(createdAt).getTime();
  const notes: Record<IssueStatus, { note: string; actor: string }> = {
    Reported: { note: `Filed by ${reporter} and triaged by the AI agent.`, actor: 'Triage Agent' },
    Acknowledged: { note: `${dept} acknowledged the work order.`, actor: dept },
    'In Progress': { note: `Field crew dispatched by ${dept}.`, actor: dept },
    Resolved: { note: `Marked resolved and pending community verification.`, actor: dept },
  };
  return order.slice(0, upto + 1).map((s, i) => ({
    status: s,
    note: notes[s].note,
    actor: notes[s].actor,
    at: new Date(base + i * 3600_000 * (i + 1)).toISOString(),
  }));
}

export function seedIssues(): Issue[] {
  return SPECS.map(buildIssue);
}

export function seedCitizens(): Citizen[] {
  return [
    { id: 'u1', name: 'Diya Sharma', avatar: '🦸‍♀️', points: 0, reports: 0, verifications: 0, resolvedImpact: 0 },
    { id: 'u2', name: 'Aarav Mehta', avatar: '🦸', points: 0, reports: 0, verifications: 0, resolvedImpact: 0 },
    { id: 'u3', name: 'Reyansh Joshi', avatar: '🧑‍🚒', points: 0, reports: 0, verifications: 0, resolvedImpact: 0 },
    { id: 'u4', name: 'Ananya Rao', avatar: '👩‍🔧', points: 0, reports: 0, verifications: 0, resolvedImpact: 0 },
    { id: 'u5', name: 'Kabir Nair', avatar: '🧑‍💼', points: 0, reports: 0, verifications: 0, resolvedImpact: 0 },
    { id: 'u6', name: 'Anika Pillai', avatar: '👩‍⚕️', points: 0, reports: 0, verifications: 0, resolvedImpact: 0 },
    { id: 'u7', name: 'Saanvi Iyer', avatar: '🧑‍🌾', points: 0, reports: 0, verifications: 0, resolvedImpact: 0 },
    { id: 'u8', name: 'You', avatar: '🧑', points: 0, reports: 0, verifications: 0, resolvedImpact: 0 },
  ];
}
