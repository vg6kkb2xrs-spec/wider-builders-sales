import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '—'

function isToday(dateStr) {
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

function isTomorrow(dateStr) {
  const tom = new Date()
  tom.setDate(tom.getDate() + 1)
  return new Date(dateStr).toDateString() === tom.toDateString()
}

function dayLabel(dateStr) {
  if (isToday(dateStr)) return '📅 היום'
  if (isTomorrow(dateStr)) return '📅 מחר'
  return new Date(dateStr).toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' })
}

function NoteModal({ lead, type, agentId, onClose, onSaved }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const prefix = type === 'prep' ? '📋 הכנה לפגישה' : '📝 סיכום פגישה'
  const placeholder = type === 'prep'
    ? 'מה לבדוק? מה להביא? דברים חשובים מהלקוח...'
    : 'מה עלה בפגישה? תמחור? מעוניין? שלב הבא?'

  const save = async () => {
    if (!text.trim()) return
    setSaving(true)
    await supabase.from('lead_notes').insert({
      lead_id: lead.id,
      agent_id: agentId,
      content: `${prefix}: ${text.trim()}`,
    })
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-header">
          <h2>{prefix}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="visit-address">📍 {lead.project_address}</div>
        <div className="visit-client" style={{ marginBottom: 16 }}>{lead.client_name}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
          📅 {new Date(lead.visit_datetime).toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })}
        </div>
        <div className="form-group">
          <label>{type === 'prep' ? 'הערות הכנה' : 'סיכום'}</label>
          <textarea
            rows={4}
            placeholder={placeholder}
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
          />
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </div>
  )
}

function MeetingCard({ lead, isManager, agentId, onNoteAdded }) {
  const [noteType, setNoteType] = useState(null)
  const [notes, setNotes] = useState([])
  const [showNotes, setShowNotes] = useState(false)

  const loadNotes = async () => {
    const { data } = await supabase
      .from('lead_notes')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
    setNotes(data || [])
  }

  const meetingNotes = notes.filter(n =>
    n.content.startsWith('📋 הכנה לפגישה') || n.content.startsWith('📝 סיכום פגישה')
  )

  return (
    <div
      className="lead-card"
      style={{
        margin: '8px 16px',
        borderRight: isToday(lead.visit_datetime) ? '3px solid #1D9E75' : undefined
      }}
    >
      {noteType && (
        <NoteModal
          lead={lead}
          type={noteType}
          agentId={agentId}
          onClose={() => setNoteType(null)}
          onSaved={() => { loadNotes(); onNoteAdded() }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="lead-address">{lead.project_address}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{lead.client_name}</div>
          {isManager && lead.agents?.name && (
            <div style={{ fontSize: 12, color: 'var(--teal)', marginTop: 2 }}>👤 {lead.agents.name}</div>
          )}
          {lead.phone && <div style={{ fontSize: 12, color: 'var(--text2)' }}>📞 {lead.phone}</div>}
        </div>
        <div style={{ textAlign: 'left', flexShrink: 0, marginRight: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
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

      {/* כפתורי הערות */}
      {!isManager && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            className="btn-action"
            style={{ flex: 1, fontSize: 12, background: '#E6F1FB', color: '#185FA5' }}
            onClick={() => { loadNotes(); setNoteType('prep') }}
          >
            📋 הכנה לפגישה
          </button>
          <button
            className="btn-action"
            style={{ flex: 1, fontSize: 12, background: '#EAF3DE', color: '#3B6D11' }}
            onClick={() => { loadNotes(); setNoteType('summary') }}
          >
            📝 סיכום פגישה
          </button>
        </div>
      )}

      {/* הצג הערות קיימות */}
      {!isManager && (
        <button
          style={{ fontSize: 12, color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 6, padding: 0 }}
          onClick={() => { if (!showNotes) loadNotes(); setShowNotes(s => !s) }}
        >
          {showNotes ? '▲ הסתר הערות' : '▼ הצג הערות'}
        </button>
      )}

      {showNotes && meetingNotes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {meetingNotes.map(n => (
            <div key={n.id} style={{
              fontSize: 13, background: 'var(--bg)', borderRadius: 8,
              padding: '8px 10px', marginBottom: 6,
              borderRight: n.content.startsWith('📋') ? '3px solid #185FA5' : '3px solid #3B6D11'
            }}>
              <div>{n.content}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>
                {new Date(n.created_at).toLocaleDateString('he-IL', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
      {showNotes && meetingNotes.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>אין הערות עדיין</div>
      )}
    </div>
  )
}

export default function MeetingsView({ agentId, isManager }) {
  const [meetings, setMeetings] = useState([])
  const [past, setPast] = useState([])
  const [showPast, setShowPast] = useState(false)

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

  // קיבוץ לפי יום
  const grouped = {}
  meetings.forEach(l => {
    const key = dayLabel(l.visit_datetime)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(l)
  })

  return (
    <div dir="rtl" style={{ paddingBottom: 100 }}>
      {meetings.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 40 }}>אין פגישות מתוכננות</div>
      )}

      {Object.entries(grouped).map(([day, leads]) => (
        <div key={day}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: day.includes('היום') ? '#0F6E56' : 'var(--teal)',
            padding: '10px 16px 6px',
            background: day.includes('היום') ? '#E1F5EE' : 'var(--bg)',
          }}>
            {day}
          </div>
          {leads.map(lead => (
            <MeetingCard
              key={lead.id}
              lead={lead}
              isManager={isManager}
              agentId={agentId}
              onNoteAdded={load}
            />
          ))}
        </div>
      ))}

      {past.length > 0 && (
        <div style={{ padding: '16px 16px 0' }}>
          <button
            className="btn-action"
            style={{ width: '100%', fontSize: 13 }}
            onClick={() => setShowPast(p => !p)}
          >
            {showPast ? '▲ הסתר פגישות קודמות' : `▼ פגישות קודמות (${past.length})`}
          </button>
          {showPast && past.slice().reverse().map(lead => (
            <MeetingCard
              key={lead.id}
              lead={lead}
              isManager={isManager}
              agentId={agentId}
              onNoteAdded={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}
