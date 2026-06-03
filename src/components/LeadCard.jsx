import { useState } from 'react'
import { stageInfo, STAGES, updateLeadStage, markContacted, addNote, updateLead } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : null

function daysSince(d) {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

function LeadDetail({ lead, onBack, onUpdate, onSchedule }) {
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [editing, setEditing] = useState(false)
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
  const isFinal = ['completed','closed_lost'].includes(lead.stage)
  const stageIndex = STAGES.findIndex(st => st.key === lead.stage)
  const activeStages = STAGES.filter(st => !['frozen','closed_lost'].includes(st.key))

  const doStage = async (stage) => {
    setSaving(true)
    await updateLeadStage(lead.id, stage)
    setSaving(false)
    onUpdate()
    onBack()
  }

  const doNote = async () => {
    if (!noteText.trim()) return
    await addNote(lead.id, noteText.trim())
    setNoteText('')
    setShowNoteInput(false)
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

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }} dir="rtl">
      {/* Header */}
      <div style={{ background: '#1D9E75', padding: '44px 16px 16px', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <button
            onClick={onBack}
            style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, width: 32, height: 32, color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{lead.project_address}</div>
            <div style={{ fontSize: 13, opacity: .85, marginTop: 2 }}>
              {lead.client_name}{lead.phone ? ` · 📞 ${lead.phone}` : ''}
            </div>
          </div>
        </div>

        {/* Stage progress bar */}
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            {activeStages.slice(0, 5).map((st, i) => (
              <div key={st.key} style={{
                flex: 1, height: 5, borderRadius: 3,
                background: i <= stageIndex ? 'white' : 'rgba(255,255,255,.3)',
                transition: 'background .3s'
              }}/>
            ))}
          </div>
          <div style={{ fontSize: 12, opacity: .85, fontWeight: 500 }}>{s.label}</div>
        </div>
      </div>

      {/* Info box */}
      <div style={{ background: 'white', borderBottom: '.5px solid var(--border)', padding: '12px 16px' }}>
        {[
          { l: 'סכום משוער', v: fmt(lead.estimated_value) || '—', color: lead.estimated_value ? '#1D9E75' : undefined },
          { l: 'פגישה', v: lead.visit_datetime ? new Date(lead.visit_datetime).toLocaleDateString('he-IL',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'לא נקבעה' },
          { l: 'תיאור', v: lead.description || '—' },
          { l: 'עודכן', v: `לפני ${daysSince(lead.last_contact_at || lead.updated_at) || 0} ימים` },
        ].map(row => (
          <div key={row.l} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:13, borderBottom:'.5px solid var(--border)' }}>
            <span style={{ color:'var(--text2)' }}>{row.l}</span>
            <span style={{ fontWeight:500, color:row.color || 'var(--text)', textAlign:'left', maxWidth:'60%' }}>{row.v}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Editing form */}
        {editing ? (
          <div>
            {[
              {k:'project_address',l:'כתובת הפרויקט'},
              {k:'client_name',l:'שם הלקוח'},
              {k:'phone',l:'טלפון'},
              {k:'estimated_value',l:'סכום משוער ($)',t:'number'},
            ].map(f => (
              <div className="form-group" key={f.k}>
                <label>{f.l}</label>
                <input type={f.t||'text'} value={editForm[f.k]} onChange={e => setEditForm(p=>({...p,[f.k]:e.target.value}))}/>
              </div>
            ))}
            <div className="form-group">
              <label>תיאור</label>
              <textarea rows={2} value={editForm.description} onChange={e => setEditForm(p=>({...p,description:e.target.value}))}/>
            </div>
            <div className="form-group">
              <label>שלב</label>
              <select value={editForm.stage} onChange={e => setEditForm(p=>({...p,stage:e.target.value}))}>
                {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn-primary" style={{flex:1}} onClick={doEdit} disabled={saving}>{saving?'שומר...':'שמור'}</button>
              <button className="btn-action" style={{background:'#eee',color:'#333'}} onClick={() => setEditing(false)}>ביטול</button>
            </div>
          </div>
        ) : (
          <>
            {/* Main CTA */}
            {!isFinal && lead.stage !== 'frozen' && s.ctaLabel && (
              <button
                style={{ background:'#1D9E75', color:'white', border:'none', borderRadius:12, padding:'14px 16px', fontSize:15, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                onClick={() => {
                  if (s.key === 'incoming_call') onSchedule(lead)
                  else doStage(s.ctaNext)
                }}
                disabled={saving}
              >
                {s.ctaLabel}
              </button>
            )}

            {/* Schedule button */}
            {!isFinal && lead.stage !== 'frozen' && (
              <button
                style={{ background:'#E6F1FB', color:'#185FA5', border:'.5px solid #B5D4F4', borderRadius:12, padding:'12px 16px', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                onClick={() => onSchedule(lead)}
              >
                📅 {lead.visit_datetime ? 'עדכן פגישה' : 'קבע פגישה'}
              </button>
            )}

            {/* Frozen */}
            {lead.stage === 'frozen' && (
              <button className="btn-primary" onClick={() => doStage('incoming_call')}>🔥 הפשר ליד</button>
            )}

            {/* Secondary actions */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
              {[
                {label:'✏️ ערוך', action: () => setEditing(true)},
                {label:'📝 הערה', action: () => setShowNoteInput(true)},
                {label:'✅ קשר', action: async () => { await markContacted(lead.id); onUpdate() }, hide: isFinal},
                {label:'🧊 הקפא', action: () => doStage('frozen'), hide: isFinal || lead.stage==='frozen'},
              ].filter(a => !a.hide).map(a => (
                <button key={a.label}
                  style={{ background:'var(--bg)', border:'.5px solid var(--border)', borderRadius:10, padding:'10px 4px', fontSize:12, color:'var(--text2)', cursor:'pointer', textAlign:'center' }}
                  onClick={a.action}
                >{a.label}</button>
              ))}
              {!isFinal && (
                <button
                  style={{ background:'#FCEBEB', border:'.5px solid #F7C1C1', borderRadius:10, padding:'10px 4px', fontSize:12, color:'#A32D2D', cursor:'pointer', textAlign:'center' }}
                  onClick={() => { if(confirm('לסמן כאבוד?')) doStage('closed_lost') }}
                >✗ אבד</button>
              )}
            </div>

            {/* Note input */}
            {showNoteInput && (
              <div style={{ background:'var(--card)', borderRadius:12, padding:14, border:'.5px solid var(--border)' }}>
                <textarea rows={3} placeholder="הוסף הערה..." value={noteText}
                  onChange={e => setNoteText(e.target.value)} autoFocus
                  style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:14, fontFamily:'inherit', resize:'vertical' }}
                />
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <button className="btn-primary" style={{ flex:1, padding:10 }} onClick={doNote}>שמור</button>
                  <button className="btn-action" onClick={() => setShowNoteInput(false)}>ביטול</button>
                </div>
              </div>
            )}

            {/* Notes */}
            {lead.lead_notes?.length > 0 && (
              <div>
                {[...lead.lead_notes].reverse().map(n => (
                  <div key={n.id} style={{
                    fontSize:13, background:'var(--bg)', borderRadius:10,
                    padding:'10px 12px', marginBottom:6,
                    borderRight: n.content.startsWith('📋') ? '3px solid #185FA5' : '3px solid #1D9E75'
                  }}>
                    <div>{n.content}</div>
                    <div style={{ fontSize:11, color:'var(--text2)', marginTop:4 }}>
                      {new Date(n.created_at).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function LeadCard({ lead, onUpdate, onSchedule }) {
  const [open, setOpen] = useState(false)
  const s = stageInfo(lead.stage)
  const days = daysSince(lead.last_contact_at || lead.updated_at)
  const isStale = days >= 7 && !['completed','closed_lost','frozen'].includes(lead.stage)

  if (open) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:200, overflowY:'auto', background:'var(--bg)' }}>
        <LeadDetail
          lead={lead}
          onBack={() => setOpen(false)}
          onUpdate={onUpdate}
          onSchedule={onSchedule}
        />
      </div>
    )
  }

  return (
    <div
      onClick={() => setOpen(true)}
      style={{
        background: 'var(--card)',
        borderRadius: 12,
        padding: '12px 14px',
        border: isStale ? '.5px solid #F7C1C1' : '.5px solid var(--border)',
        borderRight: isStale ? '4px solid #E24B4A' : `4px solid ${s.color}`,
        cursor: 'pointer',
        transition: 'opacity .15s',
      }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {lead.project_address}
          </div>
          <div style={{ fontSize:12, color:'var(--text2)', marginTop:3 }}>
            {lead.client_name}
            {lead.estimated_value && <span style={{ color:'#1D9E75', fontWeight:500, marginRight:8 }}> ${Number(lead.estimated_value).toLocaleString()}</span>}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
          <span style={{ fontSize:11, padding:'3px 9px', borderRadius:20, background:s.bg, color:s.color, whiteSpace:'nowrap' }}>
            {s.label}
          </span>
          {isStale
            ? <span style={{ fontSize:10, color:'#A32D2D' }}>⚠️ {days} ימים</span>
            : days !== null && <span style={{ fontSize:10, color:'var(--text2)' }}>לפני {days}י׳</span>
          }
        </div>
      </div>
      {lead.visit_datetime && (
        <div style={{ fontSize:11, color:'#0F6E56', marginTop:5 }}>
          📅 {new Date(lead.visit_datetime).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
        </div>
      )}
    </div>
  )
}
