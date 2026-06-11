import { useState, useEffect } from 'react'
import { stageInfo, STAGES, updateLeadStage, markContacted, addNote, updateLead, addLog, getLogs } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : null
const daysSince = (d) => d ? Math.floor((Date.now()-new Date(d).getTime())/86400000) : null

const PIPELINE = ['incoming_call','in_progress','proposal_sent','closed_won','completed']
const PIPELINE_LABELS = {
  incoming_call: 'שיחה נכנסת',
  in_progress: 'בטיפול',
  proposal_sent: 'מחכה לתשובה',
  closed_won: 'עובדים אצלו',
  completed: 'הושלם ✅',
}
const SPECIAL_STAGES = {
  frozen: { label: '🧊 קפוא', color: '#5F5E5A', bg: '#F1EFE8' },
  closed_lost: { label: '✗ אבוד', color: '#A32D2D', bg: '#FCEBEB' },
}

function StageBar({ currentStage, onStageChange, saving }) {
  const currentIdx = PIPELINE.indexOf(currentStage)
  const isFinalStage = ['completed','closed_lost','frozen'].includes(currentStage)

  return (
    <div style={{ padding: '14px 12px 10px', background: '#fff', borderBottom: '.5px solid #F2F2F7' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', letterSpacing: .4, textTransform: 'uppercase', marginBottom: 10 }}>
        שינוי שלב
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {PIPELINE.map((key, i) => {
          const isCurrent = i === currentIdx
          const isDone = i < currentIdx
          const isNext = i === currentIdx + 1

          return (
            <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {/* connector line */}
              {i > 0 && (
                <div style={{
                  position: 'absolute', top: 11, right: '50%', left: '-50%',
                  height: 2,
                  background: i <= currentIdx ? '#1D9E75' : '#E5E5EA',
                  zIndex: 0,
                  overflow: 'hidden',
                }}/>
              )}
              {/* dot */}
              <button
                onClick={() => !saving && i !== currentIdx && onStageChange(key)}
                disabled={saving}
                style={{
                  width: 22, height: 22, borderRadius: '50%', border: 'none',
                  background: isDone ? '#1D9E75' : isCurrent ? '#1D9E75' : '#E5E5EA',
                  cursor: i !== currentIdx ? 'pointer' : 'default',
                  zIndex: 1, position: 'relative', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isCurrent ? '0 0 0 3px rgba(29,158,117,.2)' : 'none',
                  transition: 'all .2s',
                  outline: isNext ? '2px dashed #9FE1CB' : 'none',
                  outlineOffset: 2,
                }}
              >
                {isDone && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                {isCurrent && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', display: 'block' }}/>}
              </button>
              {/* label */}
              <div style={{
                fontSize: 9, marginTop: 4, textAlign: 'center', lineHeight: 1.2,
                color: isCurrent ? '#1D9E75' : isDone ? '#1D9E75' : '#B0B0B0',
                fontWeight: isCurrent ? 700 : 400,
                maxWidth: 52,
              }}>
                {PIPELINE_LABELS[key].replace(' ✅','')}
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
  }, [lead.id])

  const refreshLogs = () => getLogs(lead.id).then(setLogs)

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
    t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#1D9E75;color:white;padding:10px 20px;border-radius:20px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.2)'
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 2500)
  }

  return (
    <div style={{ background: '#F2F2F7', minHeight: '100dvh', display: 'flex', flexDirection: 'column', paddingBottom: 64, overflowX: 'hidden', width: '100%' }} dir="rtl">
      {/* Header */}
      <div className="det-h">
        <button className="back-pill" onClick={onBack}>
          <i className="ti ti-chevron-right" style={{ fontSize: 13 }} aria-hidden="true"/>
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
          <div className="ir"><span className="il">עודכן</span><span className="iv" style={{color:'#8E8E93'}}>לפני {daysSince(lead.last_contact_at||lead.updated_at)||0} ימים</span></div>
        </div>

        {mode === 'view' && <>
          {/* CTA */}
          {!isFinal && !isFrozen && (
            <button className="cta2" onClick={() => onSchedule(lead)} style={{ marginTop: 10 }}>
              📅 {lead.visit_datetime ? 'עדכן פגישה' : 'קבע פגישה'}
            </button>
          )}
          {isFrozen && <button className="cta" onClick={() => doStage('incoming_call')}>🔥 הפשר ליד</button>}

          {/* Actions */}
          <div className="mini-g">
            <button className="mb" onClick={() => setMode('edit')}>✏️ ערוך</button>
            <button className="mb" onClick={() => setMode('note')}>📝 הערה</button>
            {!isFinal && (
              <button className="mb" onClick={async () => {
                await markContacted(lead.id)
                await addLog(lead.id, 'יצרתי קשר')
                refreshLogs(); onUpdate()
                showToast('✅ נשמר — יצרתי קשר')
              }}>✅ יצרתי קשר</button>
            )}
            {!isFinal && !isFrozen && (
              <button className="mb" onClick={() => doStage('frozen')}>🧊 הקפא</button>
            )}
            {!isFinal && (
              <button className="mb r" onClick={() => { if(confirm('לסמן כאבוד?')) doStage('closed_lost') }}>✗ אבד</button>
            )}
          </div>

          {/* Notes */}
          {lead.lead_notes?.length > 0 && (
            <div style={{ paddingTop: 4 }}>
              {[...lead.lead_notes].reverse().map(n => (
                <div key={n.id} className={`note-item ${n.content.startsWith('📝')?'g':''}`}>
                  {n.content}
                  <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 4 }}>
                    {new Date(n.created_at).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity Log */}
          <div style={{ margin: '12px 10px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8E8E93', letterSpacing: .4, textTransform: 'uppercase' }}>היסטוריה</div>
              <button onClick={() => setShowLogs(s => !s)} style={{ fontSize: 11, color: '#8E8E93', background: 'none', border: 'none', cursor: 'pointer' }}>
                {showLogs ? '▲ הסתר' : '▼ הצג'}
              </button>
            </div>
            {showLogs && logs.length === 0 && <div style={{ fontSize: 12, color: '#8E8E93' }}>אין פעולות עדיין</div>}
            {showLogs && logs.map(log => (
              <div key={log.id} style={{ display:'flex', gap:10, alignItems:'flex-start', marginBottom:8 }}>
                <div style={{ width:2, background:'#E5E5EA', borderRadius:1, alignSelf:'stretch', flexShrink:0, marginTop:4 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'#1a1a1a' }}>{log.action}</div>
                  {log.details && <div style={{ fontSize:11, color:'#8E8E93', marginTop:1 }}>{log.details}</div>}
                  <div style={{ fontSize:10, color:'#B0B0B0', marginTop:2 }}>
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
              style={{ width:'100%', padding:'12px', borderRadius:12, border:'.5px solid #E5E5EA', background:'#fff', color:'#1a1a1a', fontSize:14, fontFamily:'inherit', resize:'vertical', marginBottom:8 }}
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
    <div style={{ position:'fixed', inset:0, zIndex:200, overflowY:'auto', overflowX:'hidden', background:'#F2F2F7', width:'100%' }}>
      <DetailScreen lead={{...lead}} onBack={() => setOpen(false)} onUpdate={() => { setOpen(false); onUpdate() }} onSchedule={onSchedule}/>
    </div>
  )

  return (
    <div className={`lead-card ${isStale?'urgent':''}`} onClick={() => setOpen(true)}>
      <div style={{ flex:1, minWidth:0 }}>
        <div className="l-addr">{lead.project_address}</div>
        <div className="l-client">{lead.client_name}</div>
        {lead.description && (
          <div style={{ fontSize:11, color:'#8E8E93', marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {lead.description.slice(0,40)}{lead.description.length>40?'...':''}
          </div>
        )}
        {lead.estimated_value && <div className="l-amt">${Number(lead.estimated_value).toLocaleString()}</div>}
        {lead.visit_datetime && (
          <div className="l-visit">📅 {new Date(lead.visit_datetime).toLocaleDateString('he-IL',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
        )}
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
        <span className="s-pill" style={{ background:s.bg, color:s.color }}>{s.label}</span>
        {isStale
          ? <span className="days-txt">⚠️ {days}י׳</span>
          : days !== null && <span style={{ fontSize:10, color:'#8E8E93' }}>{days}י׳</span>
        }
      </div>
    </div>
  )
}
