import { useState, useEffect } from 'react'
import { stageInfo, STAGES, updateLeadStage, markContacted, addNote, updateLead, addLog, getLogs, getTasksForLead, addTask, toggleTask } from '../lib/supabase'
import Icon from './Icon'
import { TaskItem, QuickAddTask } from './Tasks'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : null
const daysSince = (d) => d ? Math.floor((Date.now()-new Date(d).getTime())/86400000) : null

const PIPELINE = ['incoming_call','in_progress','proposal_sent','closed_won','completed']
const PIPELINE_LABELS = {
  incoming_call: 'שיחה נכנסת',
  in_progress: 'בטיפול',
  proposal_sent: 'מחכה לתשובה',
  closed_won: 'עובדים אצלו',
  completed: 'הושלם',
}
const SPECIAL_STAGES = {
  frozen: { label: 'קפוא', color: 'var(--ink3)', bg: 'var(--line2)' },
  closed_lost: { label: 'אבוד', color: 'var(--alert-deep)', bg: 'var(--alert-soft)' },
}

function StageBar({ currentStage, onStageChange, saving }) {
  const currentIdx = PIPELINE.indexOf(currentStage)
  const isSpecial = ['closed_lost','frozen'].includes(currentStage)
  const special = SPECIAL_STAGES[currentStage]
  const n = PIPELINE.length
  const pct = n > 1 ? (currentIdx / (n - 1)) * 100 : 0

  return (
    <div style={{padding:'18px 14px 14px',background:'var(--card)',borderBottom:'1px solid var(--line)'}}>
      <div style={{fontFamily:'var(--mono)',fontSize:10,fontWeight:600,color:'var(--ink3)',letterSpacing:1.2,textTransform:'uppercase',marginBottom:16}}>
        שינוי שלב
      </div>
      {isSpecial && (
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <span style={{fontSize:13,fontWeight:700,color:special?.color,background:special?.bg,padding:'4px 14px',borderRadius:20}}>
            {special?.label}
          </span>
          <button onClick={()=>onStageChange('incoming_call')}
            style={{fontSize:12,color:'var(--accent-deep)',background:'var(--accent-soft)',border:'none',borderRadius:20,padding:'6px 13px',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>
            חזור לפעיל
          </button>
        </div>
      )}
      <div style={{position:'relative',display:'flex',alignItems:'flex-start',paddingBottom:4}}>
        <div style={{position:'absolute',top:10,right:'10px',left:'10px',height:2,background:'var(--line)',zIndex:0}}/>
        <div style={{position:'absolute',top:10,right:'10px',left:'10px',height:2,background:'var(--accent)',zIndex:0,
          width:`calc(${pct}% * (100% - 20px) / 100)`,transition:'width .3s',maxWidth:'calc(100% - 20px)'}}/>
        {PIPELINE.map((key,i)=>{
          const isCurrent=i===currentIdx, isDone=i<currentIdx
          return(
            <div key={key} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',zIndex:1}}>
              <button onClick={()=>!saving&&!isCurrent&&onStageChange(key)} disabled={saving}
                style={{width:22,height:22,borderRadius:'50%',border:'none',padding:0,
                  background:isDone||isCurrent?'var(--accent)':'var(--line)',
                  cursor:!isCurrent?'pointer':'default',
                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                  boxShadow:isCurrent?'0 0 0 4px var(--accent-soft)':'none'}}>
                {isDone&&<Icon name="check" size={12} style={{stroke:'#fff',strokeWidth:2.6}}/>}
                {isCurrent&&<span style={{width:7,height:7,borderRadius:'50%',background:'#fff',display:'block'}}/>}
              </button>
              <div style={{fontSize:9.5,marginTop:6,textAlign:'center',lineHeight:1.25,maxWidth:54,
                color:isCurrent||isDone?'var(--accent-deep)':'var(--ink3)',fontWeight:isCurrent?700:400}}>
                {PIPELINE_LABELS[key]}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DetailScreen({ lead, onBack, onUpdate, onSchedule }) {
  const [mode, setMode] = useState('view')
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [logs, setLogs] = useState([])
  const [showLogs, setShowLogs] = useState(true)
  const [tasks, setTasks] = useState([])
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
  const idx = PIPELINE.indexOf(lead.stage)

  useEffect(() => {
    getLogs(lead.id).then(setLogs)
    getTasksForLead(lead.id).then(setTasks)
  }, [lead.id])

  const refreshLogs = () => getLogs(lead.id).then(setLogs)
  const refreshTasks = () => getTasksForLead(lead.id).then(setTasks)

  const addLeadTask = async ({ title, due_datetime }) => {
    await addTask({ title, due_datetime, lead_id: lead.id })
    await addLog(lead.id, 'נוספה משימה', title)
    refreshTasks(); refreshLogs(); onUpdate()
  }
  const toggleLeadTask = async (task) => {
    await toggleTask(task.id, !task.done)
    refreshTasks()
  }

  const doStage = async (stage) => {
    setSaving(true)
    const oldLabel = stageInfo(lead.stage).label
    const newLabel = stageInfo(stage).label
    await updateLeadStage(lead.id, stage)
    await addLog(lead.id, 'שינוי שלב', `${oldLabel} ← ${newLabel}`)
    setSaving(false)
    onUpdate()
    onBack()
  }

  const doNote = async () => {
    if (!noteText.trim()) return
    await addNote(lead.id, noteText.trim())
    setNoteText(''); setMode('view'); onUpdate()
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
    if (editForm.stage !== lead.stage) await doStage(editForm.stage)
    setMode('view'); setSaving(false); onUpdate()
  }

  const showToast = (msg) => {
    const t = document.createElement('div')
    t.textContent = msg
    t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--accent);color:white;padding:11px 20px;border-radius:20px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 8px 24px -8px rgba(43,41,37,.4)'
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 2500)
  }

  return (
    <div style={{ background: 'var(--surface)', minHeight: '100dvh', display: 'flex', flexDirection: 'column', paddingBottom: 64, overflowX: 'hidden', width: '100%' }} dir="rtl">
      {/* Header */}
      <div className="det-h">
        <button className="back-pill" onClick={onBack}>
          <Icon name="chevron" size={13}/>
          חזרה
        </button>
        <div className="d-addr">{lead.project_address}</div>
        <div className="d-info">{lead.client_name}{lead.phone ? ` · ${lead.phone}` : ''}</div>
      </div>

      {/* Stage Bar */}
      <StageBar
        currentStage={lead.stage}
        onStageChange={async (stage) => {
          setSaving(true)
          const oldLabel = stageInfo(lead.stage).label
          const newLabel = stageInfo(stage).label
          await updateLeadStage(lead.id, stage)
          await addLog(lead.id, 'שינוי שלב', `${oldLabel} ← ${newLabel}`)
          setSaving(false)
          refreshLogs()
          onUpdate()
          showToast(`✓ עבר ל${newLabel}`)
          // Update lead locally
          lead.stage = stage
        }}
        saving={saving}
      />

      {/* Info */}
      <div className="det-body">
        <div className="info-card">
          <div className="ir"><span className="il">סכום</span><span className={`iv ${lead.estimated_value?'g':''}`}>{fmt(lead.estimated_value)||'—'}</span></div>
          <div className="ir"><span className="il">שלב</span><span className="iv">{s.label}</span></div>
          <div className="ir"><span className="il">פגישה</span><span className="iv">{lead.visit_datetime ? new Date(lead.visit_datetime).toLocaleDateString('he-IL',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'לא נקבעה'}</span></div>
          {lead.description && <div className="ir"><span className="il">תיאור</span><span className="iv">{lead.description}</span></div>}
          <div className="ir"><span className="il">עודכן</span><span className="iv" style={{color:'var(--ink3)'}}>לפני {daysSince(lead.last_contact_at||lead.updated_at)||0} ימים</span></div>
        </div>

        {mode === 'view' && <>
          {/* CTA */}
          {!isFinal && !isFrozen && (
            <button className="cta2" onClick={() => onSchedule(lead)} style={{ marginTop: 10 }}>
              <Icon name="calendar-plus" size={18}/> הוסף ליומן (פגישה / תזכורת)
            </button>
          )}
          {isFrozen && <button className="cta" onClick={() => doStage('incoming_call')}><Icon name="flame" size={18} style={{stroke:'#fff'}}/> הפשר ליד</button>}

          {/* Actions */}
          <div className="mini-g">
            <button className="mb" onClick={() => setMode('edit')}><Icon name="pencil"/> ערוך</button>
            <button className="mb" onClick={() => setMode('note')}><Icon name="note"/> הערה</button>
            {!isFinal && (
              <button className="mb" onClick={async () => {
                await markContacted(lead.id)
                await addLog(lead.id, 'יצרתי קשר')
                refreshLogs(); onUpdate()
                showToast('נשמר — יצרתי קשר')
              }}><Icon name="check"/> יצרתי קשר</button>
            )}
            {!isFinal && !isFrozen && (
              <button className="mb" onClick={() => doStage('frozen')}><Icon name="snowflake"/> הקפא</button>
            )}
            {!isFinal && (
              <button className="mb r" onClick={() => { if(confirm('לסמן כאבוד?')) doStage('closed_lost') }}><Icon name="x"/> אבד</button>
            )}
          </div>

          {/* Tasks linked to this lead */}
          <div className="sec-hdr">משימות{tasks.filter(t=>!t.done).length ? ` · ${tasks.filter(t=>!t.done).length} פתוחות` : ''}</div>
          {tasks.map(t => <TaskItem key={t.id} task={t} onToggle={toggleLeadTask} showLead={false} />)}
          <QuickAddTask onAdd={addLeadTask} allowDate placeholder="משימה חדשה לליד…" />

          {/* Notes */}
          {lead.lead_notes?.length > 0 && (
            <div style={{ paddingTop: 4 }}>
              {[...lead.lead_notes].reverse().map(n => (
                <div key={n.id} className={`note-item ${n.content.startsWith('📝')?'g':''}`}>
                  {n.content}
                  <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 4 }}>
                    {new Date(n.created_at).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity Log */}
          <div style={{ margin: '12px 10px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink3)', letterSpacing: 1.2, textTransform: 'uppercase' }}>היסטוריה</div>
              <button onClick={() => setShowLogs(s => !s)} style={{ fontSize: 11, color: 'var(--ink3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily:'inherit' }}>
                {showLogs ? 'הסתר' : 'הצג'}
              </button>
            </div>
            {showLogs && logs.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>אין פעולות עדיין</div>}
            {showLogs && logs.map(log => (
              <div key={log.id} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:8 }}>
                <div style={{ width:2, background:'var(--line)', borderRadius:1, alignSelf:'stretch', flexShrink:0, marginTop:4 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12.5, fontWeight:600, color:'var(--ink)' }}>{log.action}</div>
                  {log.details && <div style={{ fontSize:11.5, color:'var(--ink2)', marginTop:1 }}>{log.details}</div>}
                  <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--ink3)', marginTop:2 }}>
                    {new Date(log.created_at).toLocaleDateString('he-IL',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 20 }}/>
        </>}

        {mode === 'note' && (
          <div style={{ padding: '10px' }}>
            <textarea rows={4} placeholder="הוסף הערה..." value={noteText}
              onChange={e => setNoteText(e.target.value)} autoFocus
              style={{ width:'100%', padding:'13px', borderRadius:12, border:'1px solid var(--line)', background:'var(--card)', color:'var(--ink)', fontSize:15, fontFamily:'inherit', resize:'vertical', marginBottom:8 }}
            />
            <div style={{ display:'flex', gap:8 }}>
              <button className="submit-btn" style={{ flex:1, margin:0 }} onClick={doNote}>שמור</button>
              <button className="mb" style={{ padding:'12px 16px' }} onClick={() => setMode('view')}>ביטול</button>
            </div>
          </div>
        )}

        {mode === 'edit' && (
          <div style={{ padding: '10px' }}>
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
            <div style={{ display:'flex', gap:8 }}>
              <button className="submit-btn" style={{ flex:1, margin:0 }} onClick={doEdit} disabled={saving}>{saving?'שומר...':'שמור'}</button>
              <button className="mb" style={{ padding:'12px 16px' }} onClick={() => setMode('view')}>ביטול</button>
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
    <div style={{ position:'fixed', inset:0, zIndex:200, overflowY:'auto', overflowX:'hidden', background:'var(--surface)', width:'100%' }}>
      <DetailScreen lead={{...lead}} onBack={() => setOpen(false)} onUpdate={() => { setOpen(false); onUpdate() }} onSchedule={onSchedule}/>
    </div>
  )

  return (
    <div className={`lead-card ${isStale?'urgent':''}`} onClick={() => setOpen(true)}>
      <div style={{ flex:1, minWidth:0 }}>
        <div className="l-addr">{lead.project_address}</div>
        <div className="l-client">{lead.client_name}</div>
        {lead.description && (
          <div style={{ fontSize:11.5, color:'var(--ink3)', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {lead.description.slice(0,40)}{lead.description.length>40?'...':''}
          </div>
        )}
        {lead.estimated_value && <div className="l-amt">${Number(lead.estimated_value).toLocaleString()}</div>}
        {lead.visit_datetime && (
          <div className="l-visit" style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Icon name="calendar" size={12}/>
            {new Date(lead.visit_datetime).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
          </div>
        )}
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
        <span className="s-pill" style={{ background:s.bg, color:s.color }}>{s.label}</span>
        {isStale
          ? <span className="days-txt">{days}י׳</span>
          : days !== null && <span style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--ink3)' }}>{days}י׳</span>
        }
      </div>
    </div>
  )
}


