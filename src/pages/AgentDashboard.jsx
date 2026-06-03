import { useEffect, useState } from 'react'
import { getMyLeads, getMyPerformance } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import AddLeadModal from '../components/AddLeadModal'
import ScheduleVisitModal from '../components/ScheduleVisitModal'
import LeadCard from '../components/LeadCard'
import MeetingsView from './MeetingsView'

const fmtK = (n) => {
  const v = Number(n||0)
  return v>=1000000?`$${(v/1000000).toFixed(1)}M`:v>=1000?`$${Math.round(v/1000)}K`:`$${v}`
}
const fmt = (n) => n?`$${Number(n).toLocaleString()}`:'—'
const daysSince = (d) => d?Math.floor((Date.now()-new Date(d).getTime())/86400000):null

function calcMonthly(annual,retro,won){
  const left=12-new Date().getMonth()
  return left>0?Math.round(Math.max(0,annual-retro-won)/left):0
}

export default function AgentDashboard({ session }) {
  const [leads,setLeads]=useState([])
  const [perf,setPerf]=useState(null)
  const [agent,setAgent]=useState(null)
  const [tab,setTab]=useState('home')
  const [filter,setFilter]=useState('active')
  const [search,setSearch]=useState('')
  const [showAdd,setShowAdd]=useState(false)
  const [schedLead,setSchedLead]=useState(null)

  const load=async()=>{
    const {data:{user}}=await supabase.auth.getUser()
    const [l,p]=await Promise.all([getMyLeads(),getMyPerformance()])
    const {data:ag}=await supabase.from('agents').select('*').eq('id',user.id).single()
    setLeads(l||[]);setPerf(p);setAgent(ag)
  }
  useEffect(()=>{load()},[])

  const annual=Number(agent?.annual_target||0)
  const retro=Number(agent?.retro_sales||0)
  const won=Number(perf?.won_value||0)
  const total=retro+won
  const annPct=annual>0?Math.min(100,Math.round(total/annual*100)):0
  const monthly=calcMonthly(annual,retro,won)
  const mLeft=12-new Date().getMonth()

  const stale=leads.filter(l=>(daysSince(l.last_contact_at||l.updated_at)||0)>=7&&!['completed','closed_lost','frozen'].includes(l.stage))
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
      <div className="hero">
        <div className="hero-top">
          <div><div className="hero-greeting">שלום, {agentName}</div><div className="hero-sub">{new Date().toLocaleDateString('he-IL',{weekday:'long',month:'long',day:'numeric'})}</div></div>
          <button className="exit-btn" onClick={()=>supabase.auth.signOut()}>⎋</button>
        </div>
        {agent&&<>
          <div className="annual-box">
            <div className="annual-amount">{fmtK(total)}</div>
            <div className="annual-sub">מתוך {fmtK(annual)} שנתי · נשארו {mLeft} חודשים · {annPct}%</div>
            <div className="prog"><div className="prog-fill" style={{width:annPct+'%'}}/></div>
          </div>
          <div className="stats-row">
            <div className="stat-cell"><div className="stat-n">{fmtK(monthly)}</div><div className="stat-l">יעד חודשי</div></div>
            <div className="stat-cell"><div className="stat-n">{fmt(won)}</div><div className="stat-l">הושג</div></div>
            <div className="stat-cell"><div className="stat-n" style={{color:todayM.length>0?'#9FE1CB':'rgba(255,255,255,.35)'}}>{todayM.length}</div><div className="stat-l">פגישות היום</div></div>
          </div>
        </>}
      </div>

      {tab==='home'&&<div className="body">
        {todayM.length>0&&(
          <div className="today-block">
            <div className="block-header"><div className="block-dot" style={{background:'var(--green)'}}/><div className="block-title" style={{color:'var(--green)'}}>פגישה היום</div></div>
            {todayM.map(l=>(
              <div key={l.id} className="today-row" onClick={()=>setTab('meetings')}>
                <div><div className="today-addr">{l.project_address}</div><div className="today-client">{l.client_name}</div></div>
                <div className="today-time">{new Date(l.visit_datetime).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            ))}
          </div>
        )}

        {stale.length>0&&(
          <div className="urgent-block">
            <div className="block-header"><div className="block-dot" style={{background:'var(--red)'}}/><div className="block-title" style={{color:'var(--red)'}}>דורש טיפול</div></div>
            {stale.map(l=>(
              <div key={l.id}>
                <LeadCard lead={l} onUpdate={load} onSchedule={setSchedLead}/>
              </div>
            ))}
          </div>
        )}

        {fresh.length>0&&<>
          <div className="section-hdr">לידים פעילים</div>
          {fresh.map(l=><LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead}/>)}
        </>}

        {leads.length===0&&(
          <div className="empty">
            <div className="empty-icon">📞</div>
            <div className="empty-title">אין לידים עדיין</div>
            <div className="empty-sub">קיבלת שיחה נכנסת?<br/>הוסף אותה עכשיו</div>
            <button className="add-btn" style={{maxWidth:220,margin:'0 auto'}} onClick={()=>setShowAdd(true)}>+ שיחה נכנסת חדשה</button>
          </div>
        )}
        {leads.length>0&&<div className="add-row"><button className="add-btn" onClick={()=>setShowAdd(true)}><i className="ti ti-phone-incoming" style={{fontSize:17}} aria-hidden="true"/>שיחה נכנסת חדשה</button></div>}
      </div>}

      {tab==='meetings'&&<MeetingsView agentId={session.user.id} isManager={false}/>}

      {tab==='leads'&&<div className="body">
        <input className="search-bar" placeholder="🔍 חפש כתובת, שם, טלפון" value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="filter-row">
          {[{k:'active',l:'פעיל'},{k:'closed_won',l:'בביצוע'},{k:'completed',l:'הושלם'},{k:'lost',l:'אבוד'},{k:'frozen',l:'🧊'},{k:'all',l:'הכל'}].map(t=>(
            <button key={t.k} className={`f-tab ${filter===t.k?'on':''}`} onClick={()=>setFilter(t.k)}>{t.l}</button>
          ))}
        </div>
        <div style={{paddingTop:8}}>
          {visible.length===0&&<div className="empty"><div className="empty-sub">אין לידים</div></div>}
          {visible.map(l=><LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead}/>)}
        </div>
      </div>}

      <nav className="bottom-nav">
        <button className={`nav-btn ${tab==='home'?'on':''}`} onClick={()=>setTab('home')}><i className="ti ti-home nav-icon" aria-hidden="true"/>בית</button>
        <button className={`nav-btn ${tab==='meetings'?'on':''}`} onClick={()=>setTab('meetings')} style={{position:'relative'}}>
          <i className="ti ti-calendar nav-icon" aria-hidden="true"/>
          {todayM.length>0&&<span className="nav-badge">{todayM.length}</span>}
          פגישות
        </button>
        <button className={`nav-btn ${tab==='leads'?'on':''}`} onClick={()=>setTab('leads')}><i className="ti ti-list nav-icon" aria-hidden="true"/>לידים</button>
        <button className="nav-btn" onClick={()=>setShowAdd(true)}><i className="ti ti-plus nav-icon" aria-hidden="true"/>הוסף</button>
      </nav>

      {showAdd&&<AddLeadModal onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);load()}}/>}
      {schedLead&&<ScheduleVisitModal lead={schedLead} onClose={()=>setSchedLead(null)} onSaved={()=>{setSchedLead(null);load()}}/>}
    </div>
  )
}
