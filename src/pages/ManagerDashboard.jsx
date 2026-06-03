import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MeetingsView from './MeetingsView'

const fmt  = (n) => `$${Number(n || 0).toLocaleString()}`

function calcMonthly(annual, retro, won) {
  const left = 12 - new Date().getMonth()
  return left > 0 ? Math.round(Math.max(0, annual - retro - won) / left) : 0
}

function EditModal({ agent, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: agent.name,
    annual_target: agent.annual_target || 0,
    retro_sales: agent.retro_sales || 0,
  })
  const [saving, setSaving] = useState(false)

  const monthly = calcMonthly(Number(form.annual_target), Number(form.retro_sales), Number(agent.won_value || 0))

  const save = async () => {
    setSaving(true)
    await supabase.from('agents').update({
      name: form.name,
      annual_target: Number(form.annual_target),
      retro_sales: Number(form.retro_sales),
      monthly_target: monthly,
    }).eq('id', agent.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-header">
          <h2>עריכת יעדים — {agent.name}</h2>
          <button className="btn-icon" onClick={onClose} style={{color:'var(--text)'}}>✕</button>
        </div>
        <div className="form-group">
          <label>שם</label>
          <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))}/>
        </div>
        <div className="form-group">
          <label>יעד שנתי ($)</label>
          <input type="number" value={form.annual_target} onChange={e => setForm(p=>({...p,annual_target:e.target.value}))}/>
        </div>
        <div className="form-group">
          <label>מכירות שבוצעו לפני המערכת ($)</label>
          <input type="number" value={form.retro_sales} placeholder="0" onChange={e => setForm(p=>({...p,retro_sales:e.target.value}))}/>
        </div>
        <div style={{background:'#E1F5EE',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#0F6E56',marginBottom:16}}>
          יעד חודשי מחושב: <strong>{fmt(monthly)}</strong>
          <div style={{fontSize:11,opacity:.8,marginTop:2}}>
            (יעד שנתי פחות מכירות קיימות, חלקי {12 - new Date().getMonth()} חודשים שנשארו)
          </div>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'שומר...' : 'שמור שינויים'}
        </button>
      </div>
    </div>
  )
}

function AgentCard({ agent, onEdit }) {
  const annual = Number(agent.annual_target || 0)
  const retro  = Number(agent.retro_sales   || 0)
  const won    = Number(agent.won_value      || 0)
  const total  = retro + won
  const pct    = annual > 0 ? Math.min(100, Math.round(total / annual * 100)) : 0
  const monthly = calcMonthly(annual, retro, won)

  return (
    <div className="mgr-card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <div style={{fontSize:16,fontWeight:600}}>{agent.name}</div>
          <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>
            {agent.active_leads || 0} לידים פעילים
            {agent.active_leads === 0 && ' · אין לידים פעילים'}
          </div>
        </div>
        <button
          onClick={() => onEdit(agent)}
          style={{fontSize:12,color:'#185FA5',background:'#E6F1FB',border:'.5px solid #B5D4F4',borderRadius:8,padding:'5px 12px',cursor:'pointer'}}
        >
          ✏️ ערוך יעדים
        </button>
      </div>

      <div style={{fontSize:24,fontWeight:700,color:'var(--teal)',margin:'4px 0 2px'}}>
        {fmt(total)}
        <span style={{fontSize:14,fontWeight:400,color:'var(--text2)',marginRight:6}}>/ {fmt(annual)} שנתי</span>
      </div>

      <div className="progress-track" style={{background:'rgba(0,0,0,.08)',marginBottom:6}}>
        <div className="progress-bar" style={{width:pct+'%',background:'var(--teal)'}}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
        <div style={{background:'var(--bg)',borderRadius:8,padding:'7px 8px',textAlign:'center'}}>
          <div style={{fontSize:15,fontWeight:600}}>{agent.won_count || 0}</div>
          <div style={{fontSize:10,color:'var(--text2)'}}>סגירות</div>
        </div>
        <div style={{background:'var(--bg)',borderRadius:8,padding:'7px 8px',textAlign:'center'}}>
          <div style={{fontSize:15,fontWeight:600,color:'var(--teal)'}}>{fmt(monthly)}</div>
          <div style={{fontSize:10,color:'var(--text2)'}}>יעד חודשי</div>
        </div>
        {retro > 0 && (
          <div style={{background:'var(--bg)',borderRadius:8,padding:'7px 8px',textAlign:'center'}}>
            <div style={{fontSize:15,fontWeight:600}}>{fmt(retro)}</div>
            <div style={{fontSize:10,color:'var(--text2)'}}>קודמות</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ManagerDashboard({ session }) {
  const [tab, setTab]     = useState('agents')
  const [agents, setAgents] = useState([])
  const [leads, setLeads]   = useState([])
  const [editing, setEditing] = useState(null)

  const load = async () => {
    const { data: a } = await supabase
      .from('agent_performance').select('*')
      .neq('email', session.user.email)

    const { data: l } = await supabase
      .from('leads')
      .select('*, agents(name)')
      .order('updated_at', { ascending: false })

    setAgents(a || [])
    setLeads(l || [])
  }

  useEffect(() => { load() }, [])

  const totalWon    = agents.reduce((s,a) => s + Number(a.won_value||0) + Number(a.retro_sales||0), 0)
  const totalAnnual = agents.reduce((s,a) => s + Number(a.annual_target||0), 0)
  const totalPct    = totalAnnual > 0 ? Math.min(100, Math.round(totalWon / totalAnnual * 100)) : 0

  const todayMeetings = leads.filter(l =>
    l.visit_datetime && new Date(l.visit_datetime).toDateString() === new Date().toDateString()
  )

  const STAGE_LABELS = {
    incoming_call:'שיחה נכנסת', in_progress:'בטיפול',
    proposal_sent:'מחכה לתשובה', closed_won:'עובדים אצלו',
    completed:'הושלם ✅', closed_lost:'אבוד', frozen:'🧊 קפוא',
  }
  const STAGE_COLORS = {
    incoming_call:{bg:'#E6F1FB',color:'#185FA5'}, in_progress:{bg:'#FAEEDA',color:'#854F0B'},
    proposal_sent:{bg:'#EEEDFE',color:'#534AB7'}, closed_won:{bg:'#E1F5EE',color:'#0F6E56'},
    completed:{bg:'#EAF3DE',color:'#3B6D11'}, closed_lost:{bg:'#FCEBEB',color:'#A32D2D'},
    frozen:{bg:'#F1EFE8',color:'#5F5E5A'},
  }

  return (
    <div className="app-shell" dir="rtl">
      {editing && (
        <EditModal agent={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }}/>
      )}

      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-greeting">דאשבורד מנהל 👔</div>
            <div className="hero-sub">{new Date().toLocaleDateString('he-IL',{weekday:'long',month:'long',day:'numeric'})}</div>
          </div>
          <button className="btn-icon" onClick={() => supabase.auth.signOut()}>⎋</button>
        </div>
        <div className="goal-card">
          <div style={{textAlign:'center',marginBottom:8}}>
            <div className="goal-label">סה"כ צוות — שנתי</div>
            <div style={{fontSize:30,fontWeight:700,color:'white',lineHeight:1.1}}>{fmt(totalWon)}</div>
            <div style={{fontSize:13,opacity:.8,marginTop:2}}>מתוך {fmt(totalAnnual)}</div>
            <div className="progress-track" style={{marginTop:8}}>
              <div className="progress-bar" style={{width:totalPct+'%'}}/>
            </div>
            <div className="progress-label">{totalPct}% · {agents.length} סוכנים</div>
          </div>
        </div>
      </div>

      <div style={{display:'flex',background:'var(--card)',borderBottom:'1px solid var(--border)'}}>
        {[
          {key:'agents',label:'סוכנים ויעדים'},
          {key:'meetings',label: todayMeetings.length > 0 ? `פגישות (${todayMeetings.length})` : 'פגישות'},
          {key:'leads',label:'כל הלידים'},
        ].map(t => (
          <button key={t.key} className={`tab ${tab===t.key?'tab--active':''}`} style={{flex:1}} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'agents' && (
        <div className="lead-list">
          {todayMeetings.length > 0 && (
            <>
              <div className="section-header today">📅 פגישות הצוות היום</div>
              {todayMeetings.map(l => (
                <div key={l.id} className="today-card" style={{margin:'0 0 6px'}}>
                  <div>
                    <div className="today-card-addr">{l.project_address}</div>
                    <div className="today-card-client">{l.client_name} · {l.agents?.name}</div>
                  </div>
                  <div className="today-card-time">
                    {new Date(l.visit_datetime).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              ))}
            </>
          )}
          <div className="section-header">ביצועי סוכנים</div>
          {agents.map(a => <AgentCard key={a.id} agent={a} onEdit={setEditing}/>)}
          {agents.length === 0 && (
            <div className="empty-state">סוכנים יופיעו כאן לאחר כניסה ראשונה לאפליקציה</div>
          )}
        </div>
      )}

      {tab === 'meetings' && (
        <MeetingsView agentId={session.user.id} isManager={true}/>
      )}

      {tab === 'leads' && (
        <div className="lead-list">
          {leads.map(lead => {
            const s = STAGE_COLORS[lead.stage] || STAGE_COLORS.incoming_call
            return (
              <div key={lead.id} className="lead-card">
                <div className="lead-header">
                  <div className="lead-address">{lead.project_address}</div>
                  <span className="stage-badge" style={{background:s.bg,color:s.color}}>{STAGE_LABELS[lead.stage]}</span>
                </div>
                <div className="lead-meta">
                  <span>{lead.client_name}</span>
                  {lead.estimated_value && <span>💰 ${Number(lead.estimated_value).toLocaleString()}</span>}
                  {lead.agents?.name && <span>👤 {lead.agents.name}</span>}
                </div>
              </div>
            )
          })}
          {leads.length === 0 && <div className="empty-state">אין לידים עדיין</div>}
        </div>
      )}

      <nav className="bottom-nav">
        <button className={`nav-item ${tab==='agents'?'active':''}`} onClick={() => setTab('agents')}>
          <i className="ti ti-users nav-icon" aria-hidden="true"/>
          סוכנים
        </button>
        <button className={`nav-item ${tab==='meetings'?'active':''}`} onClick={() => setTab('meetings')} style={{position:'relative'}}>
          <i className="ti ti-calendar nav-icon" aria-hidden="true"/>
          {todayMeetings.length > 0 && <span className="nav-badge">{todayMeetings.length}</span>}
          פגישות
        </button>
        <button className={`nav-item ${tab==='leads'?'active':''}`} onClick={() => setTab('leads')}>
          <i className="ti ti-list nav-icon" aria-hidden="true"/>
          לידים
        </button>
      </nav>
    </div>
  )
}
