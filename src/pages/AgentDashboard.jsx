import { useEffect, useState } from 'react'
import { getMyLeads, getMyPerformance, stageInfo, STAGES } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import AddLeadModal from '../components/AddLeadModal'
import ScheduleVisitModal from '../components/ScheduleVisitModal'
import LeadCard from '../components/LeadCard'
import MeetingsView from './MeetingsView'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '—'
const fmtN = (n) => `$${Number(n || 0).toLocaleString()}`

function calcMonthlyTarget(annualTarget, retroSales, wonValue) {
  const now = new Date()
  const monthsLeft = 12 - now.getMonth()
  const remaining = Math.max(0, annualTarget - retroSales - wonValue)
  return monthsLeft > 0 ? Math.round(remaining / monthsLeft) : 0
}

export default function AgentDashboard({ session }) {
  const [leads, setLeads] = useState([])
  const [perf, setPerf] = useState(null)
  const [agent, setAgent] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [schedLead, setSchedLead] = useState(null)
  const [filter, setFilter] = useState('active')
  const [mainTab, setMainTab] = useState('leads')
  const [search, setSearch] = useState('')

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const [l, p] = await Promise.all([getMyLeads(), getMyPerformance()])
    const { data: ag } = await supabase.from('agents').select('*').eq('id', user.id).single()
    setLeads(l)
    setPerf(p)
    setAgent(ag)
  }

  useEffect(() => { load() }, [])

  const annualTarget   = Number(agent?.annual_target || 0)
  const retroSales     = Number(agent?.retro_sales || 0)
  const wonValue       = Number(perf?.won_value || 0)
  const totalProgress  = retroSales + wonValue
  const annualPct      = annualTarget > 0 ? Math.min(100, Math.round((totalProgress / annualTarget) * 100)) : 0
  const dynamicMonthly = calcMonthlyTarget(annualTarget, retroSales, wonValue)
  const monthlyPct     = dynamicMonthly > 0 ? Math.min(100, Math.round((wonValue / dynamicMonthly) * 100)) : 0

  const staleCount = leads.filter(l => {
    const days = Math.floor((Date.now() - new Date(l.last_contact_at || l.updated_at).getTime()) / 86400000)
    return days >= 7 && !['closed_won','closed_lost','frozen'].includes(l.stage)
  }).length

  const visibleLeads = leads.filter(l => {
    const matchFilter =
      filter === 'active'  ? !['closed_won','closed_lost','frozen'].includes(l.stage) :
      filter === 'won'     ? l.stage === 'closed_won' :
      filter === 'lost'    ? l.stage === 'closed_lost' :
      filter === 'frozen'  ? l.stage === 'frozen' : true
    const matchSearch = !search || 
      l.project_address.toLowerCase().includes(search.toLowerCase()) ||
      l.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone || '').includes(search)
    return matchFilter && matchSearch
  })

  const todayMeetings = leads.filter(l => {
    if (!l.visit_datetime) return false
    const d = new Date(l.visit_datetime)
    return d.toDateString() === new Date().toDateString()
  }).length

  const agentName = session.user.user_metadata?.full_name?.split(' ')[0] || 'סוכן'

  return (
    <div className="app-shell" dir="rtl">
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greeting">שלום, {agentName} 👋</div>
            <div className="hero-sub">{new Date().toLocaleDateString('he-IL', { weekday:'long', month:'long', day:'numeric' })}</div>
          </div>
          <button className="btn-icon" onClick={() => supabase.auth.signOut()}>⎋</button>
        </div>

        {agent && (
          <div className="goal-card">
            <div style={{ textAlign:'center', marginBottom:12 }}>
              <div className="goal-label">יעד שנתי</div>
              <div style={{ fontSize:34, fontWeight:700, color:'white', lineHeight:1.1 }}>{fmtN(totalProgress)}</div>
              <div style={{ fontSize:14, opacity:0.8, marginTop:2 }}>מתוך {fmtN(annualTarget)}</div>
              <div className="progress-track" style={{ marginTop:8 }}>
                <div className="progress-bar" style={{ width: annualPct+'%' }} />
              </div>
              <div className="progress-label">{annualPct}% מהיעד השנתי</div>
            </div>
            <div style={{ borderTop:'1px solid rgba(255,255,255,0.2)', paddingTop:10 }}>
              <div className="goal-row">
                <div>
                  <div className="goal-label">יעד חודשי</div>
                  <div className="goal-value" style={{ fontSize:18 }}>{fmt(wonValue)} <span className="goal-of">/ {fmtN(dynamicMonthly)}</span></div>
                </div>
                <div style={{ textAlign:'left' }}>
                  <div className="goal-label">לידים פעילים</div>
                  <div className="goal-value" style={{ fontSize:26 }}>{perf?.active_leads || 0}</div>
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: monthlyPct+'%' }} />
              </div>
            </div>
          </div>
        )}

        <div className="stat-row">
          {[
            { label:'סגורות החודש', val: perf?.won_count || 0, color:'#5DCAA5' },
            { label:'בביצוע', val: leads.filter(l=>l.stage==='in_progress').length, color:'#EF9F27' },
            { label:'📅 פגישות היום', val: todayMeetings, color: todayMeetings > 0 ? '#1D9E75' : '#888' },
          ].map(s => (
            <div className="stat-box" key={s.label}>
              <div className="stat-num" style={{ color:s.color }}>{s.val}</div>
              <div className="stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--card)' }}>
        {[{key:'leads',label:'לידים'},{key:'meetings',label:`פגישות${todayMeetings > 0 ? ` (${todayMeetings})` : ''}`}].map(t => (
          <button key={t.key} className={`tab ${mainTab===t.key?'tab--active':''}`} style={{flex:1}} onClick={()=>setMainTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === 'meetings' && (
        <MeetingsView agentId={session.user.id} isManager={false} />
      )}

      {mainTab === 'leads' && <>
      {/* Search */}
      <div style={{ padding:'10px 16px 0' }}>
        <input
          placeholder="🔍 חפש לפי כתובת, שם, טלפון..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', fontSize:14 }}
        />
      </div>

      {/* Filter tabs */}
      <div className="tab-row">
        {[
          { key:'active', label:'פעיל' },
          { key:'won',    label:'בוצע' },
          { key:'lost',   label:'אבוד' },
          { key:'frozen', label:'🧊 קפוא' },
          { key:'all',    label:'הכל' },
        ].map(t => (
          <button key={t.key} className={`tab ${filter===t.key?'tab--active':''}`} onClick={()=>setFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Lead list */}
      <div className="lead-list">
        {visibleLeads.length === 0 && <div className="empty-state">אין לידים להצגה</div>}
        {visibleLeads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onUpdate={load}
            onSchedule={setSchedLead}
          />
        ))}
      </div>

      </> }

      <button className="fab" onClick={() => setShowAdd(true)}>+</button>

      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
      {schedLead && <ScheduleVisitModal lead={schedLead} onClose={() => setSchedLead(null)} onSaved={() => { setSchedLead(null); load() }} />}
    </div>
  )
}
