import { useState } from 'react'
import { stageInfo, STAGES, updateLeadStage, markContacted, addNote, updateLead } from '../lib/supabase'

const fmt=(n)=>n?`$${Number(n).toLocaleString()}`:null
const daysSince=(d)=>d?Math.floor((Date.now()-new Date(d).getTime())/86400000):null
const ACTIVE_STAGES=['incoming_call','in_progress','proposal_sent','closed_won','completed']

function DetailScreen({lead,onBack,onUpdate,onSchedule}){
  const [mode,setMode]=useState('view')
  const [noteText,setNoteText]=useState('')
  const [saving,setSaving]=useState(false)
  const [editForm,setEditForm]=useState({
    project_address:lead.project_address,client_name:lead.client_name,
    phone:lead.phone||'',estimated_value:lead.estimated_value||'',
    description:lead.description||'',stage:lead.stage,
  })

  const s=stageInfo(lead.stage)
  const isFinal=['completed','closed_lost'].includes(lead.stage)
  const isFrozen=lead.stage==='frozen'
  const idx=ACTIVE_STAGES.indexOf(lead.stage)

  const doStage=async(stage)=>{
    setSaving(true)
    await updateLeadStage(lead.id,stage)
    setSaving(false);onUpdate();onBack()
  }
  const doNote=async()=>{
    if(!noteText.trim())return
    await addNote(lead.id,noteText.trim())
    setNoteText('');setMode('view');onUpdate()
  }
  const doEdit=async()=>{
    setSaving(true)
    await updateLead(lead.id,{
      project_address:editForm.project_address,client_name:editForm.client_name,
      phone:editForm.phone,
      estimated_value:editForm.estimated_value?Number(editForm.estimated_value):null,
      description:editForm.description,
    })
    if(editForm.stage!==lead.stage)await updateLeadStage(lead.id,editForm.stage)
    setMode('view');setSaving(false);onUpdate()
  }

  return(
    <div style={{background:'#F2F2F7',minHeight:'100dvh',display:'flex',flexDirection:'column',paddingBottom:64}} dir="rtl">
      <div className="det-h">
        <button className="back-pill" onClick={onBack}>
          <i className="ti ti-chevron-right" style={{fontSize:13}} aria-hidden="true"/>
          חזרה
        </button>
        <div className="d-addr">{lead.project_address}</div>
        <div className="d-info">{lead.client_name}{lead.phone?` · ${lead.phone}`:''}</div>
        <div className="steps">
          {ACTIVE_STAGES.map((k,i)=>(
            <div key={k} className={`step ${i<idx?'d':i===idx?'c':''}`}/>
          ))}
        </div>
        <div className="step-lbl">{s.label}</div>
      </div>

      <div className="det-body">
        <div className="info-card">
          <div className="ir"><span className="il">סכום</span><span className={`iv ${lead.estimated_value?'g':''}`}>{fmt(lead.estimated_value)||'—'}</span></div>
          <div className="ir"><span className="il">פגישה</span><span className="iv">{lead.visit_datetime?new Date(lead.visit_datetime).toLocaleDateString('he-IL',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'לא נקבעה'}</span></div>
          {lead.description&&<div className="ir"><span className="il">תיאור</span><span className="iv">{lead.description}</span></div>}
          <div className="ir"><span className="il">עודכן</span><span className="iv" style={{color:'#8E8E93'}}>לפני {daysSince(lead.last_contact_at||lead.updated_at)||0} ימים</span></div>
        </div>

        {mode==='view'&&<>
          {!isFinal&&!isFrozen&&s.ctaLabel&&(
            <button className="cta" onClick={()=>s.key==='incoming_call'?onSchedule(lead):doStage(s.ctaNext)} disabled={saving}>
              {s.ctaLabel}
            </button>
          )}
          {!isFinal&&!isFrozen&&(
            <button className="cta2" onClick={()=>onSchedule(lead)}>
              📅 {lead.visit_datetime?'עדכן פגישה':'קבע פגישה'}
            </button>
          )}
          {isFrozen&&<button className="cta" onClick={()=>doStage('incoming_call')}>🔥 הפשר ליד</button>}

          <div className="mini-g">
            <button className="mb" onClick={()=>setMode('edit')}>✏️ ערוך</button>
            <button className="mb" onClick={()=>setMode('note')}>📝 הוסף הערה</button>
            {!isFinal&&<button className="mb" onClick={async()=>{await markContacted(lead.id);onUpdate()}}>✅ יצרתי קשר</button>}
            {!isFinal&&!isFrozen&&<button className="mb" onClick={()=>doStage('frozen')}>🧊 הקפא</button>}
            {!isFinal&&<button className="mb r" onClick={()=>{if(confirm('לסמן כאבוד?'))doStage('closed_lost')}}>✗ אבד</button>}
          </div>

          {lead.lead_notes?.length>0&&(
            <div style={{paddingTop:4}}>
              {[...lead.lead_notes].reverse().map(n=>(
                <div key={n.id} className={`note-item ${n.content.startsWith('📝')?'g':''}`}>
                  {n.content}
                  <div style={{fontSize:10,color:'#8E8E93',marginTop:4}}>
                    {new Date(n.created_at).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>}

        {mode==='note'&&(
          <div style={{padding:'10px'}}>
            <textarea rows={4} placeholder="הוסף הערה..." value={noteText}
              onChange={e=>setNoteText(e.target.value)} autoFocus
              style={{width:'100%',padding:'12px',borderRadius:12,border:'.5px solid #E5E5EA',background:'#fff',color:'#1a1a1a',fontSize:14,fontFamily:'inherit',resize:'vertical',marginBottom:8}}
            />
            <div style={{display:'flex',gap:8}}>
              <button className="submit-btn" style={{flex:1,margin:0}} onClick={doNote}>שמור</button>
              <button className="mb" style={{padding:'12px 16px'}} onClick={()=>setMode('view')}>ביטול</button>
            </div>
          </div>
        )}

        {mode==='edit'&&(
          <div style={{padding:'10px'}}>
            {[{k:'project_address',l:'כתובת הפרויקט'},{k:'client_name',l:'שם הלקוח'},{k:'phone',l:'טלפון'},{k:'estimated_value',l:'סכום משוער ($)',t:'number'}].map(f=>(
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
              <button className="mb" style={{padding:'12px 16px'}} onClick={()=>setMode('view')}>ביטול</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeadCard({lead,onUpdate,onSchedule}){
  const [open,setOpen]=useState(false)
  const s=stageInfo(lead.stage)
  const days=daysSince(lead.last_contact_at||lead.updated_at)
  const isStale=(days||0)>=7&&!['completed','closed_lost','frozen'].includes(lead.stage)

  if(open)return(
    <div style={{position:'fixed',inset:0,zIndex:200,overflowY:'auto',background:'#F2F2F7'}}>
      <DetailScreen lead={lead} onBack={()=>setOpen(false)} onUpdate={onUpdate} onSchedule={onSchedule}/>
    </div>
  )

  return(
    <div className={`lead-card ${isStale?'urgent':''}`} onClick={()=>setOpen(true)}>
      <div style={{flex:1,minWidth:0}}>
        <div className="l-addr">{lead.project_address}</div>
        <div className="l-client">{lead.client_name}</div>
        {lead.estimated_value&&<div className="l-amt">${Number(lead.estimated_value).toLocaleString()}</div>}
        {lead.visit_datetime&&<div className="l-visit">📅 {new Date(lead.visit_datetime).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>}
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:5,flexShrink:0}}>
        <span className="s-pill" style={{background:s.bg,color:s.color}}>{s.label}</span>
        {isStale?<span className="days-txt">⚠️ {days}י׳</span>:days!==null&&<span style={{fontSize:10,color:'#8E8E93'}}>{days}י׳</span>}
      </div>
    </div>
  )
}
