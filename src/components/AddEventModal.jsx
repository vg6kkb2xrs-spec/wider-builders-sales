import { useState, useEffect } from 'react'
import { supabase, addLog } from '../lib/supabase'

export default function AddEventModal({ agentId, defaultLeadId, defaultDate, onClose, onSaved }) {
  const [type, setType] = useState('meeting') // 'meeting' | 'task'
  const [title, setTitle] = useState('')
  const [leadId, setLeadId] = useState(defaultLeadId || '')
  const [leads, setLeads] = useState([])
  const [datetime, setDatetime] = useState(() => {
    const d = defaultDate ? new Date(defaultDate) : new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (defaultLeadId) return // already locked to a specific lead
    supabase.from('leads')
      .select('id, project_address, client_name')
      .eq('agent_id', agentId)
      .not('stage', 'in', '(completed,closed_lost)')
      .order('updated_at', { ascending: false })
      .then(({ data }) => setLeads(data || []))
  }, [])

  const lockedLead = defaultLeadId ? leads.find(l => l.id === defaultLeadId) : null

  const save = async () => {
    if (type === 'meeting') {
      if (!datetime) return setError('בחר תאריך ושעה')
      setSaving(true)
      try {
        if (leadId) {
          await supabase.from('leads').update({
            visit_datetime: new Date(datetime).toISOString(),
            last_contact_at: new Date().toISOString(),
          }).eq('id', leadId)
          const dateStr = new Date(datetime).toLocaleDateString('he-IL', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
          await addLog(leadId, 'נקבעה פגישה', dateStr)
        } else {
          await supabase.from('meetings').insert({
            title: title || 'פגישה כללית',
            agent_id: agentId,
            visit_datetime: new Date(datetime).toISOString(),
          })
        }
        onSaved()
      } catch (e) { setError(e.message) }
      finally { setSaving(false) }
    } else {
      // task
      if (!title.trim()) return setError('כתוב מה התזכורת')
      if (!datetime) return setError('בחר תאריך ושעה')
      setSaving(true)
      try {
        await supabase.from('tasks').insert({
          title: title.trim(),
          due_datetime: new Date(datetime).toISOString(),
          agent_id: agentId,
          lead_id: leadId || null,
        })
        if (leadId) {
          await addLog(leadId, 'נוספה תזכורת', title.trim())
        }
        onSaved()
      } catch (e) { setError(e.message) }
      finally { setSaving(false) }
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-head">
          <h2>הוסף ליומן</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* type picker */}
        <div style={{ display:'flex', background:'rgba(0,0,0,.03)', borderRadius:10, padding:3, marginBottom:14 }}>
          <button onClick={() => setType('meeting')}
            style={{ flex:1, padding:'9px', fontSize:13, fontWeight:600, border:'none', borderRadius:8, cursor:'pointer',
              background: type==='meeting' ? '#1D9E75' : 'none', color: type==='meeting' ? '#fff' : '#8E8E93' }}>
            📅 פגישה
          </button>
          <button onClick={() => setType('task')}
            style={{ flex:1, padding:'9px', fontSize:13, fontWeight:600, border:'none', borderRadius:8, cursor:'pointer',
              background: type==='task' ? '#185FA5' : 'none', color: type==='task' ? '#fff' : '#8E8E93' }}>
            ✓ משימה / תזכורת
          </button>
        </div>

        {/* lead link */}
        {lockedLead ? (
          <div className="field">
            <label>קשור לליד</label>
            <div style={{ padding:'11px 13px', borderRadius:10, background:'#F2F2F7', fontSize:14, color:'#1a1a1a' }}>
              {lockedLead.project_address} · {lockedLead.client_name}
            </div>
          </div>
        ) : (
          <div className="field">
            <label>קשר לליד קיים (אופציונלי)</label>
            <select value={leadId} onChange={e => setLeadId(e.target.value)}>
              <option value="">— {type === 'meeting' ? 'פגישה עצמאית' : 'תזכורת כללית'} —</option>
              {leads.map(l => (
                <option key={l.id} value={l.id}>{l.project_address} · {l.client_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* title - required for task, optional standalone-meeting title */}
        {(type === 'task' || (type === 'meeting' && !leadId)) && (
          <div className="field">
            <label>{type === 'task' ? 'מה התזכורת?' : 'כותרת הפגישה'}</label>
            <input
              placeholder={type === 'task' ? 'להתקשר לספק חיפוי...' : 'לדוגמה: ישיבת צוות'}
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className="field">
          <label>תאריך ושעה</label>
          <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} />
        </div>

        {error && <div className="field-error">{error}</div>}
        <button className="submit-btn" onClick={save} disabled={saving}>
          {saving ? 'שומר...' : type === 'meeting' ? '📅 הוסף פגישה' : '✓ הוסף תזכורת'}
        </button>
      </div>
    </div>
  )
}
