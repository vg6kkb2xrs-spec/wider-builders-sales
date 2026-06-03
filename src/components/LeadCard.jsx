import { useState } from 'react'
import { stageInfo, STAGES, updateLeadStage, markContacted, addNote, updateLead } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : null
const daysSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null

function DetailScreen({ lead, onBack, onUpdate, onSchedule }) {
  const [mode, setMode] = useState('view')
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
  const isFinal = ['completed','closed_lost'].includes(lead.stage)
  const isFrozen = lead.stage === 'frozen'
  const activeStages = ['incoming_call','in_progress','proposal_sent','closed_won','completed']
  const stageIdx = activeStages.indexOf(lead.stage)

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
    setMode('view')
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
    setMode('view')
    setSaving(false)
    onUpdate()
  }

  return (
    <div style={{ background:'var(--bg)', minHeight:'100dvh', display:'flex', flexDirection:'column', paddingBottom:62 }} dir="rtl">
      <div className="det-hero">
        <button className="back-btn" onClick={onBack}>‹</button>
        <div className="det-addr">{lead.project_address}</div>
        <div className="det-client">{lead.client_name}{lead.phone ? ` · ${lead.phone}` : ''}</div>
        <div className="stage-dots">
          {activeStages.map((k,i) => (
            <div key={k} className={`stage-dot ${i < stageIdx ? 'done' : i === stageIdx ? 'now' : ''}`}/>
          ))}
        </div>
        <div className="stage-name">{s.label}</div>
      </div>

      {/* Info */}
      <div className="info-table">
        {[
          { l:'סכום', v: fmt(lead.estimated_value) || '—', color: lead.estimated_value ? 'var(--green)' : undefined },
          { l:'פגישה', v: lead.visit_datetime ? new Date(lead.visit_datetime).toLocaleDateString('he-IL',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'לא נקבעה' },
          lead.description && { l:'תיאור', v: lead.description },
          { l:'עודכן', v: `לפני ${daysSince(lead.last_contact_at || lead.updated_at) || 0} ימים` },
        ].filter(Boolean).map(row => (
          <div key={row.l} className="info-row">
            <span className="info-lbl">{row.l}</span>
            <span className="info-val" style={row.color ? {color:row.color} : {}}>{row.v}</span>
          </div>
        ))}
      </div>

      <div style={{flex:1, paddingTop:4}}>
        {mode === 'view' && (
          <>
            {!isFinal && !isFrozen && s.ctaLabel && (
              <button className="cta-btn" onClick={() => s.key==='incoming_call' ? onSchedule(lead) : doStage(s.ctaNext)} disabled={saving}>
                {s.ctaLabel}
              </button>
            )}
            {!isFinal && !isFrozen && (
              <button className="cta-sec" onClick={() => onSchedule(lead)}>
                📅 {lead.visit_datetime ? 'עדכן פגישה' : 'קבע פגישה'}
              </button>
            )}
            {isFrozen && (
              <button className="cta-btn" onClick={() => doStage('incoming_call')}>🔥 הפשר ליד</button>
            )}

            <div className="action-grid">
              <button className="ag-btn" onClick={() => setMode('edit')}>✏️ ערוך</button>
              <button className="ag-btn" onClick={() => setMode('note')}>📝 הערה</button>
              {!isFinal && <button className="ag-btn" onClick={async () => { await markContacted(lead.id); onUpdate() }}>✅ יצרתי קשר</button>}
              {!isFinal && !isFrozen && <button className="ag-btn" onClick={() => doStage('frozen')}>🧊 הקפא</button>}
              {!isFinal && <button className="ag-btn danger" onClick={() => { if(confirm('לסמן כאבוד?')) doStage('closed_lost') }}>✗ אבד</button>}
            </div>

            {lead.lead_notes?.length > 0 && (
              <div style={{padding:'4px 0'}}>
                {[...lead.lead_notes].reverse().map(n => (
                  <div key={n.id} className={`note-card ${n.content.startsWith('📝') ? 'green-note' : ''}`}>
                    {n.content}
                    <div style={{fontSize:10,color:'var(--text2)',marginTop:4}}>
                      {new Date(n.created_at).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {mode === 'note' && (
          <div style={{padding:'12px'}}>
            <textarea rows={4} placeholder="הוסף הערה..." value={noteText}
              onChange={e => setNoteText(e.target.value)} autoFocus
              style={{width:'100%',padding:'12px',borderRadius:12,border:'.5px solid var(--border)',background:'var(--card)',color:'var(--text)',fontSize:14,fontFamily:'inherit',resize:'vertical'}}
            />
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="submit-btn" style={{flex:1}} onClick={doNote}>שמור</button>
              <button className="ag-btn" onClick={() => setMode('view')}>ביטול</button>
            </div>
          </div>
        )}

        {mode === 'edit' && (
          <div style={{padding:'12px'}}>
            {[
              {k:'project_address',l:'כתובת הפרויקט'},
              {k:'client_name',l:'שם הלקוח'},
              {k:'phone',l:'טלפון'},
              {k:'estimated_value',l:'סכום משוער ($)',t:'number'},
            ].map(f => (
              <div className="field" key={f.k}>
                <label>{f.l}</label>
                <input type={f.t||'text'} value={editForm[f.k]} onChange={e => setEditForm(p=>({...p,[f.k]:e.target.value}))}/>
              </div>
            ))}
            <div className="field">
              <label>תיאור</label>
              <textarea rows={2} value={editForm.description} onChange={e => setEditForm(p=>({...p,description:e.target.value}))}/>
            </div>
            <div className="field">
              <label>שלב</label>
              <select value={editForm.stage} onChange={e => setEditForm(p=>({...p,stage:e.target.value}))}>
                {STAGES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="submit-btn" style={{flex:1}} onClick={doEdit} disabled={saving}>{saving?'שומר...':'שמור'}</button>
              <button className="ag-btn" onClick={() => setMode('view')}>ביטול</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeadCard({ lead, onUpdate, onSchedule }) {
  const [open, setOpen] = useState(false)
  const s = stageInfo(lead.stage)
  const days = daysSince(lead.last_contact_at || lead.updated_at)
  const isStale = (days||0) >= 7 && !['completed','closed_lost','frozen'].includes(lead.stage)

  if (open) return (
    <div style={{position:'fixed',inset:0,zIndex:200,overflowY:'auto',background:'var(--bg)'}}>
      <DetailScreen lead={lead} onBack={() => setOpen(false)} onUpdate={onUpdate} onSchedule={onSchedule}/>
    </div>
  )

  return (
    <div className={`lead-card ${isStale ? 'urgent' : ''}`} onClick={() => setOpen(true)}>
      <div className="lead-row">
        <div style={{flex:1,minWidth:0}}>
          <div className="lead-addr">{lead.project_address}</div>
          <div className="lead-client">{lead.client_name}</div>
          {lead.estimated_value && <div className="lead-amount">${Number(lead.estimated_value).toLocaleString()}</div>}
          {lead.visit_datetime && (
            <div style={{fontSize:11,color:'#0F6E56',marginTop:3}}>
              📅 {new Date(lead.visit_datetime).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
            </div>
          )}
        </div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5}}>
          <span className="stage-pill" style={{background:s.bg,color:s.color}}>{s.label}</span>
          {isStale
            ? <span className="days-badge">⚠️ {days} ימים</span>
            : days !== null && <span style={{fontSize:10,color:'var(--text2)'}}>{days}י׳</span>
          }
        </div>
      </div>
    </div>
  )
}
