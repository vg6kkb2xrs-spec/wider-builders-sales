import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '—'

function groupByDay(leads) {
  const groups = {}
  leads.forEach(l => {
    const d = new Date(l.visit_datetime)
    const key = d.toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' })
    if (!groups[key]) groups[key] = []
    groups[key].push(l)
  })
  return groups
}

function isToday(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

function isTomorrow(dateStr) {
  const d = new Date(dateStr)
  const tom = new Date()
  tom.setDate(tom.getDate() + 1)
  return d.toDateString() === tom.toDateString()
}

function dayLabel(dateStr) {
  if (isToday(dateStr)) return '📅 היום'
  if (isTomorrow(dateStr)) return '📅 מחר'
  return new Date(dateStr).toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' })
}

export default function MeetingsView({ agentId, isManager }) {
  const [meetings, setMeetings] = useState([])
  const [past, setPast] = useState([])
  const [showPast, setShowPast] = useState(false)
  const [summaryLead, setSummaryLead] = useState(null)
  const [summaryText, setSummaryText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    let query = supabase
      .from('leads')
      .select(isManager ? '*, agents(name)' : '*')
      .not('visit_datetime', 'is', null)
      .order('visit_datetime', { ascending: true })

    if (!isManager) {
      query = query.eq('agent_id', agentId)
    }

    const { data } = await query
    const now = new Date()
    setMeetings((data || []).filter(l => new Date(l.visit_datetime) >= now))
    setPast((data || []).filter(l => new Date(l.visit_datetime) < now))
  }

  useEffect(() => { load() }, [])

  const saveSummary = async () => {
    if (!summaryText.trim()) return
    setSaving(true)
    await supabase.from('lead_notes').insert({
      lead_id: summaryLead.id,
      agent_id: agentId,
      content: `📝 סיכום פגישה: ${summaryText.trim()}`,
    })
    setSummaryLead(null)
    setSummaryText('')
    setSaving(false)
    load()
  }

  const grouped = {}
  meetings.forEach(l => {
    const key = dayLabel(l.visit_datetime)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(l)
  })

  return (
    <div dir="rtl">
      {summaryLead && (
        <div className="modal-overlay" onClick={() => setSummaryLead(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="modal-header">
              <h2>סיכום פגישה</h2>
              <button className="btn-icon" onClick={() => setSummaryLead(null)}>✕</button>
            </div>
            <div className="visit-address">📍 {summaryLead.project_address}</div>
            <div className="visit-client" style={{ marginBottom: 16 }}>{summaryLead.client_name}</div>
            <div className="form-group">
              <label>סיכום הפגישה</label>
              <textarea
                rows={4}
                placeholder="מה עלה בפגישה? תמחור? לקוח מעוניין? שלב הבא?"
                value={summaryText}
                onChange={e => setSummaryText(e.target.value)}
                autoFocus
              />
            </div>
            <button className="btn-primary" onClick={saveSummary} disabled={saving}>
              {saving ? 'שומר...' : 'שמור סיכום'}
            </button>
          </div>
        </div>
      )}

      {meetings.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 40 }}>אין פגישות מתוכננות</div>
      )}

      {Object.entries(grouped).map(([day, leads]) => (
        <div key={day} style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--teal)',
            padding: '8px 16px', background: 'var(--color-background-secondary)',
            borderBottom: '1px solid var(--color-border-tertiary)'
          }}>
            {day}
          </div>
          {leads.map(lead => (
            <div key={lead.id} className="lead-card" style={{ margin: '8px 16px', borderRight: isToday(lead.visit_datetime) ? '3px solid #1D9E75' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="lead-address">{lead.project_address}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{lead.client_name}</div>
                  {isManager && lead.agents?.name && (
                    <div style={{ fontSize: 12, color: 'var(--teal)', marginTop: 2 }}>👤 {lead.agents.name}</div>
                  )}
                </div>
                <div style={{ textAlign: 'left', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                    {new Date(lead.visit_datetime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {lead.estimated_value && (
                    <div style={{ fontSize: 12, color: 'var(--text2)' }}>{fmt(lead.estimated_value)}</div>
                  )}
                </div>
              </div>
              {lead.description && (
                <div className="lead-desc" style={{ marginTop: 6 }}>{lead.description}</div>
              )}
              {!isManager && (
                <button
                  className="btn-action"
                  style={{ marginTop: 10, fontSize: 12, width: '100%' }}
                  onClick={() => { setSummaryLead(lead); setSummaryText('') }}
                >
                  📝 כתוב סיכום פגישה
                </button>
              )}
            </div>
          ))}
        </div>
      ))}

      {past.length > 0 && (
        <div style={{ padding: '0 16px 20px' }}>
          <button
            className="btn-action"
            style={{ width: '100%', fontSize: 13 }}
            onClick={() => setShowPast(p => !p)}
          >
            {showPast ? '▲ הסתר' : `▼ פגישות קודמות (${past.length})`}
          </button>
          {showPast && past.slice().reverse().map(lead => (
            <div key={lead.id} className="lead-card" style={{ margin: '8px 0', opacity: 0.7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div className="lead-address" style={{ fontSize: 14 }}>{lead.project_address}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>{lead.client_name}</div>
                  {isManager && lead.agents?.name && (
                    <div style={{ fontSize: 12, color: 'var(--teal)' }}>👤 {lead.agents.name}</div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'left' }}>
                  {new Date(lead.visit_datetime).toLocaleDateString('he-IL', { day:'numeric', month:'short' })}
                  {' '}
                  {new Date(lead.visit_datetime).toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
              {!isManager && (
                <button
                  className="btn-action"
                  style={{ marginTop: 8, fontSize: 12, width: '100%' }}
                  onClick={() => { setSummaryLead(lead); setSummaryText('') }}
                >
                  📝 כתוב סיכום
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
