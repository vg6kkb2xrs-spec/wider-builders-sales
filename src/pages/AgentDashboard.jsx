import { useEffect, useState } from 'react'
import { getMyLeads, getMyPerformance, getTodayTasks, addTask, toggleTask } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import AddLeadModal from '../components/AddLeadModal'
import AddEventModal from '../components/AddEventModal'
import LeadCard from '../components/LeadCard'
import Icon from '../components/Icon'
import { TaskItem, QuickAddTask } from '../components/Tasks'
import CashflowView from './CashflowView'
import CalendarView from './CalendarView'
import ReceiptsView from './ReceiptsView'

const fmtK=(n)=>{const v=Number(n||0);return v>=1000000?`$${(v/1000000).toFixed(1)}M`:v>=1000?`$${Math.round(v/1000)}K`:`$${v}`}
const fmtFull=(n)=>`$${Number(n||0).toLocaleString()}`
const fmt=(n)=>n?`$${Number(n).toLocaleString()}`:'—'
const daysSince=(d)=>d?Math.floor((Date.now()-new Date(d).getTime())/86400000):null

function calcMonthly(a,r,w){const l=12-new Date().getMonth();return l>0?Math.round(Math.max(0,a-r-w)/l):0}

export default function AgentDashboard({session}){
  const [leads,setLeads]=useState([])
  const [perf,setPerf]=useState(null)
  const [agent,setAgent]=useState(null)
  const [tab,setTab]=useState('home')
  const [financeView,setFinanceView]=useState('cashflow')
  const [filter,setFilter]=useState('active')
  const [search,setSearch]=useState('')
  const [showAdd,setShowAdd]=useState(false)
  const [schedLead,setSchedLead]=useState(null)
  const [showQuickEvent,setShowQuickEvent]=useState(false)
  const [triggerReceiptUpload,setTriggerReceiptUpload]=useState(0)
  const [upcomingEvents,setUpcomingEvents]=useState([])
  const [todayTasks,setTodayTasks]=useState([])
  const [calInitTasks,setCalInitTasks]=useState(false)

  const load=async()=>{
    const {data:{user}}=await supabase.auth.getUser()
    const [l,p,tt]=await Promise.all([getMyLeads(),getMyPerformance(),getTodayTasks()])
    const {data:ag}=await supabase.from('agents').select('*').eq('id',user.id).single()
    setLeads(l||[]);setPerf(p);setAgent(ag);setTodayTasks(tt||[])

    // "אירועים קרובים": upcoming meetings (from now) + dated tasks from tomorrow onward.
    // Today's tasks live in the משימות היום section, so exclude them here to avoid duplication.
    const now=new Date()
    const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(0,0,0,0)
    const weekAhead=new Date(now);weekAhead.setDate(weekAhead.getDate()+7)
    const [{data:tasks},{data:meetings}]=await Promise.all([
      supabase.from('tasks').select('*').eq('agent_id',user.id).eq('done',false)
        .gte('due_datetime',tomorrow.toISOString()).lte('due_datetime',weekAhead.toISOString())
        .order('due_datetime',{ascending:true}).limit(5),
      supabase.from('meetings').select('*').eq('agent_id',user.id)
        .gte('visit_datetime',now.toISOString()).lte('visit_datetime',weekAhead.toISOString())
        .order('visit_datetime',{ascending:true}).limit(5)
    ])
    const combined=[
      ...(tasks||[]).map(t=>({...t,_type:'task',_time:new Date(t.due_datetime)})),
      ...(meetings||[]).map(m=>({...m,_type:'meeting',_time:new Date(m.visit_datetime)})),
    ].sort((a,b)=>a._time-b._time)
    setUpcomingEvents(combined)
  }

  const addHomeTask=async({title,due_datetime})=>{
    await addTask({title,due_datetime})
    getTodayTasks().then(t=>setTodayTasks(t||[]))
  }
  const toggleHomeTask=async(task)=>{
    await toggleTask(task.id,!task.done)
    getTodayTasks().then(t=>setTodayTasks(t||[]))
  }
  useEffect(()=>{load()},[])

  const annual=Number(agent?.annual_target||0)
  const retro=Number(agent?.retro_sales||0)
  const won=Number(perf?.won_value||0)
  const total=retro+won
  const annPct=annual>0?Math.min(100,Math.round(total/annual*100)):0
  const monthly=calcMonthly(annual,retro,won)
  const mLeft=12-new Date().getMonth()

  const stale=leads.filter(l=>(daysSince(l.last_contact_at||l.updated_at)||0)>=7&&!['completed','closed_lost','frozen','closed_won'].includes(l.stage))
  const pipelineValue=leads.filter(l=>['incoming_call','in_progress','proposal_sent'].includes(l.stage)).reduce((s,l)=>s+Number(l.estimated_value||0),0)
  const todayM=leads.filter(l=>l.visit_datetime&&new Date(l.visit_datetime).toDateString()===new Date().toDateString())
  const active=leads.filter(l=>!['completed','closed_lost','frozen'].includes(l.stage))
  const fresh=active.filter(l=>(daysSince(l.last_contact_at||l.updated_at)||0)<7)

  const visible=leads.filter(l=>{
    const mf=filter==='active'?!['completed','closed_lost','frozen'].includes(l.stage):
      filter==='closed_won'?l.stage==='closed_won':
      filter==='completed'?l.stage==='completed':
      filter==='lost'?l.stage==='closed_lost':
      filter==='frozen'?l.stage==='frozen':true
    const ms=!search||l.project_address.toLowerCase().includes(search.toLowerCase())||l.client_name.toLowerCase().includes(search.toLowerCase())||(l.phone||'').includes(search)
    return mf&&ms
  })

  const agentName=session.user.user_metadata?.full_name?.split(' ')[0]||'סוכן'

  return (
    <div className="app" dir="rtl">
      {/* HERO */}
      <div className="h">
        <div className="h-top">
          <div><div className="h-name">שלום, {agentName}</div><div className="h-date">{new Date().toLocaleDateString('he-IL',{weekday:'long',month:'long',day:'numeric'})}</div></div>
          <button className="h-btn" onClick={()=>supabase.auth.signOut()} aria-label="יציאה"><Icon name="power" size={16}/></button>
        </div>
        {agent&&<>
          <div className="h-amt">{fmtFull(total)}</div>
          <div className="h-sub">מתוך {fmtFull(annual)} · נשארו {mLeft} חודשים · {annPct}%</div>
          <div className="h-prog"><div className="h-fill" style={{width:annPct+'%'}}/></div>
          <div className="h-grid">
            <div className="h-cell"><div className="h-cell-n">{fmtFull(monthly)}</div><div className="h-cell-l">יעד חודשי</div></div>
            <div className="h-cell"><div className="h-cell-n">{fmtFull(won)}</div><div className="h-cell-l">הושג</div></div>
            <div className="h-cell"><div className="h-cell-n" style={{opacity:pipelineValue>0?1:.45}}>{fmtFull(pipelineValue)}</div><div className="h-cell-l">פייפליין</div></div>
            <div className="h-cell"><div className="h-cell-n" style={{opacity:todayM.length>0?1:.45}}>{todayM.length}</div><div className="h-cell-l">פגישות היום</div></div>
          </div>
        </>}
      </div>

      {/* QUICK ACTIONS — quiet, monochrome */}
      <div className="qa-row">
        <button className="qa-btn" onClick={()=>{setTab('cashflow');setFinanceView('receipts');setTriggerReceiptUpload(n=>n+1)}}>
          <Icon name="receipt"/><span>הוסף קבלה</span>
        </button>
        <button className="qa-btn" onClick={()=>setShowQuickEvent(true)}>
          <Icon name="calendar-plus"/><span>הוסף פגישה</span>
        </button>
        <button className="qa-btn" onClick={()=>setShowAdd(true)}>
          <Icon name="phone"/><span>הוסף ליד</span>
        </button>
      </div>

      {/* HOME */}
      {tab==='home'&&<div className="body">
        {todayM.length>0&&(
          <div className="today-card" onClick={()=>setTab('calendar')}>
            <div className="tc-hdr"><div className="tc-dot"/><div className="tc-ttl">פגישה היום</div></div>
            {todayM.map(l=>(
              <div key={l.id} className="tc-row">
                <div><div className="tc-addr">{l.project_address}</div><div className="tc-client">{l.client_name}</div></div>
                <div className="tc-time">{new Date(l.visit_datetime).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            ))}
          </div>
        )}

        {/* Today's tasks — morning glance (undated to-dos + due today) */}
        <div className="sec-hdr" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>משימות היום</span>
          <span onClick={()=>{setCalInitTasks(true);setTab('calendar')}} style={{color:'var(--accent-deep)',cursor:'pointer',fontWeight:700}}>כל המשימות ›</span>
        </div>
        {todayTasks.map(t=><TaskItem key={t.id} task={t} onToggle={toggleHomeTask}/>)}
        <QuickAddTask onAdd={addHomeTask} placeholder="הוסף משימה להיום…"/>

        {stale.length>0&&<>
          <div className="sec-hdr" style={{color:'var(--alert-deep)'}}>דורש טיפול · {stale.length}</div>
          {stale.map(l=><LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead}/>)}
        </>}

        {stale.length===0&&leads.filter(l=>!['completed','closed_lost','frozen'].includes(l.stage)).length>0&&(
          <div className="empty"><div className="empty-sub" style={{color:'var(--accent-deep)',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}><Icon name="check" size={16}/> כל הלידים מטופלים</div></div>
        )}

        {upcomingEvents.length>0&&<>
          <div className="sec-hdr">אירועים קרובים</div>
          {upcomingEvents.map(ev=>(
            <div key={ev.id} className="event-item-row" style={{cursor:'default'}}>
              <div className="event-bar-meeting" style={{background:ev._type==='task'?'var(--ink3)':'var(--accent)'}}/>
              <div style={{flex:1}}>
                <div className="event-title-text">{ev._type==='task'?ev.title:ev.title||'פגישה'}</div>
                <div className="event-sub-text">
                  {ev._type==='task'?'משימה':'פגישה'} · {new Date(ev._time).toLocaleDateString('he-IL',{weekday:'short',month:'short',day:'numeric'})} {new Date(ev._time).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
        </>}

        {leads.length===0&&(
          <div className="empty">
            <div className="empty-icon">📞</div>
            <div className="empty-title">אין לידים עדיין</div>
            <div className="empty-sub">קיבלת שיחה נכנסת?<br/>הוסף אותה עכשיו</div>
            <button className="add-btn" style={{maxWidth:220,margin:'0 auto'}} onClick={()=>setShowAdd(true)}>+ שיחה נכנסת חדשה</button>
          </div>
        )}
      </div>}

      {/* MEETINGS */}
      {tab==='cashflow'&&(
        <>
          <div className="seg">
            <button className={financeView==='cashflow'?'on':''} onClick={()=>setFinanceView('cashflow')}>תזרים</button>
            <button className={financeView==='receipts'?'on':''} onClick={()=>setFinanceView('receipts')}>קבלות</button>
          </div>
          {financeView==='cashflow' ? <CashflowView isManager={false}/> : <ReceiptsView isManager={false} autoTriggerUpload={triggerReceiptUpload}/>}
        </>
      )}
      {tab==='calendar'&&<CalendarView agentId={session.user.id} initialMainView={calInitTasks?'tasks':'calendar'}/>}

      {/* ALL LEADS */}
      {tab==='leads'&&<div className="body">
        <input className="search-bar" placeholder="🔍 חפש כתובת, שם, טלפון" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="filter-row">
          {[{k:'active',l:'פעיל'},{k:'closed_won',l:'בביצוע'},{k:'completed',l:'הושלם'},{k:'lost',l:'אבוד'},{k:'frozen',l:'🧊 קפואים'},{k:'all',l:'הכל'}].map(t=>(
            <button key={t.k} className={`f-tab ${filter===t.k?'on':''}`} onClick={()=>setFilter(t.k)}>{t.l}</button>
          ))}
        </div>
        <div style={{paddingTop:8}}>
          {visible.length===0&&<div className="empty"><div className="empty-sub">אין לידים</div></div>}
          {visible.map(l=><LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead}/>)}
        </div>
      </div>}

      {/* BOTTOM NAV */}
      <nav className="nav">
        <button className={`nb ${tab==='home'?'on':''}`} onClick={()=>setTab('home')}>
          <div className="nb-icon"><Icon name="home" size={22}/></div>בית
        </button>
        <button className={`nb ${tab==='cashflow'?'on':''}`} onClick={()=>setTab('cashflow')}>
          <div className="nb-icon"><Icon name="cash" size={22}/></div>תזרים
        </button>
        <button className={`nb ${tab==='calendar'?'on':''}`} onClick={()=>{setCalInitTasks(false);setTab('calendar')}}>
          <div className="nb-icon"><Icon name="calendar" size={22}/></div>יומן
        </button>
        <button className={`nb ${tab==='leads'?'on':''}`} onClick={()=>setTab('leads')}>
          <div className="nb-icon"><Icon name="list" size={22}/></div>לידים
        </button>
      </nav>

      {showAdd&&<AddLeadModal onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);load()}}/>}
      {schedLead&&<AddEventModal agentId={session.user.id} defaultLeadId={schedLead.id} onClose={()=>setSchedLead(null)} onSaved={()=>{setSchedLead(null);load()}}/>}
      {showQuickEvent&&<AddEventModal agentId={session.user.id} onClose={()=>setShowQuickEvent(false)} onSaved={()=>{setShowQuickEvent(false);load()}}/>}
    </div>
  )
}









