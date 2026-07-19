import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

/* Stage pills use only meaningful color: in-progress stages stay calm
   neutral, won/completed read as accent (positive), lost as alert.
   Values are CSS custom properties so they follow the theme tokens. */
export const STAGES = [
  {
    key: 'incoming_call',
    label: 'שיחה נכנסת',
    color: 'var(--ink2)', bg: 'var(--line2)',
    next: 'in_progress',
    nextLabel: 'העבר לטיפול',
    ctaLabel: 'קבע ביקור',
    ctaNext: 'in_progress',
  },
  {
    key: 'in_progress',
    label: 'בטיפול',
    color: 'var(--ink2)', bg: 'var(--line2)',
    next: 'proposal_sent',
    nextLabel: 'שלח למשרד להצעה',
    ctaLabel: 'שלח למשרד להצעה',
    ctaNext: 'proposal_sent',
  },
  {
    key: 'proposal_sent',
    label: 'מחכה לתשובה',
    color: 'var(--ink2)', bg: 'var(--line2)',
    next: 'closed_won',
    nextLabel: 'הלקוח אישר — נסגר!',
    ctaLabel: 'הלקוח אישר — נסגר!',
    ctaNext: 'closed_won',
  },
  {
    key: 'closed_won',
    label: 'עובדים אצלו',
    color: 'var(--accent-deep)', bg: 'var(--accent-soft)',
    next: 'completed',
    nextLabel: 'סמן כהושלם',
    ctaLabel: 'סמן כהושלם + תשלום סופי',
    ctaNext: 'completed',
  },
  {
    key: 'completed',
    label: 'הושלם',
    color: 'var(--accent-deep)', bg: 'var(--accent-soft)',
  },
  {
    key: 'closed_lost',
    label: 'אבוד',
    color: 'var(--alert-deep)', bg: 'var(--alert-soft)',
  },
  {
    key: 'frozen',
    label: 'קפוא',
    color: 'var(--ink3)', bg: 'var(--line2)',
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


// ===== TASKS =====
// due_datetime is optional: null = a plain to-do (list only), set = also shows on the calendar.
export async function getTasks() {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('tasks')
    .select('*, leads(project_address, client_name)')
    .eq('agent_id', user.id)
    .order('due_datetime', { ascending: true, nullsFirst: true })
  return data || []
}

// Open tasks for the home "today" strip: undated to-dos + anything due today or overdue.
export async function getTodayTasks() {
  const { data: { user } } = await supabase.auth.getUser()
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)
  const { data } = await supabase
    .from('tasks')
    .select('*, leads(project_address, client_name)')
    .eq('agent_id', user.id)
    .eq('done', false)
    .or(`due_datetime.is.null,due_datetime.lte.${endOfToday.toISOString()}`)
    .order('due_datetime', { ascending: true, nullsFirst: true })
  return data || []
}

// All tasks linked to a specific lead (for the lead detail screen).
export async function getTasksForLead(leadId) {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('lead_id', leadId)
    .order('done', { ascending: true })
    .order('due_datetime', { ascending: true, nullsFirst: true })
  return data || []
}

export async function addTask({ title, due_datetime = null, lead_id = null }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('tasks')
    .insert({ title, due_datetime, lead_id, agent_id: user.id })
    .select().single()
  if (error) throw error
  return data
}

export async function toggleTask(id, done) {
  await supabase.from('tasks').update({ done }).eq('id', id)
}

export async function deleteTask(id) {
  await supabase.from('tasks').delete().eq('id', id)
}



// ===== CASH FLOW =====
export async function getBankBalance() {
  const { data } = await supabase
    .from('bank_balance')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

export async function setBankBalance(amount) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('bank_balance').insert({ amount, updated_by: user.id })
}

export async function getCashflowEntries() {
  const { data } = await supabase
    .from('cashflow_entries')
    .select('*')
    .order('entry_date', { ascending: true })
  return data || []
}

export async function addCashflowEntry(entry) {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('cashflow_entries').insert({ ...entry, created_by: user.id })
}

export async function deleteCashflowEntry(id) {
  await supabase.from('cashflow_entries').delete().eq('id', id)
}

export async function updateCashflowEntry(id, entry) {
  await supabase.from('cashflow_entries').update(entry).eq('id', id)
}



// ===== RECEIPTS =====
export async function getReceipts() {
  const { data } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

export async function addReceipt(receipt) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('receipts')
    .insert({ ...receipt, uploaded_by: user.id })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteReceipt(id) {
  await supabase.from('receipts').delete().eq('id', id)
}

export async function updateReceipt(id, receipt) {
  await supabase.from('receipts').update(receipt).eq('id', id)
}

