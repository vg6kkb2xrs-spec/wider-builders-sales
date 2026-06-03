import { useState } from 'react'
import { stageInfo, STAGES, updateLeadStage, markContacted, addNote, updateLead } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : null

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function LeadCard({ lead, onUpdate, onSchedule }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    project_address: lead.project_address,
    client_name: lead.client_name,
    phone: lead.phone || '',
    estimated_value: lead.estimated_value || '',
    description: lead.description || '',
    stage: lead.stage,
  })

  const s = stageInfo(lead.stage)
  const days = daysSince(lead.last_contact_at || lead.updated_at)
  const isStale = days >= 7 && !['completed','closed_lost','frozen'].includes(lead.stage)
  const isFinal = ['completed','closed_lost'].includes(lead.stage)
  const amount = fmt(lead.estimated_value)

  const doStage = async (stage) => {
    setSaving(true)
    await updateLeadStage(lead.id, stage)
    setSaving(false)
    onUpdate()
  }

  const doEdit = async () => {
    setSaving(true)
    await updateLead(lead.id, {
      project_address: editForm.project_address,
      client_name: editForm.client_name,
      phone: editForm.phone,
      estimated_value: editForm.estimated_value ? Number(editForm.estimated_value) : null,
      description: editForm.description,
    })
    if (editForm.stage !== lead.stage) await updateLeadStage(lead.id, editForm.stage)
    setEditing(false)
    setSaving(false)
    onUpdate()
  }

  const doNote = async () => {
    if (!noteText.trim()) return
    await addNote(lead.id, noteText.trim())
    setNoteText('')
    setShowNote(false)
    onUpdate()
  }

  return (
    <div className="lead-card" style={{
      borderRight: isStale ? '3px solid #E24B4A' : `3px solid ${s.color}`,
    }}>
      {/* Header — always visible */}
      <div onClick={() => !editing && setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
        <div className="lead-header">
          <div style={{ flex: 1 }}>
            <div className="lead-address">{lead.project_address}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {lead.client_name}
              {amount && <span style={{ marginRight: 8, color: '#1D9E75', fontWeight: 500 }}>{amount}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
            <span className="stage-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
            {isStale
              ? <span style={{ fontSize: 11, color: '#E24B4A' }}>⚠️ {days} ימים ללא מגע</span>
              : days !== null && !isFinal && <span style={{ fontSize: 11, color: 'var(--text2)' }}>לפני {days} י׳</span>
            }
          </div>
        </div>
        {/* Quick info row */}
        <div className="lead-meta" style={{ marginTop: 4 }}>
          {lead.phone && <span>📞 {lead.phone}</span>}
          {lead.visit_datetime && (
            <span>📅 {new Date(lead.visit_datetime).toLocaleDateString('he-IL', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
          )}
          <span style={{ marginRight: 'auto', fontSize: 12, color: 'var(--text2)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {editing ? (
            <div>
              {[
                { k: 'project_address', l: 'כתובת הפרויקט' },
                { k: 'client_name', l: 'שם הלקוח' },
                { k: 'phone', l: 'טלפון' },
                { k: 'estimated_value', l: 'סכום משוער ($)', t: 'number' },
              ].map(f => (
                <div className="form-group" key={f.k}>
                  <label>{f.l}</label>
                  <input type={f.t||'text'} value={editForm[f.k]}
                    onChange={e => setEditForm(p => ({...p,[f.k]:e.target.value}))} />
                </div>
              ))}
              <div className="form-group">
                <label>תיאור</label>
                <textarea rows={2} value={editForm.description}
                  onChange={e => setEditForm(p => ({...p,description:e.target.value}))} />
              </div>
              <div className="form-group">
                <label>שלב</label>
                <select value={editForm.stage} onChange={e => setEditForm(p => ({...p,stage:e.target.value}))}>
                  {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-primary" style={{ flex:1 }} onClick={doEdit} disabled={saving}>
                  {saving ? 'שומר...' : 'שמור'}
                </button>
                <button className="btn-action" style={{ background:'#eee', color:'#333' }} onClick={() => setEditing(false)}>ביטול</button>
              </div>
            </div>
          ) : (
            <div>
              {lead.description && <div className="lead-desc">{lead.description}</div>}

              {/* Notes */}
              {lead.lead_notes?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {[...lead.lead_notes].reverse().map(n => (
                    <div key={n.id} style={{
                      fontSize: 13, background: 'var(--bg)', borderRadius: 8,
                      padding: '8px 10px', marginBottom: 6,
                      borderRight: n.content.startsWith('📋') ? '3px solid #185FA5' : '3px solid #1D9E75'
                    }}>
                      <div>{n.content}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 3 }}>
                        {new Date(n.created_at).toLocaleDateString('he-IL', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Note input */}
              {showNote ? (
                <div style={{ marginTop: 8 }}>
                  <textarea rows={2} placeholder="הוסף הערה..."
                    value={noteText} onChange={e => setNoteText(e.target.value)}
                    style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)',
                      background:'var(--bg)', color:'var(--text)', fontSize:14, fontFamily:'inherit', resize:'vertical' }}
                    autoFocus />
                  <div style={{ display:'flex', gap:8, marginTop:6 }}>
                    <button className="btn-primary" style={{ flex:1, padding:10 }} onClick={doNote}>שמור</button>
                    <button className="btn-action" style={{ background:'#eee', color:'#333' }} onClick={() => setShowNote(false)}>ביטול</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                  <button className="btn-action" style={{ fontSize:12 }} onClick={() => setEditing(true)}>✏️ ערוך</button>
                  <button className="btn-action" style={{ fontSize:12 }} onClick={() => setShowNote(true)}>📝 הערה</button>
                  {!isFinal && <button className="btn-action" style={{ fontSize:12 }} onClick={async () => { await markContacted(lead.id); onUpdate() }}>✅ יצרתי קשר</button>}
                </div>
              )}

              {/* Main CTA */}
              {!showNote && !isFinal && (
                <div style={{ marginTop: 10, display:'flex', flexDirection:'column', gap:8 }}>
                  {lead.stage === 'frozen' ? (
                    <button className="btn-primary" onClick={() => doStage('incoming_call')} disabled={saving}>🔥 הפשר ליד</button>
                  ) : (
                    <>
                      {/* Dynamic CTA based on stage */}
                      {s.ctaLabel && (
                        <button className="btn-primary" onClick={() => {
                          if (s.key === 'incoming_call') { onSchedule(lead) }
                          else doStage(s.ctaNext)
                        }} disabled={saving}>
                          {saving ? 'שומר...' : s.ctaLabel}
                        </button>
                      )}

                      {/* Schedule button always visible */}
                      {s.key !== 'incoming_call' && (
                        <button className="btn-action" style={{ background:'#E6F1FB', color:'#185FA5', fontSize:13 }}
                          onClick={() => onSchedule(lead)}>
                          📅 {lead.visit_datetime ? 'עדכן פגישה' : 'קבע פגישה'}
                        </button>
                      )}

                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn-action" style={{ flex:1, fontSize:12, background:'#F1EFE8', color:'#5F5E5A' }}
                          onClick={() => doStage('frozen')} disabled={saving}>🧊 הקפא</button>
                        <button className="btn-action" style={{ flex:1, fontSize:12, background:'#FCEBEB', color:'#A32D2D' }}
                          onClick={() => { if(confirm('לסמן כאבוד?')) doStage('closed_lost') }} disabled={saving}>✗ אבד</button>
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
