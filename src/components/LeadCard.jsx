import { useState } from 'react'
import { stageInfo, STAGES, updateLeadStage, markContacted, addNote, updateLead } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '—'

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function LeadCard({ lead, onUpdate, onSchedule }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [editForm, setEditForm] = useState({
    project_address: lead.project_address,
    client_name: lead.client_name,
    phone: lead.phone || '',
    estimated_value: lead.estimated_value || '',
    description: lead.description || '',
    stage: lead.stage,
  })
  const [saving, setSaving] = useState(false)

  const s = stageInfo(lead.stage)
  const days = daysSince(lead.last_contact_at || lead.updated_at)
  const isStale = days >= 7 && !['closed_won','closed_lost','frozen'].includes(lead.stage)
  const isClosed = ['closed_won','closed_lost'].includes(lead.stage)

  const handleStageNext = async () => {
    if (!s.next) return
    setSaving(true)
    await updateLeadStage(lead.id, s.next)
    setSaving(false)
    onUpdate()
  }

  const handleStageLost = async () => {
    if (!confirm('לסמן ליד זה כאבוד?')) return
    setSaving(true)
    await updateLeadStage(lead.id, 'closed_lost')
    setSaving(false)
    onUpdate()
  }

  const handleFreeze = async () => {
    setSaving(true)
    await updateLeadStage(lead.id, 'frozen')
    setSaving(false)
    onUpdate()
  }

  const handleUnfreeze = async () => {
    setSaving(true)
    await updateLeadStage(lead.id, 'incoming_call')
    setSaving(false)
    onUpdate()
  }

  const handleContacted = async () => {
    await markContacted(lead.id)
    onUpdate()
  }

  const handleSaveNote = async () => {
    if (!noteText.trim()) return
    await addNote(lead.id, noteText.trim())
    setNoteText('')
    setShowNoteInput(false)
    onUpdate()
  }

  const handleSaveEdit = async () => {
    setSaving(true)
    await updateLead(lead.id, {
      project_address: editForm.project_address,
      client_name: editForm.client_name,
      phone: editForm.phone,
      estimated_value: editForm.estimated_value ? Number(editForm.estimated_value) : null,
      description: editForm.description,
    })
    if (editForm.stage !== lead.stage) {
      await updateLeadStage(lead.id, editForm.stage)
    }
    setEditing(false)
    setSaving(false)
    onUpdate()
  }

  return (
    <div className="lead-card" style={{ borderRight: isStale ? '3px solid #E24B4A' : undefined }}>
      
      {/* Header — תמיד מוצג */}
      <div onClick={() => !editing && setExpanded(e => !e)} style={{ cursor: editing ? 'default' : 'pointer' }}>
        <div className="lead-header">
          <div style={{ flex: 1 }}>
            <div className="lead-address">{lead.project_address}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{lead.client_name}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <span className="stage-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
            {isStale && <span style={{ fontSize: 11, color: '#E24B4A' }}>⚠️ {days}י ללא מגע</span>}
            {!isStale && days !== null && !isClosed && <span style={{ fontSize: 11, color: 'var(--text2)' }}>לפני {days}י</span>}
          </div>
        </div>
        <div className="lead-meta" style={{ marginTop: 4 }}>
          {lead.phone && <span>📞 {lead.phone}</span>}
          {lead.estimated_value && <span>💰 {fmt(lead.estimated_value)}</span>}
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ marginTop: 12 }}>
          
          {editing ? (
            /* מצב עריכה */
            <div>
              {[
                { key: 'project_address', label: 'כתובת הפרויקט' },
                { key: 'client_name',     label: 'שם הלקוח' },
                { key: 'phone',           label: 'טלפון' },
                { key: 'estimated_value', label: 'סכום משוער ($)', type: 'number' },
              ].map(f => (
                <div className="form-group" key={f.key}>
                  <label>{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    value={editForm[f.key]}
                    onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="form-group">
                <label>תיאור</label>
                <textarea rows={2} value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>שלב</label>
                <select value={editForm.stage} onChange={e => setEditForm(p => ({ ...p, stage: e.target.value }))}>
                  {STAGES.map(st => (
                    <option key={st.key} value={st.key}>{st.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveEdit} disabled={saving}>
                  {saving ? 'שומר...' : 'שמור שינויים'}
                </button>
                <button className="btn-action" style={{ background: '#eee', color: '#333' }} onClick={() => setEditing(false)}>ביטול</button>
              </div>
            </div>
          ) : (
            /* מצב תצוגה */
            <div>
              {lead.description && <div className="lead-desc">{lead.description}</div>}

              {/* הערות */}
              {lead.lead_notes?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {[...lead.lead_notes].reverse().map(n => (
                    <div key={n.id} style={{ fontSize: 13, background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, borderRight: '3px solid var(--teal)' }}>
                      <div>{n.content}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>
                        {new Date(n.created_at).toLocaleDateString('he-IL', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* קלט הערה */}
              {showNoteInput ? (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    rows={2}
                    placeholder="הוסף הערה..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:14, fontFamily:'inherit', resize:'vertical' }}
                    autoFocus
                  />
                  <div style={{ display:'flex', gap:8, marginTop:6 }}>
                    <button className="btn-primary" style={{ flex:1, padding:10 }} onClick={handleSaveNote}>שמור הערה</button>
                    <button className="btn-action" style={{ background:'#eee', color:'#333' }} onClick={() => setShowNoteInput(false)}>ביטול</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                  <button className="btn-action" style={{ fontSize:12 }} onClick={() => setEditing(true)}>✏️ ערוך</button>
                  <button className="btn-action" style={{ fontSize:12 }} onClick={() => setShowNoteInput(true)}>📝 הערה</button>
                  {!isClosed && (
                    <button className="btn-action" style={{ fontSize:12 }} onClick={handleContacted}>✅ יצרתי קשר</button>
                  )}
                </div>
              )}

              {/* כפתורי שלב */}
              {!showNoteInput && !isClosed && (
                <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8 }}>
                  {lead.stage === 'frozen' ? (
                    <button className="btn-primary" onClick={handleUnfreeze} disabled={saving}>🔥 הפשר ליד</button>
                  ) : (
                    <>
                      {s.next && (
                        <button className="btn-primary" onClick={handleStageNext} disabled={saving}>
                          {s.nextLabel} →
                        </button>
                      )}
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn-action" style={{ flex:1, fontSize:12, background:'#F1EFE8', color:'#5F5E5A' }} onClick={handleFreeze} disabled={saving}>
                          🧊 הקפא
                        </button>
                        <button className="btn-action" style={{ flex:1, fontSize:12, background:'#FCEBEB', color:'#A32D2D' }} onClick={handleStageLost} disabled={saving}>
                          ✗ אבד
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
