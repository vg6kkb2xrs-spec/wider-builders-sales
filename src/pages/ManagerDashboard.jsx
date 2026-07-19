import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import MeetingsView from './MeetingsView'
import CashflowView from './CashflowView'
import ReceiptsView from './ReceiptsView'
import Icon from '../components/Icon'

const fmt=(n)=>`$${Number(n||0).toLocaleString()}`
const fmtK=(n)=>{const v=Number(n||0);return v>=1000000?`$${(v/1000000).toFixed(1)}M`:v>=1000?`$${Math.round(v/1000)}K`:`$${v}`}

function calcMonthly(annual,retro,won){
  const left=12-new Date().getMonth()
  return left>0?Math.round(Math.max(0,annual-retro-won)/left):0
}

function EditModal({agent,onClose,onSaved}){
  const [form,setForm]=useState({name:agent.name,annual_target:agent.annual_target||0,retro_sales:agent.retro_sales||0})
  const [saving,setSaving]=useState(false)
  const monthly=calcMonthly(Number(form.annual_target),Number(form.retro_sales),Number(agent.won_value||0))
  const save=async()=>{
    setSaving(true)
    await supabase.from('agents').update({name:form.name,annual_target:Number(form.annual_target),retro_sales:Number(form.retro_sales),monthly_target:monthly}).eq('id',agent.id)
    setSaving(false);onSaved();onClose()
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} dir="rtl">
        <div className="modal-head">
          <h2>עריכת יעדים</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="field"><label>שם</label><input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
        <div className="field"><label>יעד שנתי ($)</label><input type="number" value={form.annual_target} onChange={e=>setForm(p=>({...p,annual_target:e.target.value}))}/></div>
        <div className="field"><label>מכירות קודמות ($)</label><input type="number" value={form.retro_sales} onChange={e=>setForm(p=>({...p,retro_sales:e.target.value}))}/></div>
        <div style={{background:'var(--accent-soft)',borderRadius:10,padding:'10px 12px',fontSize:13,color:'var(--accent-deep)',marginBottom:12}}>
          יעד חודשי מחושב: <strong>{fmtK(monthly)}</strong>
          <div style={{fontSize:11,opacity:.75,marginTop:2}}>({12-new Date().getMonth()} חודשים שנשארו)</div>
        </div>
        <button className="submit-btn" onClick={save} disabled={saving}>{saving?'שומר...':'שמור'}</button>
      </div>
    </div>
  )
}

function AgentCard({agent,onEdit}){
  const annual=Number(agent.annual_target||0)
  const retro=Number(agent.retro_sales||0)
  const won=Number(agent.won_value||0)
  const total=retro+won
  const pct=annual>0?Math.min(100,Math.round(total/annual*100)):0
  const monthly=calcMonthly(annual,retro,won)
  return(
    <div className="mgr-card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div>
          <div style={{fontSize:15,fontWeight:600,color:'var(--ink)'}}>{agent.name}</div>
          <div style={{fontSize:11,color:'var(--ink2)',marginTop:1}}>{agent.active_leads||0} לידים פעילים</div>
        </div>
        <button onClick={()=>onEdit(agent)}
          style={{fontSize:12,color:'var(--accent-deep)',background:'var(--accent-soft)',border:'.5px solid var(--accent)',borderRadius:20,padding:'5px 12px',cursor:'pointer',fontFamily:'inherit'}}>
          ערוך יעדים
        </button>
      </div>
      <div style={{fontSize:26,fontWeight:700,color:'var(--accent-deep)',marginBottom:2}}>{fmtK(total)}</div>
      <div style={{fontSize:11,color:'var(--ink2)',marginBottom:6}}>מתוך {fmtK(annual)} שנתי · יעד חודשי {fmtK(monthly)}</div>
      <div style={{background:'var(--line)',borderRadius:3,height:4,marginBottom:6,overflow:'hidden'}}>
        <div style={{background:'var(--accent-deep)',height:4,borderRadius:3,width:pct+'%',transition:'width .5s'}}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
        {[{n:agent.won_count||0,l:'סגירות'},{n:agent.active_leads||0,l:'פעילים'},{n:fmtK(retro),l:'קודמות'}].map(s=>(
          <div key={s.l} style={{background:'var(--input)',borderRadius:10,padding:'7px 8px',textAlign:'center'}}>
            <div style={{fontSize:13,fontWeight:600,color:'var(--ink)'}}>{s.n}</div>
            <div style={{fontSize:10,color:'var(--ink2)',marginTop:1}}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ManagerDashboard({session}){
  const [tab,setTab]=useState('agents')
  const [financeView,setFinanceView]=useState('cashflow')
  const [agents,setAgents]=useState([])
  const [leads,setLeads]=useState([])
  const [editing,setEditing]=useState(null)

  const load=async()=>{
    const {data:a}=await supabase.from('agent_performance').select('*').neq('email',session.user.email)
    const {data:l}=await supabase.from('leads').select('*, agents(name)').order('updated_at',{ascending:false})
    setAgents(a||[]);setLeads(l||[])
  }
  useEffect(()=>{load()},[])

  const totalWon=agents.reduce((s,a)=>s+Number(a.won_value||0)+Number(a.retro_sales||0),0)
  const totalAnnual=agents.reduce((s,a)=>s+Number(a.annual_target||0),0)
  const totalPct=totalAnnual>0?Math.min(100,Math.round(totalWon/totalAnnual*100)):0
  const todayM=leads.filter(l=>l.visit_datetime&&new Date(l.visit_datetime).toDateString()===new Date().toDateString())

  const STAGE_LABELS={incoming_call:'שיחה נכנסת',in_progress:'בטיפול',proposal_sent:'מחכה לתשובה',closed_won:'עובדים אצלו',completed:'הושלם',closed_lost:'אבוד',frozen:'קפוא'}
  const STAGE_BG={incoming_call:'var(--line2)',in_progress:'var(--line2)',proposal_sent:'var(--line2)',closed_won:'var(--accent-soft)',completed:'var(--accent-soft)',closed_lost:'var(--alert-soft)',frozen:'var(--line2)'}
  const STAGE_COLOR={incoming_call:'var(--ink2)',in_progress:'var(--ink2)',proposal_sent:'var(--ink2)',closed_won:'var(--accent-deep)',completed:'var(--accent-deep)',closed_lost:'var(--alert-deep)',frozen:'var(--ink3)'}

  return(
    <div className="app" dir="rtl">
      {editing&&<EditModal agent={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}}/>}

      {/* HERO */}
      <div className="h">
        <div className="h-top">
          <div><div className="h-name">דאשבורד מנהל</div><div className="h-date">{new Date().toLocaleDateString('he-IL',{weekday:'long',month:'long',day:'numeric'})}</div></div>
          <button className="h-btn" onClick={()=>supabase.auth.signOut()}>⎋</button>
        </div>
        <div className="h-amt">{fmtK(totalWon)}</div>
        <div className="h-sub">סה"כ צוות · מתוך {fmtK(totalAnnual)} · {totalPct}%</div>
        <div className="h-prog"><div className="h-fill" style={{width:totalPct+'%'}}/></div>
        <div className="h-grid">
          <div className="h-cell"><div className="h-cell-n">{agents.length}</div><div className="h-cell-l">סוכנים</div></div>
          <div className="h-cell"><div className="h-cell-n" style={{color:todayM.length>0?'var(--accent)':'rgba(255,255,255,.4)'}}>{todayM.length}</div><div className="h-cell-l">פגישות היום</div></div>
          <div className="h-cell"><div className="h-cell-n">{leads.filter(l=>!['completed','closed_lost','frozen'].includes(l.stage)).length}</div><div className="h-cell-l">לידים פעילים</div></div>
        </div>
      </div>

      {/* AGENTS TAB */}
      {tab==='agents'&&<div className="body">
        {todayM.length>0&&(
          <div className="today-card">
            <div className="tc-hdr"><div className="tc-dot"/><div className="tc-ttl">פגישות הצוות היום</div></div>
            {todayM.map(l=>(
              <div key={l.id} className="tc-row">
                <div><div className="tc-addr">{l.project_address}</div><div className="tc-client">{l.agents?.name}</div></div>
                <div className="tc-time">{new Date(l.visit_datetime).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            ))}
          </div>
        )}
        <div className="sec-hdr">ביצועי סוכנים</div>
        {agents.map(a=><AgentCard key={a.id} agent={a} onEdit={setEditing}/>)}
        {agents.length===0&&<div className="empty"><div className="empty-sub">סוכנים יופיעו לאחר כניסה ראשונה</div></div>}
      </div>}

      {/* MEETINGS TAB */}
      {tab==='meetings'&&<MeetingsView agentId={session.user.id} isManager={true}/>}
      {tab==='cashflow'&&(
        <>
          <div className="seg">
            <button className={financeView==='cashflow'?'on':''} onClick={()=>setFinanceView('cashflow')}>תזרים</button>
            <button className={financeView==='receipts'?'on':''} onClick={()=>setFinanceView('receipts')}>קבלות</button>
          </div>
          {financeView==='cashflow' ? <CashflowView isManager={true}/> : <ReceiptsView isManager={true}/>}
        </>
      )}

      {/* LEADS TAB */}
      {tab==='leads'&&<div className="body">
        <div style={{paddingTop:8}}>
          {leads.map(lead=>(
            <div key={lead.id} className="lead-card">
              <div style={{flex:1,minWidth:0}}>
                <div className="l-addr">{lead.project_address}</div>
                <div className="l-client">{lead.client_name}</div>
                {lead.estimated_value&&<div className="l-amt">${Number(lead.estimated_value).toLocaleString()}</div>}
                {lead.agents?.name&&<div style={{fontSize:10,color:'var(--ink2)',marginTop:2}}>👤 {lead.agents.name}</div>}
              </div>
              <span className="s-pill" style={{background:STAGE_BG[lead.stage]||'var(--input)',color:STAGE_COLOR[lead.stage]||'var(--ink2)'}}>{STAGE_LABELS[lead.stage]}</span>
            </div>
          ))}
          {leads.length===0&&<div className="empty"><div className="empty-sub">אין לידים עדיין</div></div>}
        </div>
      </div>}

      {/* BOTTOM NAV */}
      <nav className="nav">
        <button className={`nb ${tab==='agents'?'on':''}`} onClick={()=>setTab('agents')}>
          <div className="nb-icon"><Icon name="users" size={22}/></div>סוכנים
        </button>
        <button className={`nb ${tab==='meetings'?'on':''}`} onClick={()=>setTab('meetings')} style={{position:'relative'}}>
          <div className="nb-icon"><Icon name="calendar" size={22}/></div>
          {todayM.length>0&&<span className="nb-badge">{todayM.length}</span>}
          פגישות
        </button>
        <button className={`nb ${tab==='leads'?'on':''}`} onClick={()=>setTab('leads')}>
          <div className="nb-icon"><Icon name="list" size={22}/></div>לידים
        </button>
        <button className={`nb ${tab==='cashflow'?'on':''}`} onClick={()=>setTab('cashflow')}>
          <div className="nb-icon"><Icon name="cash" size={22}/></div>תזרים
        </button>
      </nav>
    </div>
  )
}


