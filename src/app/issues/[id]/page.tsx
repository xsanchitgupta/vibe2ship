import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  MapPin,
  Building2,
  FileCheck2,
  ShieldAlert,
  ThumbsUp,
  Clock,
  User,
  ArrowLeft,
  Layers,
} from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';
import { getIssue } from '@/lib/data';
import { getProfile } from '@/lib/auth';
import MapView from '@/components/MapView';
import IssueActions from '@/components/IssueActions';
import ResolveWithProof from '@/components/ResolveWithProof';
import Comments from '@/components/Comments';
import {
  CategoryIcon,
  SeverityBadge,
  StatusBadge,
  priorityColor,
  statusClass,
  timeAgo,
} from '@/components/ui';

export const dynamic = 'force-dynamic';

function slaText(hours: number): string {
  if (hours < 24) return `${hours} hours`;
  const d = Math.round(hours / 24);
  return `${d} day${d > 1 ? 's' : ''}`;
}

export default async function IssueDetail(ctx: PageProps<'/issues/[id]'>) {
  const { id } = await ctx.params;
  const issue = await getIssue(id);
  if (!issue) notFound();
  const profile = await getProfile();
  const isAuthority = profile?.role === 'authority';

  return (
    <div className="container narrow animate-fade-in">
      <Link href="/dashboard" className="link flex items-center gap-1 tiny" style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <div className="glass-card">
        <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: '0.75rem' }}>
          <span className="pill pill-primary">
            <CategoryIcon category={issue.category} size={13} /> {issue.category}
          </span>
          <span className="mono tiny muted">{issue.ref ?? issue.id} · {issue.workOrderId}</span>
        </div>

        <h1 style={{ fontSize: '1.8rem' }}>{issue.title}</h1>
        <div className="flex items-center gap-2 flex-wrap" style={{ margin: '0.75rem 0 1.25rem' }}>
          <SeverityBadge severity={issue.severity} />
          <StatusBadge status={issue.status} />
          <span className="tag">{Math.round(issue.confidence * 100)}% AI confidence</span>
          <span className="tiny muted flex items-center gap-1"><MapPin size={12} /> {issue.location}</span>
        </div>

        <div className="two-col">
          <div>
            {issue.imageDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={issue.imageDataUrl}
                alt={issue.title}
                style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: '1rem', maxHeight: 280, objectFit: 'cover' }}
              />
            )}
            <p className="muted small">{issue.description}</p>

            <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: '1rem' }}>
              {issue.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
            </div>

            <div style={{ margin: '1.25rem 0 0.4rem' }} className="flex items-center justify-between tiny muted">
              <span>Priority score</span>
              <strong style={{ color: priorityColor(issue.priority) }}>{issue.priority}/100</strong>
            </div>
            <div className="meter">
              <span style={{ width: `${issue.priority}%`, background: priorityColor(issue.priority) }} />
            </div>

            {issue.safetyRisk && (
              <p className="tiny" style={{ marginTop: '1rem', color: '#dc2626' }}>
                <ShieldAlert size={13} style={{ verticalAlign: '-2px' }} /> {issue.safetyRisk}
              </p>
            )}
          </div>

          <div>
            <div className="panel" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <Row icon={<Building2 size={15} />} label="Department" value={issue.department} />
              <Row icon={<FileCheck2 size={15} />} label="SLA target" value={slaText(issue.slaHours)} />
              <Row icon={<User size={15} />} label="Reported by" value={issue.reporter} />
              <Row icon={<ThumbsUp size={15} />} label="Verifications" value={String(issue.verifications)} />
              <Row icon={<Clock size={15} />} label="Reported" value={timeAgo(issue.createdAt)} />
            </div>
            {issue.duplicateOf && (
              <p className="tiny muted" style={{ marginBottom: '1rem' }}>
                <Layers size={12} style={{ verticalAlign: '-2px' }} /> Linked to{' '}
                <Link className="link" href={`/issues/${issue.duplicateOf}`}>{issue.duplicateOf}</Link>
              </p>
            )}
            <div className="flex gap-2 flex-wrap items-center">
              <IssueActions id={issue.id} />
              {isAuthority && issue.status !== 'Resolved' && <ResolveWithProof id={issue.id} />}
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: '1rem', marginTop: '1.25rem' }}>
          <div className="tiny" style={{ color: '#7c3aed', fontWeight: 700, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Agent advisory
          </div>
          <p className="small">{issue.advisory}</p>
        </div>

        {/* Before / After resolution proof */}
        {issue.afterImageUrl && (
          <div className="panel" style={{ padding: '1.25rem', marginTop: '1.25rem' }}>
            <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: '0.85rem' }}>
              <div className="tiny" style={{ color: 'var(--primary-600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resolution proof
              </div>
              <span className="badge" style={{ background: issue.resolutionVerified ? 'rgba(22,163,74,0.12)' : 'rgba(217,119,6,0.12)', color: issue.resolutionVerified ? '#15803d' : '#b45309' }}>
                {issue.resolutionVerified ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                {issue.resolutionVerified ? 'AI-verified fix' : 'AI flagged'}
                {issue.resolutionConfidence != null && ` · ${Math.round(issue.resolutionConfidence * 100)}%`}
              </span>
            </div>
            <div className="split">
              {issue.imageDataUrl && (
                <div>
                  <div className="tiny muted" style={{ marginBottom: '0.4rem' }}>Before</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={issue.imageDataUrl} alt="before" style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: 220, objectFit: 'cover' }} />
                </div>
              )}
              <div>
                <div className="tiny muted" style={{ marginBottom: '0.4rem' }}>After</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={issue.afterImageUrl} alt="after" style={{ width: '100%', borderRadius: 'var(--radius-md)', maxHeight: 220, objectFit: 'cover' }} />
              </div>
            </div>
            {issue.resolutionNote && <p className="small" style={{ marginTop: '0.85rem' }}>{issue.resolutionNote}</p>}
          </div>
        )}
      </div>

      {/* Timeline + map */}
      <div className="two-col" style={{ marginTop: '1.5rem' }}>
        <div className="glass-card">
          <div className="section-title">
            <Clock size={18} color="#7c3aed" />
            <h2 style={{ fontSize: '1.1rem' }}>Resolution timeline</h2>
          </div>
          <div className="timeline">
            {issue.timeline.map((ev, i) => (
              <div key={i} className={`tl-step ${i === issue.timeline.length - 1 ? 'running' : 'done'}`}>
                <div className="tl-icon">
                  <span className={`badge ${statusClass(ev.status)}`} style={{ padding: 4 }}>
                    <span className="dot" style={{ background: 'currentColor' }} />
                  </span>
                </div>
                <div className="tl-body">
                  <div className="tl-title">{ev.status}</div>
                  <div className="tl-detail">{ev.note}</div>
                  <div className="tiny muted" style={{ marginTop: '0.2rem' }}>{ev.actor} · {timeAgo(ev.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <div className="section-title">
            <MapPin size={18} color="#7c3aed" />
            <h2 style={{ fontSize: '1.1rem' }}>Location</h2>
          </div>
          <MapView issues={[issue]} activeId={issue.id} />
        </div>
      </div>

      {/* Community discussion */}
      <div style={{ marginTop: '1.5rem' }}>
        <Comments issueId={issue.id} />
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '0.4rem 0' }}>
      <span className="tiny muted flex items-center gap-2">{icon} {label}</span>
      <span className="small" style={{ color: 'var(--foreground)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
