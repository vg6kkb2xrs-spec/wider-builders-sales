import { useState } from 'react'
import { stageInfo, STAGES, updateLeadStage, markContacted, addNote, updateLead } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '—'

function daysSince(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
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

  const handleSkip = async () => {
    setSaving(true)
    await updateLeadStage(lead.id, s.skipTo)
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
      ...editForm,
      estimated_value: editForm.estimated_value ? Number(editForm.estimated_value) : null,
    })
    setEditing(false)
    setSaving(false)
    onUpdate()
  }

  return (
    <div className="lead-card" style={{ borderRight: isStale ? '3px solid #E24B4A' : s.next ? '' : '' }}>
      {/* Header */}
      <div className="lead-header" onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
        <div>
          <div className="lead-address">{lead.project_address}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{lead.client_name}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="stage-badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
          {isStale && <span style={{ fontSize: 11, color: '#E24B4A' }}>⚠️ {days} ימים ללא מגע</span>}
          {!isStale && days !== null && !isClosed && <span style={{ fontSize: 11, color: 'var(--text2)' }}>לפני {days} ימים</span>}
        </div>
      </div>

      {/* Quick info */}
      <div className="lead-meta" style={{ marginTop: 6 }}>
        {lead.phone && <span>📞 {lead.phone}</span>}
        {lead.estimated_value && <span>💰 {fmt(lead.estimated_value)}</span>}
        {lead.visit_datetime && <span>📅 {new Date(lead.visit_datetime).toLocaleDateString('he-IL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {editing ? (
            <div>
              {[
                { key: 'project_address', label: 'כתובת הפרויקט' },
                { key: 'client_name', label: 'שם הלקוח' },
                { key: 'phone', label: 'טלפון' },
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={handleSaveEdit} disabled={saving}>שמור</button>
                <button className="btn-action" style={{ background: '#eee', color: '#333' }} onClick={() => setEditing(false)}>ביטול</button>
              </div>
            </div>
          ) : (
            <div>
              {lead.description && <div className="lead-desc">{lead.description}</div>}

              {/* Notes */}
              {lead.lead_notes?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {lead.lead_notes.slice().reverse().map(n => (
                    <div key={n.id} style={{ fontSize: 13, background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', marginBottom: 6, borderRight: '3px solid var(--teal)' }}>
                      <div>{n.content}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                        {new Date(n.created_at).toLocaleDateString('he-IL', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Note input */}
              {showNoteInput ? (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    rows={2}
                    placeholder="הוסף הערה..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button className="btn-primary" style={{ flex: 1, padding: 10 }} onClick={handleSaveNote}>שמור הערה</button>
                    <button className="btn-action" style={{ background: '#eee', color: '#333' }} onClick={() => setShowNoteInput(false)}>ביטול</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="btn-action" style={{ fontSize: 12 }} onClick={() => setEditing(true)}>✏️ ערוך</button>
                  <button className="btn-action" style={{ fontSize: 12 }} onClick={() => setShowNoteInput(true)}>📝 הערה</button>
                  {!isClosed && <button className="btn-action" style={{ fontSize: 12 }} onClick={handleContacted}>✅ יצרתי קשר</button>}
                </div>
              )}
            </div>
          )}

          {/* Stage actions */}
          {!editing && !isClosed && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lead.stage === 'frozen' ? (
                <button className="btn-primary" onClick={handleUnfreeze} disabled={saving}>🔥 הפשר ליד</button>
              ) : (
                <>
                  {lead.stage === 'incoming_call' && (
                    <button className="btn-action" style={{ background: '#1D9E75', color: 'white', fontSize: 14 }} onClick={() => onSchedule(lead)}>
                      📅 קבע ביקור ← יומן
                    </button>
                  )}
                  {s.next && (
                    <button className="btn-primary" onClick={handleStageNext} disabled={saving}>
                      {s.nextLabel} →
                    </button>
                  )}
                  {s.skipTo && (
                    <button className="btn-action" style={{ fontSize: 13 }} onClick={handleSkip} disabled={saving}>
                      {s.skipLabel}
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-action" style={{ flex: 1, fontSize: 12, background: '#F1EFE8', color: '#5F5E5A' }} onClick={handleFreeze}>🧊 הקפא</button>
                    <button className="btn-action" style={{ flex: 1, fontSize: 12, background: '#FCEBEB', color: '#A32D2D' }} onClick={handleStageLost}>✗ אבד</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
