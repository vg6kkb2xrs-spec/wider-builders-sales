import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { addLog } from '../lib/supabase'

function isToday(d){
  const date=new Date(d)
  const now=new Date()
  return date.getFullYear()===now.getFullYear()&&date.getMonth()===now.getMonth()&&date.getDate()===now.getDate()
}
function isTomorrow(d){
  const date=new Date(d)
  const tom=new Date()
  tom.setDate(tom.getDate()+1)
  return date.getFullYear()===tom.getFullYear()&&date.getMonth()===tom.getMonth()&&date.getDate()===tom.getDate()
}

function AddMeetingModal({ agentId, onClose, onSaved }) {
  const [form, setForm] = useState({ title:'', datetime:'', lead_id:'' })
  const [leads, setLeads] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('leads')
      .select('id, project_address, client_name')
      .eq('agent_id', agentId)
      .not('stage', 'in', '(completed,closed_lost)')
      .order('updated_at', { ascending: false })
      .then(({ data }) => setLeads(data || []))
  }, [])

  const save = async () => {
    if (!form.datetime) return setError('בחר תאריך ושעה')
    setSaving(true)
    try {
      if (form.lead_id) {
        // Link to existing lead
        await supabase.from('leads').update({
          visit_datetime: new Date(form.datetime).toISOString(),
          last_contact_at: new Date().toISOString(),
        }).eq('id', form.lead_id)
        const dateStr = new Date(form.datetime).toLocaleDateString('he-IL',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
        await addLog(form.lead_id, 'נקבעה פגישה', dateStr)
      } else {
        // Standalone meeting - create a basic lead
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('leads').insert({
          project_address: form.title || 'פגישה כללית',
          client_name: '',
          agent_id: user.id,
          visit_datetime: new Date(form.datetime).toISOString(),
          stage: 'incoming_call',
          last_contact_at: new Date().toISOString(),
        })
      }
      onSaved()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} dir="rtl">
        <div className="modal-head">
          <h2>הוסף פגישה</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="field">
          <label>קשר לליד קיים (אופציונלי)</label>
          <select value={form.lead_id} onChange={e=>setForm(f=>({...f,lead_id:e.target.value}))}>
            <option value="">— פגישה עצמאית —</option>
            {leads.map(l=>(
              <option key={l.id} value={l.id}>{l.project_address} · {l.client_name}</option>
            ))}
          </select>
        </div>

        {!form.lead_id && (
          <div className="field">
            <label>כותרת הפגישה</label>
            <input placeholder="לדוגמה: ישיבת צוות, פגישת לקוח..." value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/>
          </div>
        )}

        <div className="field">
          <label>תאריך ושעה</label>
          <input type="datetime-local" value={form.datetime} onChange={e=>setForm(f=>({...f,datetime:e.target.value}))}/>
        </div>

        {error && <div className="field-error">{error}</div>}
        <button className="submit-btn" onClick={save} disabled={saving}>
          {saving ? 'שומר...' : '📅 הוסף פגישה'}
        </button>
      </div>
    </div>
  )
}

function NoteModal({lead,type,agentId,onClose,onSaved}){
  const [text,setText]=useState('')
  const [saving,setSaving]=useState(false)
  const prefix=type==='prep'?'📋 הכנה לפגישה':'📝 סיכום פגישה'
  const save=async()=>{
    if(!text.trim())return
    setSaving(true)
    await supabase.from('lead_notes').insert({lead_id:lead.id,agent_id:agentId,content:`${prefix}: ${text.trim()}`})
    setSaving(false);onSaved();onClose()
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} dir="rtl">
        <div className="modal-head">
          <h2>{prefix}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="visit-addr">📍 {lead.project_address}</div>
        <div className="visit-client">{lead.client_name}</div>
        <div className="field">
          <label>{type==='prep'?'מה לבדוק / להביא:':'מה עלה בפגישה:'}</label>
          <textarea rows={4} placeholder={type==='prep'?'דוגמאות, מידות, דברים מהלקוח...':'תמחור, הלקוח מעוניין, שלב הבא...'} value={text} onChange={e=>setText(e.target.value)} autoFocus/>
        </div>
        <button className="submit-btn" onClick={save} disabled={saving}>{saving?'שומר...':'שמור'}</button>
      </div>
    </div>
  )
}

export default function MeetingsView({agentId,isManager}){
  const [meetings,setMeetings]=useState([])
  const [past,setPast]=useState([])
  const [showPast,setShowPast]=useState(false)
  const [noteModal,setNoteModal]=useState(null)
  const [showAdd,setShowAdd]=useState(false)

  const load=async()=>{
    let q=supabase.from('leads').select(isManager?'*, agents(name)':'*').not('visit_datetime','is',null).order('visit_datetime',{ascending:true})
    if(!isManager)q=q.eq('agent_id',agentId)
    const {data}=await q
    const now=new Date()
    const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate())
    setMeetings((data||[]).filter(l=>{
      const d=new Date(l.visit_datetime)
      return d>=todayStart
    }))
    setPast((data||[]).filter(l=>new Date(l.visit_datetime)<todayStart))
  }
  useEffect(()=>{load()},[])

  const grouped={}
  meetings.forEach(l=>{
    const key=isToday(l.visit_datetime)?'today':isTomorrow(l.visit_datetime)?'tomorrow':new Date(l.visit_datetime).toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'})
    if(!grouped[key])grouped[key]=[]
    grouped[key].push(l)
  })

  const dayLabel=(key)=>{
    if(key==='today') return 'היום'
    if(key==='tomorrow') return 'מחר'
    return key
  }

  return(
    <div className="body" dir="rtl">
      {noteModal&&(
        <NoteModal lead={noteModal.lead} type={noteModal.type} agentId={agentId}
          onClose={()=>setNoteModal(null)} onSaved={load}/>
      )}
      {showAdd&&(
        <AddMeetingModal agentId={agentId} onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);load()}}/>
      )}

      {/* Add meeting button */}
      {!isManager && (
        <div style={{padding:'10px 10px 0'}}>
          <button className="add-btn" onClick={()=>setShowAdd(true)}>
            <i className="ti ti-calendar-plus" style={{fontSize:16}} aria-hidden="true"/>
            הוסף פגישה
          </button>
        </div>
      )}

      {meetings.length===0&&(
        <div className="empty">
          <div className="empty-icon">📅</div>
          <div className="empty-title">אין פגישות מתוכננות</div>
        </div>
      )}

      {Object.entries(grouped).map(([key,items])=>(
        <div key={key}>
          <div className={`meet-hdr ${key==='today'?'today':'other'}`}>{dayLabel(key)}</div>
          {items.map(lead=>(
            <div key={lead.id} className={`meet-item ${key==='today'?'t':''}`}>
              <div style={{flex:1}}>
                <div className="m-addr">{lead.project_address}</div>
                {lead.client_name && <div className="m-client">{lead.client_name}{lead.description?` · ${lead.description}`:''}</div>}
                {isManager&&lead.agents?.name&&<div style={{fontSize:10,color:'#185FA5',marginTop:2}}>👤 {lead.agents.name}</div>}
                {lead.lead_notes?.some(n=>n.content.startsWith('📋'))&&<div className="m-prep">📋 יש הכנה לפגישה</div>}
                {!isManager&&(
                  <div style={{display:'flex',gap:6,marginTop:8}}>
                    <button onClick={()=>setNoteModal({lead,type:'prep'})}
                      style={{fontSize:11,background:'#E6F1FB',color:'#185FA5',border:'none',borderRadius:20,padding:'4px 10px',cursor:'pointer',fontFamily:'inherit'}}>
                      📋 הכנה
                    </button>
                    <button onClick={()=>setNoteModal({lead,type:'summary'})}
                      style={{fontSize:11,background:'#E8F5EF',color:'#1D9E75',border:'none',borderRadius:20,padding:'4px 10px',cursor:'pointer',fontFamily:'inherit'}}>
                      📝 סיכום
                    </button>
                  </div>
                )}
              </div>
              <div className={`m-time ${key==='today'?'g':''}`}>
                {new Date(lead.visit_datetime).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}
              </div>
            </div>
          ))}
        </div>
      ))}

      {past.length>0&&(
        <div style={{padding:'4px 0 12px'}}>
          <div className="past-link" onClick={()=>setShowPast(p=>!p)}>
            {showPast?'▲ הסתר':'▼'} פגישות קודמות ({past.length})
          </div>
          {showPast&&[...past].reverse().map(lead=>(
            <div key={lead.id} className="meet-item" style={{opacity:.65}}>
              <div>
                <div className="m-addr">{lead.project_address}</div>
                {lead.client_name&&<div className="m-client">{lead.client_name}</div>}
                {isManager&&lead.agents?.name&&<div style={{fontSize:10,color:'#8E8E93'}}>👤 {lead.agents.name}</div>}
                {!isManager&&(
                  <button onClick={()=>setNoteModal({lead,type:'summary'})}
                    style={{fontSize:11,background:'#E8F5EF',color:'#1D9E75',border:'none',borderRadius:20,padding:'4px 10px',cursor:'pointer',marginTop:6,fontFamily:'inherit'}}>
                    📝 סיכום
                  </button>
                )}
              </div>
              <div className="m-time" style={{fontSize:14}}>
                {new Date(lead.visit_datetime).toLocaleDateString('he-IL',{month:'short',day:'numeric'})}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
