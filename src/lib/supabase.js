import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const STAGES = [
  { key: 'incoming_call',   label: 'שיחה נכנסת',     color: '#185FA5', bg: '#E6F1FB', next: 'visit_scheduled', nextLabel: 'קבע ביקור', skipTo: 'proposal_sent', skipLabel: 'דלג לתמחור' },
  { key: 'visit_scheduled', label: 'ביקור מתוכנן',    color: '#854F0B', bg: '#FAEEDA', next: 'proposal_sent',   nextLabel: 'שלח למשרד להצעה' },
  { key: 'proposal_sent',   label: 'הצעה הוגשה',      color: '#534AB7', bg: '#EEEDFE', next: 'negotiation',     nextLabel: 'התחל מו"מ' },
  { key: 'negotiation',     label: 'במשא ומתן',        color: '#993C1D', bg: '#FAECE7', next: 'closed_won',      nextLabel: '🎉 נסגר! קבל מקדמה' },
  { key: 'in_progress',     label: 'בביצוע',           color: '#0F6E56', bg: '#E1F5EE' },
  { key: 'closed_won',      label: 'בוצע ✅',          color: '#3B6D11', bg: '#EAF3DE' },
  { key: 'closed_lost',     label: 'אבוד',             color: '#A32D2D', bg: '#FCEBEB' },
  { key: 'frozen',          label: '🧊 קפוא',          color: '#5F5E5A', bg: '#F1EFE8' },
]

export const stageInfo = (key) => STAGES.find(s => s.key === key) || STAGES[0]

export async function getMyLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*, lead_notes(id, content, created_at)')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addLead(lead) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('leads')
    .insert({ ...lead, agent_id: user.id, last_contact_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLead(leadId, updates) {
  const { error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', leadId)
  if (error) throw error
}

export async function updateLeadStage(leadId, stage) {
  const updates = { stage, last_contact_at: new Date().toISOString() }
  if (stage === 'closed_won') updates.closed_at = new Date().toISOString()
  const { error } = await supabase.from('leads').update(updates).eq('id', leadId)
  if (error) throw error
}

export async function markContacted(leadId) {
  const { error } = await supabase
    .from('leads')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', leadId)
  if (error) throw error
}

export async function addNote(leadId, content) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('lead_notes')
    .insert({ lead_id: leadId, agent_id: user.id, content })
  if (error) throw error
}

export async function getMyPerformance() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('agent_performance')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) throw error
  return data
}

export async function updateLeadCalendar(leadId, eventId, visitDatetime) {
  const { error } = await supabase
    .from('leads')
    .update({ calendar_event_id: eventId, visit_datetime: visitDatetime })
    .eq('id', leadId)
  if (error) throw error
}

const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { scopes: GCAL_SCOPE, redirectTo: window.location.origin }
  })
  if (error) throw error
}

export async function createCalendarEvent(lead, datetime) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.provider_token
  if (!token) throw new Error('אין Google token')
  const start = new Date(datetime)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const event = {
    summary: lead.project_address,
    description: [`לקוח: ${lead.client_name}`, `טלפון: ${lead.phone || '—'}`, `תיאור: ${lead.description || '—'}`, `סכום משוער: $${(lead.estimated_value || 0).toLocaleString()}`].join('\n'),
    location: lead.project_address,
    start: { dateTime: start.toISOString(), timeZone: 'America/New_York' },
    end: { dateTime: end.toISOString(), timeZone: 'America/New_York' },
  }
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  })
  if (!res.ok) throw new Error('שגיאה ביצירת אירוע')
  return await res.json()
}
