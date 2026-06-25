-- Community Hero — Supabase schema (run in Supabase → SQL Editor)
-- Idempotent-ish: safe to run once on a fresh project.

create extension if not exists pgcrypto;

-- ─────────────────────────── profiles ───────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Citizen',
  avatar text not null default '🧑',
  role text not null default 'citizen' check (role in ('citizen','authority')),
  points int not null default 0,
  reports int not null default 0,
  verifications int not null default 0,
  resolved_impact int not null default 0,
  created_at timestamptz not null default now()
);

-- auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',
             new.raw_user_meta_data->>'full_name',
             split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── issues ─────────────────────────────
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  title text not null,
  description text not null default '',
  category text not null,
  severity text not null check (severity in ('Low','Medium','High','Critical')),
  status text not null default 'Reported' check (status in ('Reported','Acknowledged','In Progress','Resolved')),
  priority int not null default 0,
  confidence numeric not null default 0,
  safety_risk text not null default '',
  tags text[] not null default '{}',
  location text not null default '',
  lat double precision,
  lng double precision,
  department text not null default '',
  sla_hours int not null default 72,
  work_order_id text,
  advisory text not null default '',
  image_url text,
  reporter_id uuid references public.profiles(id) on delete set null,
  reporter_name text not null default 'Citizen',
  verifications int not null default 0,
  duplicate_of uuid references public.issues(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists issues_status_idx on public.issues(status);
create index if not exists issues_category_idx on public.issues(category);
create index if not exists issues_created_idx on public.issues(created_at desc);

-- ─────────────────────── timeline events ────────────────────────
create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  status text not null,
  note text not null default '',
  actor text not null default '',
  at timestamptz not null default now()
);
create index if not exists timeline_issue_idx on public.timeline_events(issue_id);

-- ───────────────────── community verifications ──────────────────
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (issue_id, user_id)
);

-- ───────────────────────── triggers ─────────────────────────────
-- award reporter points on new issue
create or replace function public.on_issue_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare pts int;
begin
  pts := case new.severity when 'Critical' then 50 when 'High' then 35 when 'Medium' then 20 else 10 end;
  if new.reporter_id is not null then
    update public.profiles set points = points + pts, reports = reports + 1 where id = new.reporter_id;
  end if;
  return new;
end; $$;
drop trigger if exists trg_issue_insert on public.issues;
create trigger trg_issue_insert after insert on public.issues
  for each row execute function public.on_issue_insert();

-- reward reporter when their issue is resolved
create or replace function public.on_issue_resolved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Resolved' and old.status is distinct from 'Resolved' and new.reporter_id is not null then
    update public.profiles set points = points + 15, resolved_impact = resolved_impact + 1 where id = new.reporter_id;
  end if;
  return new;
end; $$;
drop trigger if exists trg_issue_resolved on public.issues;
create trigger trg_issue_resolved after update on public.issues
  for each row execute function public.on_issue_resolved();

-- count verifications, bump priority, reward the verifier
create or replace function public.on_verification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.issues
    set verifications = verifications + 1,
        priority = least(100, priority + 2),
        updated_at = now()
  where id = new.issue_id;
  update public.profiles
    set points = points + 5, verifications = verifications + 1
  where id = new.user_id;
  return new;
end; $$;
drop trigger if exists trg_verification on public.verifications;
create trigger trg_verification after insert on public.verifications
  for each row execute function public.on_verification();

-- ─────────────────────────── RLS ────────────────────────────────
alter table public.profiles enable row level security;
alter table public.issues enable row level security;
alter table public.timeline_events enable row level security;
alter table public.verifications enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

drop policy if exists "issues read" on public.issues;
create policy "issues read" on public.issues for select using (true);
drop policy if exists "issues insert own" on public.issues;
create policy "issues insert own" on public.issues for insert to authenticated with check (auth.uid() = reporter_id);
drop policy if exists "issues authority update" on public.issues;
create policy "issues authority update" on public.issues for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'authority')
);

drop policy if exists "timeline read" on public.timeline_events;
create policy "timeline read" on public.timeline_events for select using (true);
drop policy if exists "timeline authority insert" on public.timeline_events;
create policy "timeline authority insert" on public.timeline_events for insert to authenticated with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'authority')
);

drop policy if exists "verifications read" on public.verifications;
create policy "verifications read" on public.verifications for select using (true);
drop policy if exists "verifications insert own" on public.verifications;
create policy "verifications insert own" on public.verifications for insert to authenticated with check (auth.uid() = user_id);

-- ───────────────────────── realtime ─────────────────────────────
-- (ignore "already member" errors if re-run)
alter publication supabase_realtime add table public.issues;
alter publication supabase_realtime add table public.verifications;
alter publication supabase_realtime add table public.timeline_events;
alter publication supabase_realtime add table public.profiles;

-- ───────────────────────── storage ──────────────────────────────
insert into storage.buckets (id, name, public)
values ('issue-photos', 'issue-photos', true)
on conflict (id) do nothing;

drop policy if exists "issue photos read" on storage.objects;
create policy "issue photos read" on storage.objects for select using (bucket_id = 'issue-photos');
drop policy if exists "issue photos upload" on storage.objects;
create policy "issue photos upload" on storage.objects for insert to authenticated with check (bucket_id = 'issue-photos');

-- ───────────────────── minimal seed (optional) ──────────────────
-- A few rows so the app isn't empty before the in-app seeder runs.
insert into public.issues (ref,title,description,category,severity,status,priority,confidence,safety_risk,tags,location,lat,lng,department,sla_hours,work_order_id,advisory,reporter_name,verifications,created_at,updated_at) values
('CH-1001','Deep crater swallowing two-wheelers','A ~1m pothole in the fast lane near the junction; bikes swerve into oncoming traffic.','Pothole','Critical','In Progress',96,0.96,'High collision risk for two-wheelers.','{road,collision-risk}','MG Road, Bengaluru',12.9756,77.6068,'Roads & Infrastructure Cell',72,'WO-5209','Routed to Roads & Infrastructure Cell, priority 96/100.','Aarav Mehta',23, now() - interval '5 hours', now() - interval '1 hours'),
('CH-1002','Burst pipeline flooding the road','A water main has burst and is gushing onto the carriageway.','Water Leak','Critical','Acknowledged',93,0.93,'Drinking-water loss and slip hazard.','{water-waste,flooding}','Jayanagar, Bengaluru',12.9250,77.5938,'Water Supply & Sewerage Board',24,'WO-5218','Routed to Water Supply & Sewerage Board, priority 93/100.','Diya Sharma',31, now() - interval '9 hours', now() - interval '2 hours'),
('CH-1003','Entire street in darkness','A row of five streetlights dead for over a week.','Streetlight','High','Reported',78,0.90,'Poor visibility raises night-time safety concerns.','{lighting,night-safety}','HSR Layout, Bengaluru',12.9116,77.6389,'Street Lighting & Electrical',48,'WO-5227','Routed to Street Lighting & Electrical, priority 78/100.','Kabir Nair',14, now() - interval '30 hours', now() - interval '30 hours'),
('CH-1004','Overflowing garbage at market corner','Mixed waste piling beside the vegetable market; strays scattering it.','Garbage','High','Reported',80,0.88,'Sanitation and public-health hazard.','{waste,public-health}','BTM Layout, Bengaluru',12.9166,77.6101,'Solid Waste Management',12,'WO-5236','Routed to Solid Waste Management, priority 80/100.','Ananya Rao',19, now() - interval '14 hours', now() - interval '14 hours')
on conflict (ref) do nothing;

insert into public.timeline_events (issue_id, status, note, actor, at)
select id, 'Reported', 'Filed and triaged by the AI agent.', 'Triage Agent', created_at from public.issues
on conflict do nothing;
