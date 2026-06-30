import { useEffect, useState } from 'react'
import { getMyLeads, getMyPerformance } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import AddLeadModal from '../components/AddLeadModal'
import AddEventModal from '../components/AddEventModal'
import LeadCard from '../components/LeadCard'
import CashflowView from './CashflowView'
import CalendarView from './CalendarView'
import ReceiptsView from './ReceiptsView'

const fmtK=(n)=>{const v=Number(n||0);return v>=1000000?`$${(v/1000000).toFixed(1)}M`:v>=1000?`$${Math.round(v/1000)}K`:`$${v}`}
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

  const stale=leads.filter(l=>(daysSince(l.last_contact_at||l.updated_at)||0)>=7&&!['completed','closed_lost','frozen','closed_won'].includes(l.stage))
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
          <button className="h-btn" onClick={()=>supabase.auth.signOut()}>⎋</button>
        </div>
        {agent&&<>
          <div className="h-amt">{fmtK(total)}</div>
          <div className="h-sub">מתוך {fmtK(annual)} · נשארו {mLeft} חודשים · {annPct}%</div>
          <div className="h-prog"><div className="h-fill" style={{width:annPct+'%'}}/></div>
          <div className="h-grid">
            <div className="h-cell"><div className="h-cell-n">{fmtK(monthly)}</div><div className="h-cell-l">יעד חודשי</div></div>
            <div className="h-cell"><div className="h-cell-n">{fmt(won)}</div><div className="h-cell-l">הושג</div></div>
            <div className="h-cell"><div className="h-cell-n" style={{color:todayM.length>0?'#9FE1CB':'rgba(255,255,255,.4)'}}>{todayM.length}</div><div className="h-cell-l">פגישות היום</div></div>
          </div>
        </>}
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

        {stale.length>0&&<>
          <div className="sec-hdr" style={{color:'#E24B4A'}}>⚠ דורש טיפול</div>
          {stale.map(l=><LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead}/>)}
        </>}

        {fresh.length>0&&<>
          <div className="sec-hdr">לידים פעילים</div>
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
        {leads.length>0&&(
          <button className="add-btn" onClick={()=>setShowAdd(true)}>
            <i className="ti ti-phone-incoming" style={{fontSize:16}} aria-hidden="true"/>
            שיחה נכנסת חדשה
          </button>
        )}
      </div>}

      {/* MEETINGS */}
      {tab==='cashflow'&&(
        <>
          <div style={{ display:'flex', background:'rgba(0,0,0,.03)', borderRadius:10, padding:3, margin:'10px 12px 0' }}>
            <button onClick={()=>setFinanceView('cashflow')}
              style={{ flex:1, padding:'8px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, cursor:'pointer',
                background: financeView==='cashflow' ? '#185FA5' : 'none', color: financeView==='cashflow' ? '#fff' : '#8E8E93' }}>
              💰 תזרים
            </button>
            <button onClick={()=>setFinanceView('receipts')}
              style={{ flex:1, padding:'8px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, cursor:'pointer',
                background: financeView==='receipts' ? '#1D9E75' : 'none', color: financeView==='receipts' ? '#fff' : '#8E8E93' }}>
              📄 קבלות
            </button>
          </div>
          {financeView==='cashflow' ? <CashflowView isManager={false}/> : <ReceiptsView isManager={false}/>}
        </>
      )}
      {tab==='calendar'&&<CalendarView agentId={session.user.id}/>}

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
          <div className="nb-icon"><i className="ti ti-home" aria-hidden="true"/></div>בית
        </button>
        <button className={`nb ${tab==='cashflow'?'on':''}`} onClick={()=>setTab('cashflow')}>
          <div className="nb-icon"><i className="ti ti-cash" aria-hidden="true"/></div>תזרים
        </button>
        <button className={`nb ${tab==='calendar'?'on':''}`} onClick={()=>setTab('calendar')}>
          <div className="nb-icon"><i className="ti ti-calendar" aria-hidden="true"/></div>יומן
        </button>
        <button className={`nb ${tab==='leads'?'on':''}`} onClick={()=>setTab('leads')}>
          <div className="nb-icon"><i className="ti ti-list" aria-hidden="true"/></div>לידים
        </button>
      </nav>

      {showAdd&&<AddLeadModal onClose={()=>setShowAdd(false)} onSaved={()=>{setShowAdd(false);load()}}/>}
      {schedLead&&<AddEventModal agentId={session.user.id} defaultLeadId={schedLead.id} onClose={()=>setSchedLead(null)} onSaved={()=>{setSchedLead(null);load()}}/>}
    </div>
  )
}







