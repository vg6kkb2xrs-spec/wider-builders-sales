import { useEffect, useState } from 'react'
import { getMyLeads, getMyPerformance, updateLeadStage, stageInfo, STAGES } from '../lib/supabase'
import AddLeadModal from '../components/AddLeadModal'
import ScheduleVisitModal from '../components/ScheduleVisitModal'
import { supabase } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '—'

export default function AgentDashboard({ session }) {
  const [leads, setLeads] = useState([])
  const [perf, setPerf] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [schedLead, setSchedLead] = useState(null)
  const [filter, setFilter] = useState('active')

  const load = async () => {
    const [l, p] = await Promise.all([getMyLeads(), getMyPerformance()])
    setLeads(l)
    setPerf(p)
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

  const monthlyPct = perf
    ? Math.min(100, Math.round((perf.won_value / perf.monthly_target) * 100)) || 0
    : 0

  const agentName = session.user.user_metadata?.full_name?.split(' ')[0] || 'סוכן'

  return (
    <div className="app-shell" dir="rtl">
      {/* Header */}
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

        {perf && (
          <div className="goal-card">
            <div className="goal-row">
              <div>
                <div className="goal-label">יעד חודשי</div>
                <div className="goal-value">{fmt(perf.won_value)} <span className="goal-of">/ {fmt(perf.monthly_target)}</span></div>
              </div>
              <div style={{textAlign:'left'}}>
                <div className="goal-label">לידים פעילים</div>
                <div className="goal-value" style={{fontSize:28}}>{perf.active_leads}</div>
              </div>
            </div>
            <div className="progress-track">
              <div className="progress-bar" style={{width: monthlyPct + '%'}} />
            </div>
            <div className="progress-label">{monthlyPct}% מהיעד</div>
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

      {/* Filter tabs */}
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

      {/* Lead list */}
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

              {/* Stage actions */}
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

      {/* FAB */}
      <button className="fab" onClick={() => setShowAdd(true)}>+</button>

      {/* Modals */}
      {showAdd && (
        <AddLeadModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />
      )}
      {schedLead && (
        <ScheduleVisitModal lead={schedLead} onClose={() => setSchedLead(null)} onSaved={() => { setSchedLead(null); load() }} />
      )}
    </div>
  )
}
