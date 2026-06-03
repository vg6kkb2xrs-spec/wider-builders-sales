import { useEffect, useState } from 'react'
import { getMyLeads, getMyPerformance, stageInfo } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import AddLeadModal from '../components/AddLeadModal'
import ScheduleVisitModal from '../components/ScheduleVisitModal'
import LeadCard from '../components/LeadCard'
import MeetingsView from './MeetingsView'

const fmt  = (n) => n ? `$${Number(n).toLocaleString()}` : '—'
const fmtN = (n) => `$${Number(n || 0).toLocaleString()}`

function calcMonthly(annual, retro, won) {
  const left = 12 - new Date().getMonth()
  return left > 0 ? Math.round(Math.max(0, annual - retro - won) / left) : 0
}

function daysSince(d) {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

export default function AgentDashboard({ session }) {
  const [leads, setLeads] = useState([])
  const [perf, setPerf]   = useState(null)
  const [agent, setAgent] = useState(null)
  const [tab, setTab]     = useState('home')
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [schedLead, setSchedLead] = useState(null)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const [l, p] = await Promise.all([getMyLeads(), getMyPerformance()])
    const { data: ag } = await supabase.from('agents').select('*').eq('id', user.id).single()
    setLeads(l || [])
    setPerf(p)
    setAgent(ag)
  }

  useEffect(() => { load() }, [])

  const annual  = Number(agent?.annual_target || 0)
  const retro   = Number(agent?.retro_sales   || 0)
  const won     = Number(perf?.won_value       || 0)
  const total   = retro + won
  const annPct  = annual > 0 ? Math.min(100, Math.round(total / annual * 100)) : 0
  const monthly = calcMonthly(annual, retro, won)
  const monPct  = monthly > 0 ? Math.min(100, Math.round(won / monthly * 100)) : 0
  const mLeft   = 12 - new Date().getMonth()

  const stale   = leads.filter(l => daysSince(l.last_contact_at || l.updated_at) >= 7 && !['completed','closed_lost','frozen'].includes(l.stage))
  const todayM  = leads.filter(l => l.visit_datetime && new Date(l.visit_datetime).toDateString() === new Date().toDateString())
  const active  = leads.filter(l => !['completed','closed_lost','frozen'].includes(l.stage))
  const fresh   = active.filter(l => (daysSince(l.last_contact_at || l.updated_at) || 0) < 7)

  const visible = leads.filter(l => {
    const mf =
      filter === 'active'     ? !['completed','closed_lost','frozen'].includes(l.stage) :
      filter === 'closed_won' ? l.stage === 'closed_won' :
      filter === 'completed'  ? l.stage === 'completed' :
      filter === 'lost'       ? l.stage === 'closed_lost' :
      filter === 'frozen'     ? l.stage === 'frozen' : true
    const ms = !search ||
      l.project_address.toLowerCase().includes(search.toLowerCase()) ||
      l.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone||'').includes(search)
    return mf && ms
  })

  const agentName = session.user.user_metadata?.full_name?.split(' ')[0] || 'סוכן'

  return (
    <div className="app-shell" dir="rtl">
      {/* HERO */}
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greeting">שלום, {agentName} 👋</div>
            <div className="hero-sub">{new Date().toLocaleDateString('he-IL',{weekday:'long',month:'long',day:'numeric'})}</div>
          </div>
          <button className="btn-icon" onClick={() => supabase.auth.signOut()}>⎋</button>
        </div>

        {agent && (
          <div className="goal-card">
            <div style={{textAlign:'center',marginBottom:10}}>
              <div className="goal-label">יעד שנתי</div>
              <div style={{fontSize:34,fontWeight:700,color:'white',lineHeight:1.1}}>{fmtN(total)}</div>
              <div style={{fontSize:13,opacity:.8,marginTop:2}}>מתוך {fmtN(annual)} · נשארו {mLeft} חודשים</div>
              <div className="progress-track" style={{marginTop:8}}>
                <div className="progress-bar" style={{width:annPct+'%'}}/>
              </div>
              <div className="progress-label">{annPct}% מהיעד השנתי</div>
            </div>
            <div style={{borderTop:'1px solid rgba(255,255,255,.2)',paddingTop:8}}>
              <div className="goal-row">
                <div>
                  <div className="goal-label">יעד החודש</div>
                  <div className="goal-value" style={{fontSize:17}}>{fmt(won)} <span className="goal-of">/ {fmtN(monthly)}</span></div>
                </div>
                <div style={{textAlign:'left'}}>
                  <div className="goal-label">לידים פעילים</div>
                  <div className="goal-value" style={{fontSize:26}}>{active.length}</div>
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{width:monPct+'%'}}/>
              </div>
            </div>
          </div>
        )}

        <div className="stat-row">
          <div className="stat-box">
            <div className="stat-num" style={{color: todayM.length > 0 ? '#5DCAA5' : 'rgba(255,255,255,.4)'}}>{todayM.length}</div>
            <div className="stat-lbl">📅 היום</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{color: stale.length > 0 ? '#F09595' : 'rgba(255,255,255,.4)'}}>{stale.length}</div>
            <div className="stat-lbl">⚠️ ללא מגע</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{color:'#5DCAA5'}}>{perf?.won_count || 0}</div>
            <div className="stat-lbl">🏆 סגירות</div>
          </div>
        </div>
      </div>

      {/* HOME */}
      {tab === 'home' && (
        <div style={{flex:1}}>
          {todayM.length > 0 && (
            <>
              <div className="section-header today">📅 פגישות היום</div>
              {todayM.map(l => (
                <div key={l.id} className="today-card" onClick={() => setTab('meetings')}>
                  <div>
                    <div className="today-card-addr">{l.project_address}</div>
                    <div className="today-card-client">{l.client_name}</div>
                  </div>
                  <div className="today-card-time">
                    {new Date(l.visit_datetime).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              ))}
            </>
          )}

          {stale.length > 0 && (
            <>
              <div className="section-header urgent">⚠️ דורש טיפול עכשיו</div>
              <div className="lead-list" style={{paddingTop:4}}>
                {stale.map(l => <LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead}/>)}
              </div>
            </>
          )}

          {fresh.length > 0 && (
            <>
              <div className="section-header">לידים פעילים</div>
              <div className="lead-list" style={{paddingTop:4}}>
                {fresh.map(l => <LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead}/>)}
              </div>
            </>
          )}

          {leads.length === 0 && (
            <div style={{textAlign:'center',padding:'48px 24px'}}>
              <div style={{fontSize:48,marginBottom:16}}>📞</div>
              <div style={{fontSize:17,fontWeight:600,marginBottom:8}}>אין לידים עדיין</div>
              <div style={{fontSize:14,color:'var(--text2)',marginBottom:24,lineHeight:1.6}}>
                קיבלת שיחה נכנסת?<br/>הוסף אותה עכשיו
              </div>
              <button className="btn-primary" style={{maxWidth:240,margin:'0 auto',display:'block'}} onClick={() => setShowAdd(true)}>
                + הוסף את הליד הראשון
              </button>
            </div>
          )}
        </div>
      )}

      {/* MEETINGS */}
      {tab === 'meetings' && (
        <MeetingsView agentId={session.user.id} isManager={false}/>
      )}

      {/* ALL LEADS */}
      {tab === 'leads' && (
        <div style={{flex:1}}>
          <div style={{padding:'10px 12px 0'}}>
            <input
              placeholder="🔍 חפש לפי כתובת, שם, טלפון..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{width:'100%',padding:'10px 14px',borderRadius:10,border:'1px solid var(--border)',background:'var(--card)',color:'var(--text)',fontSize:14}}
            />
          </div>
          <div className="tab-row">
            {[
              {key:'active',label:'פעיל'},
              {key:'closed_won',label:'בביצוע'},
              {key:'completed',label:'הושלם'},
              {key:'lost',label:'אבוד'},
              {key:'frozen',label:'🧊'},
              {key:'all',label:'הכל'},
            ].map(t => (
              <button key={t.key} className={`tab ${filter===t.key?'tab--active':''}`} onClick={() => setFilter(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="lead-list">
            {visible.length === 0 && <div className="empty-state">אין לידים</div>}
            {visible.map(l => <LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead}/>)}
          </div>
        </div>
      )}

      {/* BOTTOM NAV */}
      <nav className="bottom-nav">
        <button className={`nav-item ${tab==='home'?'active':''}`} onClick={() => setTab('home')}>
          <i className="ti ti-home nav-icon" aria-hidden="true"/>
          בית
        </button>
        <button className={`nav-item ${tab==='meetings'?'active':''}`} onClick={() => setTab('meetings')} style={{position:'relative'}}>
          <i className="ti ti-calendar nav-icon" aria-hidden="true"/>
          {todayM.length > 0 && <span className="nav-badge">{todayM.length}</span>}
          פגישות
        </button>
        <button className={`nav-item ${tab==='leads'?'active':''}`} onClick={() => setTab('leads')}>
          <i className="ti ti-list nav-icon" aria-hidden="true"/>
          כל הלידים
        </button>
        <button className="nav-item" onClick={() => setShowAdd(true)}>
          <i className="ti ti-plus nav-icon" aria-hidden="true"/>
          הוסף
        </button>
      </nav>

      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }}/>}
      {schedLead && <ScheduleVisitModal lead={schedLead} onClose={() => setSchedLead(null)} onSaved={() => { setSchedLead(null); load() }}/>}
    </div>
  )
}
