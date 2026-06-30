import { useEffect, useState } from 'react'
import { supabase, getTasks, addTask, toggleTask, deleteTask } from '../lib/supabase'

const HE_DAYS = ['א','ב','ג','ד','ה','ו','ש']
const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day)
  date.setHours(0,0,0,0)
  return date
}

function sameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}

function AddTaskModal({ defaultDate, onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [datetime, setDatetime] = useState(() => {
    const d = new Date(defaultDate)
    d.setHours(d.getHours()+1, 0, 0, 0)
    return d.toISOString().slice(0,16)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!title.trim()) return setError('כתוב מה התזכורת')
    if (!datetime) return setError('בחר תאריך ושעה')
    setSaving(true)
    try {
      await addTask(title.trim(), new Date(datetime).toISOString())
      onSaved()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-head">
          <h2>הוסף משימה / תזכורת</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="field">
          <label>מה התזכורת?</label>
          <input placeholder="להתקשר לספק חיפוי..." value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>תאריך ושעה</label>
          <input type="datetime-local" value={datetime} onChange={e => setDatetime(e.target.value)} />
        </div>
        {error && <div className="field-error">{error}</div>}
        <button className="submit-btn" onClick={save} disabled={saving}>{saving ? 'שומר...' : 'הוסף'}</button>
      </div>
    </div>
  )
}

function EventRow({ item, onToggleTask }) {
  if (item._type === 'task') {
    return (
      <div className="event-item-row" onClick={() => onToggleTask(item)}>
        <div className={`task-check ${item.done ? 'done' : ''}`}>
          {item.done && <span style={{ color:'#fff', fontSize:11 }}>✓</span>}
        </div>
        <div style={{ flex:1 }}>
          <div className={`event-title-text ${item.done ? 'done-text' : ''}`}>{item.title}</div>
          <div className="event-sub-text">{new Date(item.due_datetime).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <span className="event-badge task-badge">משימה</span>
      </div>
    )
  }
  // meeting / lead
  return (
    <div className="event-item-row">
      <div className="event-bar-meeting"/>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--text,#1a1a1a)', minWidth:42 }}>
        {new Date(item.visit_datetime).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}
      </div>
      <div style={{ flex:1 }}>
        <div className="event-title-text">{item.project_address}</div>
        {item.client_name && <div className="event-sub-text">{item.client_name}</div>}
      </div>
      <span className="event-badge meeting-badge">פגישה</span>
    </div>
  )
}

export default function CalendarView({ agentId }) {
  const [view, setView] = useState('week')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()))
  const [monthDate, setMonthDate] = useState(new Date())
  const [leads, setLeads] = useState([])
  const [tasks, setTasks] = useState([])
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    const { data: leadData } = await supabase.from('leads').select('*').eq('agent_id', agentId).not('visit_datetime', 'is', null)
    const { data: meetData } = await supabase.from('meetings').select('*').eq('agent_id', agentId)
    const taskData = await getTasks()
    const standalones = (meetData||[]).map(m => ({ id:m.id, project_address:m.title, client_name:'', visit_datetime:m.visit_datetime }))
    setLeads([...(leadData||[]), ...standalones])
    setTasks(taskData)
  }
  useEffect(() => { load() }, [])

  // Combine all events for selected date
  const eventsForDay = (date) => {
    const dayMeetings = leads.filter(l => sameDay(new Date(l.visit_datetime), date)).map(l => ({ ...l, _type:'meeting', _time: new Date(l.visit_datetime) }))
    const dayTasks = tasks.filter(t => sameDay(new Date(t.due_datetime), date)).map(t => ({ ...t, _type:'task', _time: new Date(t.due_datetime) }))
    return [...dayMeetings, ...dayTasks].sort((a,b) => a._time - b._time)
  }

  const hasEvents = (date) => eventsForDay(date).length > 0

  const weekDays = Array.from({length:7}, (_,i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate()+i)
    return d
  })

  const todayEvents = eventsForDay(selectedDate)
  const isToday = sameDay(selectedDate, new Date())

  // Month grid
  const monthGrid = () => {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const startDow = firstDay.getDay()
    const daysInMonth = new Date(year, month+1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const cells = []
    for (let i = startDow-1; i >= 0; i--) cells.push({ day: prevMonthDays-i, other:true, date: new Date(year, month-1, prevMonthDays-i) })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day:d, other:false, date: new Date(year, month, d) })
    while (cells.length % 7 !== 0) {
      const nextDay = cells.length - (startDow + daysInMonth) + 1
      cells.push({ day: nextDay, other:true, date: new Date(year, month+1, nextDay) })
    }
    return cells
  }

  const toggleTaskDone = async (task) => {
    await toggleTask(task.id, !task.done)
    load()
  }

  return (
    <div className="body" dir="rtl">
      {showAdd && <AddTaskModal defaultDate={selectedDate} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}

      {/* View toggle */}
      <div style={{ display:'flex', background:'rgba(0,0,0,.03)', borderRadius:10, padding:3, margin:'10px 12px' }}>
        <button onClick={() => setView('week')}
          style={{ flex:1, padding:'7px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, cursor:'pointer',
            background: view==='week' ? '#1D9E75' : 'none', color: view==='week' ? '#fff' : '#8E8E93' }}>
          שבועי
        </button>
        <button onClick={() => setView('month')}
          style={{ flex:1, padding:'7px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, cursor:'pointer',
            background: view==='month' ? '#1D9E75' : 'none', color: view==='month' ? '#fff' : '#8E8E93' }}>
          חודשי
        </button>
      </div>

      {view === 'week' && (
        <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 12px 10px', background:'var(--card,#fff)' }}>
          {weekDays.map((d,i) => {
            const selected = sameDay(d, selectedDate)
            const today = sameDay(d, new Date())
            return (
              <div key={i} onClick={() => setSelectedDate(d)} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, cursor:'pointer', flex:1 }}>
                <div style={{ fontSize:10, color:'#8E8E93' }}>{HE_DAYS[d.getDay()]}</div>
                <div style={{
                  width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, fontWeight:500, color: today ? '#fff' : 'var(--text,#1a1a1a)',
                  background: today ? '#1D9E75' : 'transparent',
                  border: selected && !today ? '1.5px solid #1D9E75' : 'none',
                }}>{d.getDate()}</div>
                <div style={{ width:4, height:4, borderRadius:'50%', background: hasEvents(d) ? '#1D9E75' : 'transparent' }}/>
              </div>
            )
          })}
        </div>
      )}

      {view === 'month' && (
        <div style={{ background:'var(--card,#fff)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 12px' }}>
            <button onClick={() => setMonthDate(d => { const n = new Date(d); n.setMonth(n.getMonth()-1); return n })}
              style={{ background:'none', border:'none', fontSize:18, color:'#1D9E75', cursor:'pointer' }}>‹</button>
            <div style={{ fontSize:14, fontWeight:600 }}>{HE_MONTHS[monthDate.getMonth()]} {monthDate.getFullYear()}</div>
            <button onClick={() => setMonthDate(d => { const n = new Date(d); n.setMonth(n.getMonth()+1); return n })}
              style={{ background:'none', border:'none', fontSize:18, color:'#1D9E75', cursor:'pointer' }}>›</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'8px 12px 0' }}>
            {HE_DAYS.map(d => <div key={d} style={{ fontSize:9, color:'#8E8E93', fontWeight:600, textAlign:'center' }}>{d}</div>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, padding:'6px 12px 12px' }}>
            {monthGrid().map((cell, i) => {
              const today = sameDay(cell.date, new Date())
              const selected = sameDay(cell.date, selectedDate)
              return (
                <div key={i} onClick={() => setSelectedDate(cell.date)} style={{
                  aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, borderRadius:8, cursor:'pointer', position:'relative',
                  color: cell.other ? '#D0D0D0' : today ? '#fff' : 'var(--text,#1a1a1a)',
                  background: today ? '#1D9E75' : selected ? '#E8F5EF' : 'transparent',
                  fontWeight: today ? 700 : 400,
                }}>
                  {cell.day}
                  {hasEvents(cell.date) && !cell.other && (
                    <div style={{ width:4, height:4, borderRadius:'50%', position:'absolute', bottom:2, background: today ? '#fff' : '#1D9E75' }}/>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Events for selected day */}
      <div className="sec-hdr">
        {isToday ? 'היום' : selectedDate.toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' })}
      </div>

      {todayEvents.length === 0 && (
        <div className="empty"><div className="empty-sub">אין אירועים ביום זה</div></div>
      )}

      {todayEvents.map(item => (
        <EventRow key={item._type+item.id} item={item} onToggleTask={toggleTaskDone} />
      ))}

      <button className="add-btn" onClick={() => setShowAdd(true)}>
        <i className="ti ti-plus" style={{ fontSize:16 }} aria-hidden="true"/>
        הוסף משימה / תזכורת
      </button>
    </div>
  )
}
