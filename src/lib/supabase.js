import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const STAGES = [
  {
    key: 'incoming_call',
    label: 'שיחה נכנסת',
    color: '#185FA5', bg: '#E6F1FB',
    next: 'in_progress',
    nextLabel: 'העבר לטיפול',
    ctaLabel: '📅 קבע ביקור',
    ctaNext: 'in_progress',
  },
  {
    key: 'in_progress',
    label: 'בטיפול',
    color: '#854F0B', bg: '#FAEEDA',
    next: 'proposal_sent',
    nextLabel: 'שלח למשרד להצעה',
    ctaLabel: '📋 שלח למשרד להצעה',
    ctaNext: 'proposal_sent',
  },
  {
    key: 'proposal_sent',
    label: 'מחכה לתשובה',
    color: '#534AB7', bg: '#EEEDFE',
    next: 'closed_won',
    nextLabel: 'הלקוח אישר — נסגר!',
    ctaLabel: '🎉 הלקוח אישר — נסגר!',
    ctaNext: 'closed_won',
  },
  {
    key: 'closed_won',
    label: 'עובדים אצלו',
    color: '#0F6E56', bg: '#E1F5EE',
    next: 'completed',
    nextLabel: 'סמן כהושלם',
    ctaLabel: '✅ סמן כהושלם + תשלום סופי',
    ctaNext: 'completed',
  },
  {
    key: 'completed',
    label: 'הושלם ✅',
    color: '#3B6D11', bg: '#EAF3DE',
  },
  {
    key: 'closed_lost',
    label: 'אבוד',
    color: '#A32D2D', bg: '#FCEBEB',
  },
  {
    key: 'frozen',
    label: '🧊 קפוא',
    color: '#5F5E5A', bg: '#F1EFE8',
  },
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
    .select().single()
  if (error) throw error
  return data
}

export async function updateLead(leadId, updates) {
  const { error } = await supabase.from('leads').update(updates).eq('id', leadId)
  if (error) throw error
}

export async function updateLeadStage(leadId, stage) {
  const updates = { stage, last_contact_at: new Date().toISOString() }
  if (stage === 'completed') updates.closed_at = new Date().toISOString()
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

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.events',
      redirectTo: window.location.origin,
    }
  })
  if (error) throw error
}


// ===== LOGS =====
export async function addLog(leadId, action, details = null) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('lead_logs').insert({
    lead_id: leadId,
    agent_id: user.id,
    action,
    details,
  })
}

export async function getLogs(leadId) {
  const { data } = await supabase
    .from('lead_logs')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
  return data || []
}
