import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => n ? `$${Number(n).toLocaleString()}` : '$0'

export default function ManagerDashboard({ session }) {
  const [agents, setAgents] = useState([])
  const [leads, setLeads] = useState([])
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('agents')

  const load = async () => {
    const { data: a } = await supabase.from('agent_performance').select('*')
    const { data: l } = await supabase.from('leads').select('*, agents(name)').order('updated_at', { ascending: false })
    setAgents(a || [])
    setLeads(l || [])
  }

  useEffect(() => { load() }, [])

  const startEdit = (agent) => {
    setEditing(agent.id)
    setForm({ monthly_target: agent.monthly_target, annual_target: agent.annual_target, name: agent.name })
  }

  const saveTargets = async (agentId) => {
    setSaving(true)
    await supabase.from('agents').update({
      monthly_target: Number(form.monthly_target),
      annual_target: Number(form.annual_target),
    }).eq('id', agentId)
    setEditing(null)
    setSaving(false)
    load()
  }

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
    incoming_call: { bg: '#E6F1FB', color: '#185FA5' },
    visit_scheduled: { bg: '#FAEEDA', color: '#854F0B' },
    proposal_sent: { bg: '#EEEDFE', color: '#534AB7' },
    negotiation: { bg: '#FAECE7', color: '#993C1D' },
    in_progress: { bg: '#E1F5EE', color: '#0F6E56' },
    closed_won: { bg: '#EAF3DE', color: '#3B6D11' },
    closed_lost: { bg: '#FCEBEB', color: '#A32D2D' },
  }

  const totalWon = agents.reduce((s, a) => s + Number(a.won_value || 0), 0)
  const totalTarget = agents.reduce((s, a) => s + Number(a.monthly_target || 0), 0)

  return (
    <div className="app-shell" dir="rtl">
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greeting">דאשבורד מנהל 👔</div>
            <div className="hero-sub">{new Date().toLocaleDateString('he-IL', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          </div>
          <button className="btn-icon" onClick={() => supabase.auth.signOut()}>
            <span style={{ fontSize: 18 }}>⎋</span>
          </button>
        </div>

        <div className="goal-card">
          <div className="goal-row">
            <div>
              <div className="goal-label">סה"כ מכירות החודש</div>
              <div className="goal-value">{fmt(totalWon)} <span className="goal-of">/ {fmt(totalTarget)}</span></div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="goal-label">סוכנים פעילים</div>
              <div className="goal-value" style={{ fontSize: 28 }}>{agents.length}</div>
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: Math.min(100, Math.round((totalWon / totalTarget) * 100) || 0) + '%' }} />
          </div>
          <div className="progress-label">{Math.min(100, Math.round((totalWon / totalTarget) * 100) || 0)}% מהיעד הכולל</div>
        </div>
      </div>

      <div className="tab-row">
        {[{ key: 'agents', label: 'סוכנים ויעדים' }, { key: 'leads', label: 'כל הלידים' }].map(t => (
          <button key={t.key} className={`tab ${view === t.key ? 'tab--active' : ''}`} onClick={() => setView(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {view === 'agents' && (
        <div className="lead-list">
          {agents.map(agent => {
            const pct = Math.min(100, Math.round((agent.won_value / agent.monthly_target) * 100) || 0)
            return (
              <div className="lead-card" key={agent.id}>
                {editing === agent.id ? (
                  <div>
                    <div className="lead-address" style={{ marginBottom: 12 }}>{agent.name}</div>
                    <div className="form-group">
                      <label>יעד חודשי ($)</label>
                      <input type="number" value={form.monthly_target} onChange={e => setForm(f => ({ ...f, monthly_target: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>יעד שנתי ($)</label>
                      <input type="number" value={form.annual_target} onChange={e => setForm(f => ({ ...f, annual_target: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button className="btn-primary" style={{ flex: 1 }} onClick={() => saveTargets(agent.id)} disabled={saving}>
                        {saving ? 'שומר...' : 'שמור'}
                      </button>
                      <button className="btn-action" style={{ background: 'var(--border)', color: 'var(--text)' }} onClick={() => setEditing(null)}>
                        ביטול
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="lead-header">
                      <div className="lead-address">{agent.name}</div>
                      <button className="btn-action" style={{ fontSize: 12 }} onClick={() => startEdit(agent)}>
                        ✏️ ערוך יעדים
                      </button>
                    </div>
                    <div className="lead-meta">
                      <span>🏆 סגר: {fmt(agent.won_value)}</span>
                      <span>🔄 בביצוע: {fmt(agent.in_progress_value)}</span>
                      <span>📋 לידים פעילים: {agent.active_leads}</span>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>
                        <span>יעד חודשי: {fmt(agent.monthly_target)}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="progress-track" style={{ background: 'rgba(0,0,0,0.08)' }}>
                        <div className="progress-bar" style={{ width: pct + '%', background: 'var(--teal)' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
                      יעד שנתי: {fmt(agent.annual_target)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {agents.length === 0 && (
            <div className="empty-state">
              אין סוכנים עדיין — כל סוכן צריך להיכנס לאפליקציה פעם אחת כדי להופיע כאן
            </div>
          )}
        </div>
      )}

      {view === 'leads' && (
        <div className="lead-list">
          {leads.map(lead => {
            const s = STAGE_COLORS[lead.stage] || STAGE_COLORS.incoming_call
            return (
              <div className="lead-card" key={lead.id}>
                <div className="lead-header">
                  <div className="lead-address">{lead.project_address}</div>
                  <span className="stage-badge" style={{ background: s.bg, color: s.color }}>
                    {STAGE_LABELS[lead.stage]}
                  </span>
                </div>
                <div className="lead-meta">
                  <span>{lead.client_name}</span>
                  {lead.estimated_value && <span>💰 ${Number(lead.estimated_value).toLocaleString()}</span>}
                  {lead.agents?.name && <span>👤 {lead.agents.name}</span>}
                </div>
                {lead.description && <div className="lead-desc">{lead.description}</div>}
              </div>
            )
          })}
          {leads.length === 0 && <div className="empty-state">אין לידים עדיין</div>}
        </div>
      )}
    </div>
  )
}
