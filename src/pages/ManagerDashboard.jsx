import MeetingsView from './MeetingsView'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => `$${Number(n || 0).toLocaleString()}`

const STAGE_LABELS = {
  incoming_call: 'שיחה נכנסת',
  visit_scheduled: 'ביקור מתוכנן',
  proposal_sent: 'הצעה הוגשה',
  negotiation: 'במשא ומתן',
  in_progress: 'בביצוע',
  closed_won: 'בוצע',
  closed_lost: 'אבוד',
}

const STAGE_COLORS = {
  incoming_call:   { bg: '#E6F1FB', color: '#185FA5' },
  visit_scheduled: { bg: '#FAEEDA', color: '#854F0B' },
  proposal_sent:   { bg: '#EEEDFE', color: '#534AB7' },
  negotiation:     { bg: '#FAECE7', color: '#993C1D' },
  in_progress:     { bg: '#E1F5EE', color: '#0F6E56' },
  closed_won:      { bg: '#EAF3DE', color: '#3B6D11' },
  closed_lost:     { bg: '#FCEBEB', color: '#A32D2D' },
}

function calcMonthlyTarget(annualTarget, retroSales) {
  const now = new Date()
  const monthsLeft = 12 - now.getMonth()
  const remaining = Math.max(0, annualTarget - retroSales)
  return monthsLeft > 0 ? Math.round(remaining / monthsLeft) : 0
}

export default function ManagerDashboard({ session }) {
  const [view, setView] = useState('agents')
  const [agents, setAgents] = useState([])
  const [leads, setLeads] = useState([])
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [newAgent, setNewAgent] = useState({ name: '', email: '', annual_target: '', retro_sales: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const { data: a } = await supabase
      .from('agents')
      .select('*')
      .neq('email', session.user.email)

    const { data: perf } = await supabase
      .from('agent_performance')
      .select('*')
      .neq('email', session.user.email)

    const perfMap = {}
    ;(perf || []).forEach(p => { perfMap[p.id] = p })

    const merged = (a || []).map(ag => ({ ...ag, ...(perfMap[ag.id] || {}) }))
    setAgents(merged)

    const { data: l } = await supabase
      .from('leads')
      .select('*, agents(name)')
      .order('updated_at', { ascending: false })
    setLeads(l || [])
  }

  useEffect(() => { load() }, [])

  const startEdit = (agent) => {
    setEditing(agent.id)
    setEditForm({
      name: agent.name,
      annual_target: agent.annual_target || 0,
      retro_sales: agent.retro_sales || 0,
    })
  }

  const saveAgent = async (agentId) => {
    setSaving(true)
    const annual = Number(editForm.annual_target)
    const retro = Number(editForm.retro_sales)
    const monthly = calcMonthlyTarget(annual, retro)
    await supabase.from('agents').update({
      name: editForm.name,
      annual_target: annual,
      retro_sales: retro,
      monthly_target: monthly,
    }).eq('id', agentId)
    setEditing(null)
    setSaving(false)
    load()
  }

  const addAgent = async () => {
    if (!newAgent.name.trim()) return setError('שם חובה')
    if (!newAgent.email.trim()) return setError('אימייל חובה')
    if (!newAgent.annual_target) return setError('יעד שנתי חובה')
    setSaving(true)
    setError('')
    const annual = Number(newAgent.annual_target)
    const retro = Number(newAgent.retro_sales || 0)
    const monthly = calcMonthlyTarget(annual, retro)

    // בדיקה אם המשתמש כבר קיים ב-auth
    const { data: existing } = await supabase
      .from('agents')
      .select('id')
      .eq('email', newAgent.email)
      .single()

    if (existing) {
      setError('סוכן עם אימייל זה כבר קיים')
      setSaving(false)
      return
    }

    // מחפש UUID של המשתמש ב-auth אם כבר נכנס
    const { data: authUsers } = await supabase.auth.admin?.listUsers?.() || { data: null }

    setError('הסוכן צריך להיכנס לאפליקציה פעם אחת כדי להופיע. לאחר כניסתו, ערוך את הרשומה שלו כאן.')
    setSaving(false)
    setShowAddAgent(false)
    load()
  }

  const totalWon = agents.reduce((s, a) => s + Number(a.won_value || 0), 0)
  const totalRetro = agents.reduce((s, a) => s + Number(a.retro_sales || 0), 0)
  const totalAnnual = agents.reduce((s, a) => s + Number(a.annual_target || 0), 0)
  const totalProgress = totalWon + totalRetro
  const annualPct = totalAnnual > 0 ? Math.min(100, Math.round((totalProgress / totalAnnual) * 100)) : 0

  return (
    <div className="app-shell" dir="rtl">
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greeting">דאשבורד מנהל 👔</div>
            <div className="hero-sub">{new Date().toLocaleDateString('he-IL', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          </div>
          <button className="btn-icon" onClick={() => supabase.auth.signOut()}>⎋</button>
        </div>

        <div className="goal-card">
          <div className="goal-row">
            <div>
              <div className="goal-label">סה"כ מכירות (כולל קודמות)</div>
              <div className="goal-value">{fmt(totalProgress)} <span className="goal-of">/ {fmt(totalAnnual)}</span></div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="goal-label">סוכנים</div>
              <div className="goal-value" style={{ fontSize: 28 }}>{agents.length}</div>
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: annualPct + '%' }} />
          </div>
          <div className="progress-label">{annualPct}% מהיעד השנתי הכולל</div>
        </div>
      </div>

      <div className="tab-row">
        {[
          { key: 'agents', label: 'סוכנים ויעדים' },
          { key: 'leads',  label: 'כל הלידים' },
        ].map(t => (
          <button key={t.key} className={`tab ${view === t.key ? 'tab--active' : ''}`} onClick={() => setView(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'agents' && (
        <div className="lead-list">
          {error && <div style={{ background: '#FCEBEB', color: '#A32D2D', padding: '12px 16px', borderRadius: 10, fontSize: 13 }}>{error}</div>}

          {agents.map(agent => {
            const annual = Number(agent.annual_target || 0)
            const retro = Number(agent.retro_sales || 0)
            const won = Number(agent.won_value || 0)
            const total = retro + won
            const pct = annual > 0 ? Math.min(100, Math.round((total / annual) * 100)) : 0
            const dynamicMonthly = calcMonthlyTarget(annual, retro + won)

            return (
              <div className="lead-card" key={agent.id}>
                {editing === agent.id ? (
                  <div>
                    <div className="lead-address" style={{ marginBottom: 12 }}>עריכת {agent.name}</div>

                    <div className="form-group">
                      <label>שם</label>
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                    </div>

                    <div className="form-group">
                      <label>יעד שנתי ($)</label>
                      <input type="number" value={editForm.annual_target} onChange={e => setEditForm(f => ({ ...f, annual_target: e.target.value }))} />
                    </div>

                    <div className="form-group">
                      <label>מכירות שבוצעו לפני המערכת ($)</label>
                      <input type="number" value={editForm.retro_sales} onChange={e => setEditForm(f => ({ ...f, retro_sales: e.target.value }))} placeholder="0" />
                    </div>

                    <div style={{ background: '#E1F5EE', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#0F6E56', marginBottom: 12 }}>
                      יעד חודשי מחושב: {fmt(calcMonthlyTarget(Number(editForm.annual_target), Number(editForm.retro_sales)))}
                      <div style={{ fontSize: 11, marginTop: 2, opacity: 0.8 }}>
                        (יעד שנתי פחות מכירות קודמות, חלקי חודשים שנשארו)
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={() => saveAgent(agent.id)} disabled={saving}>
                        {saving ? 'שומר...' : 'שמור'}
                      </button>
                      <button className="btn-action" style={{ background: '#eee', color: '#333' }} onClick={() => setEditing(null)}>ביטול</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="lead-header">
                      <div className="lead-address">{agent.name}</div>
                      <button className="btn-action" style={{ fontSize: 12 }} onClick={() => startEdit(agent)}>✏️ ערוך</button>
                    </div>

                    <div style={{ fontSize: 22, fontWeight: 600, margin: '8px 0 4px', color: '#1D9E75' }}>
                      {fmt(total)} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text2)' }}>/ {fmt(annual)} שנתי</span>
                    </div>

                    <div className="progress-track" style={{ background: 'rgba(0,0,0,0.08)', marginBottom: 8 }}>
                      <div className="progress-bar" style={{ width: pct + '%', background: '#1D9E75' }} />
                    </div>

                    <div className="lead-meta">
                      {retro > 0 && <span>📦 קודם: {fmt(retro)}</span>}
                      <span>🏆 מהמערכת: {fmt(won)}</span>
                      <span>📋 לידים: {agent.active_leads || 0}</span>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 13, background: '#E6F1FB', borderRadius: 8, padding: '8px 12px', color: '#185FA5' }}>
                      יעד חודשי נוכחי: {fmt(dynamicMonthly)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {agents.length === 0 && (
            <div className="empty-state">כל סוכן צריך להיכנס לאפליקציה פעם אחת כדי להופיע כאן</div>
          )}

          <div style={{ padding: '0 0 20px' }}>
            <button className="btn-primary" onClick={() => setShowAddAgent(true)}>+ הוסף סוכן</button>
          </div>
        </div>
      )}

      {view === 'meetings' && (
        <MeetingsView agentId={session.user.id} isManager={true} />
      )}

      {view === 'leads' && (
        <div className="lead-list">
          {leads.map(lead => {
            const s = STAGE_COLORS[lead.stage] || STAGE_COLORS.incoming_call
            return (
              <div className="lead-card" key={lead.id}>
                <div className="lead-header">
                  <div className="lead-address">{lead.project_address}</div>
                  <span className="stage-badge" style={{ background: s.bg, color: s.color }}>{STAGE_LABELS[lead.stage]}</span>
                </div>
                <div className="lead-meta">
                  <span>{lead.client_name}</span>
                  {lead.estimated_value && <span>💰 {fmt(lead.estimated_value)}</span>}
                  {lead.agents?.name && <span>👤 {lead.agents.name}</span>}
                </div>
                {lead.description && <div className="lead-desc">{lead.description}</div>}
              </div>
            )
          })}
          {leads.length === 0 && <div className="empty-state">אין לידים עדיין</div>}
        </div>
      )}

      {showAddAgent && (
        <div className="modal-overlay" onClick={() => setShowAddAgent(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="modal-header">
              <h2>סוכן חדש</h2>
              <button className="btn-icon" onClick={() => setShowAddAgent(false)}>✕</button>
            </div>
            <div style={{ background: '#FAEEDA', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#854F0B', marginBottom: 16 }}>
              הסוכן צריך להיכנס לאפליקציה פעם אחת עם ה-Google שלו לפני שתוכל לערוך את הפרטים שלו כאן.
            </div>
            <div className="form-group">
              <label>שם מלא</label>
              <input placeholder="Tzvi Wider" value={newAgent.name} onChange={e => setNewAgent(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>אימייל Google</label>
              <input placeholder="tzvi@example.com" type="email" value={newAgent.email} onChange={e => setNewAgent(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>יעד שנתי ($)</label>
              <input type="number" placeholder="2000000" value={newAgent.annual_target} onChange={e => setNewAgent(f => ({ ...f, annual_target: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>מכירות שבוצעו לפני המערכת ($)</label>
              <input type="number" placeholder="0" value={newAgent.retro_sales} onChange={e => setNewAgent(f => ({ ...f, retro_sales: e.target.value }))} />
            </div>
            {error && <div className="form-error">{error}</div>}
            <button className="btn-primary" onClick={addAgent} disabled={saving}>{saving ? 'שומר...' : 'הוסף סוכן'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
