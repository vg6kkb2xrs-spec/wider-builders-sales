import { useEffect, useState } from 'react'
import { getMyLeads, getMyPerformance, updateLeadStage, stageInfo, STAGES } from '../lib/supabase'
import AddLeadModal from '../components/AddLeadModal'
import ScheduleVisitModal from '../components/ScheduleVisitModal'
import { supabase } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '—'
const fmtRequired = (n) => `$${Number(n || 0).toLocaleString()}`

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

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const [l, p] = await Promise.all([getMyLeads(), getMyPerformance()])
    const { data: ag } = await supabase.from('agents').select('*').eq('id', user.id).single()
    setLeads(l)
    setPerf(p)
    setAgent(ag)
  }

  useEffect(() => { load() }, [])

  const handleStageChange = async (leadId, newStage) => {
    await updateLeadStage(leadId, newStage)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))
    load()
  }

  const visibleLeads = leads.filter(l => {
    if (filter === 'active') return !['closed_won','closed_lost'].includes(l.stage)
    if (filter === 'won')    return l.stage === 'closed_won'
    if (filter === 'lost')   return l.stage === 'closed_lost'
    return true
  })

  const annualTarget  = Number(agent?.annual_target || 0)
  const retroSales    = Number(agent?.retro_sales || 0)
  const wonValue      = Number(perf?.won_value || 0)
  const totalProgress = retroSales + wonValue
  const annualPct     = annualTarget > 0 ? Math.min(100, Math.round((totalProgress / annualTarget) * 100)) : 0
  const dynamicMonthly = calcMonthlyTarget(annualTarget, retroSales, wonValue)
  const monthlyPct    = dynamicMonthly > 0 ? Math.min(100, Math.round((wonValue / dynamicMonthly) * 100)) : 0

  const agentName = session.user.user_metadata?.full_name?.split(' ')[0] || 'סוכן'

  return (
    <div className="app-shell" dir="rtl">
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greeting">שלום, {agentName} 👋</div>
            <div className="hero-sub">{new Date().toLocaleDateString('he-IL', { weekday:'long', month:'long', day:'numeric' })}</div>
          </div>
          <button className="btn-icon" onClick={() => supabase.auth.signOut()}>
            <span style={{fontSize:18}}>⎋</span>
          </button>
        </div>

        {agent && (
          <div className="goal-card">
            {/* יעד שנתי — גדול ובולט */}
            <div style={{textAlign:'center', marginBottom:12}}>
              <div className="goal-label">יעד שנתי</div>
              <div style={{fontSize:32, fontWeight:700, color:'white', lineHeight:1.1}}>
                {fmtRequired(totalProgress)}
              </div>
              <div style={{fontSize:14, opacity:0.8, marginTop:2}}>
                מתוך {fmtRequired(annualTarget)}
              </div>
              <div className="progress-track" style={{marginTop:8}}>
                <div className="progress-bar" style={{width: annualPct + '%'}} />
              </div>
              <div className="progress-label">{annualPct}% מהיעד השנתי</div>
            </div>

            {/* יעד חודשי */}
            <div style={{borderTop:'1px solid rgba(255,255,255,0.2)', paddingTop:10, marginTop:4}}>
              <div className="goal-row">
                <div>
                  <div className="goal-label">יעד חודשי נוכחי</div>
                  <div className="goal-value" style={{fontSize:20}}>{fmt(wonValue)} <span className="goal-of">/ {fmtRequired(dynamicMonthly)}</span></div>
                </div>
                <div style={{textAlign:'left'}}>
                  <div className="goal-label">לידים פעילים</div>
                  <div className="goal-value" style={{fontSize:28}}>{perf?.active_leads || 0}</div>
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{width: monthlyPct + '%'}} />
              </div>
              <div className="progress-label">{monthlyPct}% מהיעד החודשי</div>
            </div>
          </div>
        )}

        <div className="stat-row">
          {[
            { label:'סגורות החודש', val: perf?.won_count || 0, color:'#5DCAA5' },
            { label:'בביצוע', val: leads.filter(l=>l.stage==='in_progress').length, color:'#EF9F27' },
            { label:'המתנה להצעה', val: leads.filter(l=>l.stage==='visit_scheduled').length, color:'#AFA9EC' },
          ].map(s => (
            <div className="stat-box" key={s.label}>
              <div className="stat-num" style={{color:s.color}}>{s.val}</div>
              <div className="stat-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="tab-row">
        {[
          {key:'active', label:'פעיל'},
          {key:'won',    label:'בוצע'},
          {key:'lost',   label:'אבוד'},
          {key:'all',    label:'הכל'},
        ].map(t => (
          <button key={t.key} className={`tab ${filter===t.key?'tab--active':''}`} onClick={()=>setFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="lead-list">
        {visibleLeads.length === 0 && (
          <div className="empty-state">אין לידים להצגה</div>
        )}
        {visibleLeads.map(lead => {
          const s = stageInfo(lead.stage)
          return (
            <div className="lead-card" key={lead.id}>
              <div className="lead-header">
                <div className="lead-address">{lead.project_address}</div>
                <span className="stage-badge" style={{background:s.bg, color:s.color}}>{s.label}</span>
              </div>
              <div className="lead-meta">
                <span>{lead.client_name}</span>
                {lead.phone && <span>📞 {lead.phone}</span>}
                {lead.estimated_value && <span style={{fontWeight:500}}>💰 {fmt(lead.estimated_value)}</span>}
              </div>
              {lead.description && (
                <div className="lead-desc">{lead.description}</div>
              )}
              {lead.visit_datetime && (
                <div className="lead-visit">
                  📅 {new Date(lead.visit_datetime).toLocaleDateString('he-IL', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                </div>
              )}
              <div className="lead-actions">
                {lead.stage === 'incoming_call' && (
                  <button className="btn-action" onClick={() => setSchedLead(lead)}>
                    קבע ביקור ← יומן
                  </button>
                )}
                {lead.stage !== 'closed_won' && lead.stage !== 'closed_lost' && (
                  <select
                    className="stage-select"
                    value={lead.stage}
                    onChange={e => handleStageChange(lead.id, e.target.value)}
                  >
                    {STAGES.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <button className="fab" onClick={() => setShowAdd(true)}>+</button>

      {showAdd && (
        <AddLeadModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />
      )}
      {schedLead && (
        <ScheduleVisitModal lead={schedLead} onClose={() => setSchedLead(null)} onSaved={() => { setSchedLead(null); load() }} />
      )}
    </div>
  )
}
