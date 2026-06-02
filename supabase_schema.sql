-- ============================================
-- SALES APP SCHEMA — Supabase
-- הרץ את זה ב-Supabase SQL Editor
-- ============================================

-- סוכנים (מנוהל ע"י Supabase Auth + טבלה זו)
create table agents (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  monthly_target numeric(12,2) default 0,
  annual_target  numeric(12,2) default 0,
  created_at timestamptz default now()
);

-- שלבי פייפליין
create type pipeline_stage as enum (
  'incoming_call',
  'visit_scheduled',
  'proposal_sent',
  'negotiation',
  'in_progress',
  'closed_won',
  'closed_lost'
);

-- לידים
create table leads (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  -- נתון מוביל: כתובת הפרויקט
  project_address text not null,
  client_name     text not null,
  phone           text,
  description     text,
  estimated_value numeric(12,2),
  stage           pipeline_stage not null default 'incoming_call',
  -- גוגל קלנדר
  calendar_event_id text,
  visit_datetime    timestamptz,
  -- מטא
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- היסטוריית שלבים (לוג)
create table stage_history (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  agent_id   uuid not null references agents(id),
  from_stage pipeline_stage,
  to_stage   pipeline_stage not null,
  note       text,
  changed_at timestamptz default now()
);

-- ============================================
-- TRIGGERS
-- ============================================

-- עדכון updated_at אוטומטי
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger leads_updated_at
  before update on leads
  for each row execute function update_updated_at();

-- רישום אוטומטי להיסטוריה כשמשתנה שלב
create or replace function log_stage_change()
returns trigger language plpgsql as $$
begin
  if old.stage is distinct from new.stage then
    insert into stage_history(lead_id, agent_id, from_stage, to_stage)
    values(new.id, new.agent_id, old.stage, new.stage);
  end if;
  return new;
end;
$$;

create trigger leads_stage_change
  after update on leads
  for each row execute function log_stage_change();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table agents       enable row level security;
alter table leads        enable row level security;
alter table stage_history enable row level security;

-- סוכן רואה רק את עצמו
create policy "agent_self" on agents
  for all using (auth.uid() = id);

-- סוכן רואה רק הלידים שלו
create policy "agent_own_leads" on leads
  for all using (auth.uid() = agent_id);

-- היסטוריה — כמו לידים
create policy "agent_own_history" on stage_history
  for all using (auth.uid() = agent_id);

-- ============================================
-- VIEW: סיכום ביצועים לכל סוכן
-- ============================================
create or replace view agent_performance as
select
  a.id,
  a.name,
  a.monthly_target,
  a.annual_target,
  count(l.id) filter (where l.stage = 'closed_won') as won_count,
  coalesce(sum(l.estimated_value) filter (where l.stage = 'closed_won'), 0) as won_value,
  coalesce(sum(l.estimated_value) filter (where l.stage = 'in_progress'), 0) as in_progress_value,
  count(l.id) filter (where l.stage not in ('closed_won','closed_lost')) as active_leads
from agents a
left join leads l on l.agent_id = a.id
  and date_trunc('month', l.updated_at) = date_trunc('month', now())
group by a.id, a.name, a.monthly_target, a.annual_target;
