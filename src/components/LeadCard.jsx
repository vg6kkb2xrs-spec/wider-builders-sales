import { useState } from 'react'
import { stageInfo, STAGES, updateLeadStage, markContacted, addNote, updateLead } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : null
const daysSince = (d) => d ? Math.floor((Date.now()-new Date(d).getTime())/86400000) : null

const ACTIVE_STAGES = ['incoming_call','in_progress','proposal_sent','closed_won','completed']

function DetailScreen({ lead, onBack, onUpdate, onSchedule }) {
  const [mode, setMode] = useState('view')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    project_address: lead.project_address,
    client_name: lead.client_name,
    phone: lead.phone||'',
    estimated_value: lead.estimated_value||'',
    description: lead.description||'',
    stage: lead.stage,
  })

  const s = stageInfo(lead.stage)
  const isFinal = ['completed','closed_lost'].includes(lead.stage)
  const isFrozen = lead.stage === 'frozen'
  const stageIdx = ACTIVE_STAGES.indexOf(lead.stage)

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
    <div style={{background:'var(--bg)',minHeight:'100dvh',display:'flex',flexDirection:'column',paddingBottom:64}} dir="rtl">
      <div className="det-hero">
        <button className="back-btn" onClick={onBack}>
          <i className="ti ti-chevron-right" style={{fontSize:15}} aria-hidden="true"/>
          חזרה
        </button>
        <div className="det-addr">{lead.project_address}</div>
        <div className="det-info">{lead.client_name}{lead.phone ? ` · ${lead.phone}` : ''}</div>
        <div className="step-row">
          {ACTIVE_STAGES.map((k,i)=>(
            <div key={k} className={`step-dot ${i<stageIdx?'done':i===stageIdx?'curr':''}`}/>
          ))}
        </div>
        <div className="step-label">{s.label}</div>
      </div>

      <div className="det-body">
        <div className="info-card">
          <div className="info-row"><span className="info-lbl">סכום</span><span className={`info-val ${lead.estimated_value?'green':''}`}>{fmt(lead.estimated_value)||'—'}</span></div>
          <div className="info-row"><span className="info-lbl">פגישה</span><span className="info-val">{lead.visit_datetime ? new Date(lead.visit_datetime).toLocaleDateString('he-IL',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'לא נקבעה'}</span></div>
          {lead.description && <div className="info-row"><span className="info-lbl">תיאור</span><span className="info-val">{lead.description}</span></div>}
          <div className="info-row"><span className="info-lbl">עודכן</span><span className="info-val" style={{color:'var(--text2)'}}>לפני {daysSince(lead.last_contact_at||lead.updated_at)||0} ימים</span></div>
        </div>

        {mode === 'view' && <>
          {!isFinal && !isFrozen && s.ctaLabel && (
            <button className="cta-main" onClick={()=> s.key==='incoming_call' ? onSchedule(lead) : doStage(s.ctaNext)} disabled={saving}>
              {s.ctaLabel}
            </button>
          )}
          {!isFinal && !isFrozen && (
            <button className="cta-sub" onClick={()=>onSchedule(lead)}>
              📅 {lead.visit_datetime ? 'עדכן פגישה' : 'קבע פגישה'}
            </button>
          )}
          {isFrozen && <button className="cta-main" onClick={()=>doStage('incoming_call')}>🔥 הפשר ליד</button>}

          <div className="mini-grid">
            <button className="mini-btn" onClick={()=>setMode('edit')}>✏️ ערוך</button>
            <button className="mini-btn" onClick={()=>setMode('note')}>📝 הערה</button>
            {!isFinal && <button className="mini-btn" onClick={async()=>{await markContacted(lead.id);onUpdate()}}>✅ יצרתי קשר</button>}
            {!isFinal && !isFrozen && <button className="mini-btn" onClick={()=>doStage('frozen')}>🧊 הקפא</button>}
            {!isFinal && <button className="mini-btn red" onClick={()=>{if(confirm('לסמן כאבוד?'))doStage('closed_lost')}}>✗ אבד</button>}
          </div>

          {lead.lead_notes?.length > 0 && (
            <div style={{marginTop:4}}>
              {[...lead.lead_notes].reverse().map(n=>(
                <div key={n.id} className={`note-item ${n.content.startsWith('📝')?'green':''}`}>
                  {n.content}
                  <div style={{fontSize:10,color:'var(--text2)',marginTop:4}}>
                    {new Date(n.created_at).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>}

        {mode === 'note' && (
          <div style={{padding:'12px'}}>
            <textarea rows={4} placeholder="הוסף הערה..." value={noteText}
              onChange={e=>setNoteText(e.target.value)} autoFocus
              style={{width:'100%',padding:'12px',borderRadius:12,border:'.5px solid var(--border)',background:'var(--card)',color:'var(--text)',fontSize:14,fontFamily:'inherit',resize:'vertical',marginBottom:8}}
            />
            <div style={{display:'flex',gap:8}}>
              <button className="submit-btn" style={{flex:1,margin:0}} onClick={doNote}>שמור</button>
              <button className="mini-btn" style={{flex:'none',padding:'12px 16px'}} onClick={()=>setMode('view')}>ביטול</button>
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
            ].map(f=>(
              <div className="field" key={f.k}>
                <label>{f.l}</label>
                <input type={f.t||'text'} value={editForm[f.k]} onChange={e=>setEditForm(p=>({...p,[f.k]:e.target.value}))}/>
              </div>
            ))}
            <div className="field"><label>תיאור</label><textarea rows={2} value={editForm.description} onChange={e=>setEditForm(p=>({...p,description:e.target.value}))}/></div>
            <div className="field">
              <label>שלב</label>
              <select value={editForm.stage} onChange={e=>setEditForm(p=>({...p,stage:e.target.value}))}>
                {STAGES.map(st=><option key={st.key} value={st.key}>{st.label}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="submit-btn" style={{flex:1,margin:0}} onClick={doEdit} disabled={saving}>{saving?'שומר...':'שמור'}</button>
              <button className="mini-btn" style={{flex:'none',padding:'12px 16px'}} onClick={()=>setMode('view')}>ביטול</button>
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
  const days = daysSince(lead.last_contact_at||lead.updated_at)
  const isStale = (days||0)>=7 && !['completed','closed_lost','frozen'].includes(lead.stage)
  const amount = fmt(lead.estimated_value)

  if (open) return (
    <div style={{position:'fixed',inset:0,zIndex:200,overflowY:'auto',background:'var(--bg)'}}>
      <DetailScreen lead={lead} onBack={()=>setOpen(false)} onUpdate={onUpdate} onSchedule={onSchedule}/>
    </div>
  )

  return (
    <div className="lead-item" onClick={()=>setOpen(true)} style={isStale?{borderRight:'3px solid var(--red)',borderRadius:'0 16px 16px 0'}:{}}>
      <div style={{flex:1,minWidth:0}}>
        <div className="lead-addr">{lead.project_address}</div>
        <div className="lead-client">{lead.client_name}</div>
        {amount && <div className="lead-amount">{amount}</div>}
        {lead.visit_datetime && <div className="lead-visit">📅 {new Date(lead.visit_datetime).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>}
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0}}>
        <span className="stage-pill" style={{background:s.bg,color:s.color}}>{s.label}</span>
        {isStale ? <span className="days-txt">⚠️ {days}י׳</span>
          : days!==null && <span style={{fontSize:10,color:'var(--text2)'}}>{days}י׳</span>}
      </div>
    </div>
  )
}
