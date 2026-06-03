import { useEffect, useState } from 'react'
import { getMyLeads, getMyPerformance, stageInfo } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import AddLeadModal from '../components/AddLeadModal'
import ScheduleVisitModal from '../components/ScheduleVisitModal'
import LeadCard from '../components/LeadCard'
import MeetingsView from './MeetingsView'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '—'
const fmtN = (n) => `$${Number(n || 0).toLocaleString()}`

function calcMonthly(annual, retro, won) {
  const monthsLeft = 12 - new Date().getMonth()
  const remaining = Math.max(0, annual - retro - won)
  return monthsLeft > 0 ? Math.round(remaining / monthsLeft) : 0
}

function daysSince(d) {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

export default function AgentDashboard({ session }) {
  const [leads, setLeads] = useState([])
  const [perf, setPerf] = useState(null)
  const [agent, setAgent] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [schedLead, setSchedLead] = useState(null)
  const [tab, setTab] = useState('home')
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const [l, p] = await Promise.all([getMyLeads(), getMyPerformance()])
    const { data: ag } = await supabase.from('agents').select('*').eq('id', user.id).single()
    setLeads(l || [])
    setPerf(p)
    setAgent(ag)
  }

  useEffect(() => { load() }, [])

  const annual = Number(agent?.annual_target || 0)
  const retro = Number(agent?.retro_sales || 0)
  const won = Number(perf?.won_value || 0)
  const totalProgress = retro + won
  const annualPct = annual > 0 ? Math.min(100, Math.round((totalProgress / annual) * 100)) : 0
  const monthly = calcMonthly(annual, retro, won)
  const monthlyPct = monthly > 0 ? Math.min(100, Math.round((won / monthly) * 100)) : 0

  const staleLeads = leads.filter(l => {
    const d = daysSince(l.last_contact_at || l.updated_at)
    return d >= 7 && !['completed','closed_lost','frozen'].includes(l.stage)
  })

  const todayMeetings = leads.filter(l => {
    if (!l.visit_datetime) return false
    return new Date(l.visit_datetime).toDateString() === new Date().toDateString()
  })

  const activeLeads = leads.filter(l => !['completed','closed_lost','frozen'].includes(l.stage))

  const visibleLeads = leads.filter(l => {
    const matchFilter =
      filter === 'active'      ? !['completed','closed_lost','frozen'].includes(l.stage) :
      filter === 'closed_won'  ? l.stage === 'closed_won' :
      filter === 'completed'   ? l.stage === 'completed' :
      filter === 'lost'        ? l.stage === 'closed_lost' :
      filter === 'frozen'      ? l.stage === 'frozen' : true
    const matchSearch = !search ||
      l.project_address.toLowerCase().includes(search.toLowerCase()) ||
      l.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (l.phone || '').includes(search)
    return matchFilter && matchSearch
  })

  const agentName = session.user.user_metadata?.full_name?.split(' ')[0] || 'סוכן'

  return (
    <div className="app-shell" dir="rtl">
      {/* HERO */}
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
            <div style={{ textAlign:'center', marginBottom:10 }}>
              <div className="goal-label">יעד שנתי</div>
              <div style={{ fontSize:32, fontWeight:700, color:'white', lineHeight:1.1 }}>{fmtN(totalProgress)}</div>
              <div style={{ fontSize:13, opacity:.8, marginTop:2 }}>מתוך {fmtN(annual)}</div>
              <div className="progress-track" style={{ marginTop:8 }}>
                <div className="progress-bar" style={{ width:annualPct+'%' }} />
              </div>
              <div className="progress-label">{annualPct}% · נשארו {12 - new Date().getMonth()} חודשים</div>
            </div>
            <div style={{ borderTop:'1px solid rgba(255,255,255,.2)', paddingTop:8 }}>
              <div className="goal-row">
                <div>
                  <div className="goal-label">יעד החודש</div>
                  <div className="goal-value" style={{ fontSize:16 }}>{fmt(won)} <span className="goal-of">/ {fmtN(monthly)}</span></div>
                </div>
                <div style={{ textAlign:'left' }}>
                  <div className="goal-label">לידים פעילים</div>
                  <div className="goal-value" style={{ fontSize:24 }}>{activeLeads.length}</div>
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width:monthlyPct+'%' }} />
              </div>
            </div>
          </div>
        )}

        <div className="stat-row">
          <div className="stat-box">
            <div className="stat-num" style={{ color: todayMeetings.length > 0 ? '#5DCAA5' : 'rgba(255,255,255,.5)' }}>{todayMeetings.length}</div>
            <div className="stat-lbl">📅 פגישות היום</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color: staleLeads.length > 0 ? '#F09595' : 'rgba(255,255,255,.5)' }}>{staleLeads.length}</div>
            <div className="stat-lbl">⚠️ ללא מגע</div>
          </div>
          <div className="stat-box">
            <div className="stat-num" style={{ color:'#5DCAA5' }}>{perf?.won_count || 0}</div>
            <div className="stat-lbl">🏆 סגירות</div>
          </div>
        </div>
      </div>

      {/* MAIN TABS */}
      <div style={{ display:'flex', background:'var(--card)', borderBottom:'1px solid var(--border)' }}>
        {[
          { key:'home', label:'בית' },
          { key:'meetings', label: todayMeetings.length > 0 ? `פגישות (${todayMeetings.length})` : 'פגישות' },
          { key:'leads', label:'כל הלידים' },
        ].map(t => (
          <button key={t.key} className={`tab ${tab===t.key?'tab--active':''}`} style={{ flex:1 }} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* HOME TAB */}
      {tab === 'home' && (
        <div className="lead-list">
          {/* פגישות היום */}
          {todayMeetings.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:600, color:'#0F6E56', padding:'8px 0 4px', textTransform:'uppercase', letterSpacing:.3 }}>📅 פגישות היום</div>
              {todayMeetings.map(l => (
                <div key={l.id} style={{ background:'#E1F5EE', borderRadius:12, padding:'12px 14px', marginBottom:8, border:'1px solid #9FE1CB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#085041' }}>{l.project_address}</div>
                    <div style={{ fontSize:12, color:'#0F6E56', marginTop:2 }}>{l.client_name}</div>
                  </div>
                  <div style={{ fontSize:20, fontWeight:700, color:'#085041' }}>
                    {new Date(l.visit_datetime).toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* דורש טיפול */}
          {staleLeads.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:600, color:'#A32D2D', padding:'8px 0 4px', textTransform:'uppercase', letterSpacing:.3 }}>⚠️ דורש טיפול עכשיו</div>
              {staleLeads.map(l => (
                <LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead} />
              ))}
            </>
          )}

          {/* לידים פעילים */}
          {activeLeads.filter(l => daysSince(l.last_contact_at || l.updated_at) < 7).length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text2)', padding:'8px 0 4px', textTransform:'uppercase', letterSpacing:.3 }}>לידים פעילים</div>
              {activeLeads.filter(l => daysSince(l.last_contact_at || l.updated_at) < 7).map(l => (
                <LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead} />
              ))}
            </>
          )}

          {leads.length === 0 && (
            <div style={{ textAlign:'center', padding:'40px 20px' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📞</div>
              <div style={{ fontSize:16, fontWeight:500, marginBottom:8 }}>אין לידים עדיין</div>
              <div style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>קיבלת שיחה נכנסת? הוסף אותה עכשיו</div>
              <button className="btn-primary" onClick={() => setShowAdd(true)}>+ הוסף את הליד הראשון</button>
            </div>
          )}
        </div>
      )}

      {/* MEETINGS TAB */}
      {tab === 'meetings' && (
        <MeetingsView agentId={session.user.id} isManager={false} />
      )}

      {/* ALL LEADS TAB */}
      {tab === 'leads' && (
        <div>
          <div style={{ padding:'10px 16px 0' }}>
            <input
              placeholder="🔍 חפש לפי כתובת, שם, טלפון..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--card)', color:'var(--text)', fontSize:14 }}
            />
          </div>
          <div className="tab-row">
            {[
              { key:'active', label:'פעיל' },
              { key:'closed_won', label:'בביצוע' },
              { key:'completed', label:'הושלם' },
              { key:'lost', label:'אבוד' },
              { key:'frozen', label:'🧊' },
              { key:'all', label:'הכל' },
            ].map(t => (
              <button key={t.key} className={`tab ${filter===t.key?'tab--active':''}`} onClick={() => setFilter(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="lead-list">
            {visibleLeads.length === 0 && <div className="empty-state">אין לידים להצגה</div>}
            {visibleLeads.map(l => (
              <LeadCard key={l.id} lead={l} onUpdate={load} onSchedule={setSchedLead} />
            ))}
          </div>
        </div>
      )}

      {tab !== 'meetings' && <button className="fab" onClick={() => setShowAdd(true)}>+</button>}

      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
      {schedLead && <ScheduleVisitModal lead={schedLead} onClose={() => setSchedLead(null)} onSaved={() => { setSchedLead(null); load() }} />}
    </div>
  )
}
