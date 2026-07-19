import { useState } from 'react'
import Icon from './Icon'

/* One task row: round checkbox + title (+ optional date / linked-lead meta).
   Shared by the home strip, the calendar tasks view, and the lead detail. */
export function TaskItem({ task, onToggle, showLead = true }) {
  const due = task.due_datetime ? new Date(task.due_datetime) : null
  const hasMeta = due || (showLead && task.leads)
  return (
    <div className="task-row">
      <button
        className={`task-check ${task.done ? 'done' : ''}`}
        onClick={() => onToggle(task)}
        aria-label={task.done ? 'בטל סימון' : 'סמן כבוצע'}
      >
        {task.done && <Icon name="check" size={12} style={{ stroke: '#fff', strokeWidth: 2.6 }} />}
      </button>
      <div className="task-main">
        <div className={`task-title ${task.done ? 'done' : ''}`}>{task.title}</div>
        {hasMeta && (
          <div className="task-meta">
            {due && (
              <span className="mono">
                {due.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {due && showLead && task.leads && <span> · </span>}
            {showLead && task.leads && <span className="ltr">{task.leads.project_address}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

/* Quick-add: title (+ optional date). Enter or the + button submits.
   allowDate=false => plain to-do (used on the home strip). */
export function QuickAddTask({ onAdd, allowDate = false, placeholder = 'הוסף משימה…' }) {
  const [title, setTitle] = useState('')
  const [showDate, setShowDate] = useState(false)
  const [datetime, setDatetime] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onAdd({
        title: title.trim(),
        due_datetime: (allowDate && datetime) ? new Date(datetime).toISOString() : null,
      })
      setTitle(''); setDatetime(''); setShowDate(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="quick-add">
      <div className="quick-add-row">
        <input
          value={title}
          placeholder={placeholder}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />
        {allowDate && (
          <button className={`qa-date ${showDate || datetime ? 'on' : ''}`} onClick={() => setShowDate(s => !s)} aria-label="הוסף תאריך">
            <Icon name="calendar" size={18} />
          </button>
        )}
        <button className="qa-submit" onClick={submit} disabled={saving || !title.trim()} aria-label="הוסף משימה">
          <Icon name="plus" size={18} style={{ stroke: '#fff' }} />
        </button>
      </div>
      {allowDate && showDate && (
        <input
          type="datetime-local"
          className="qa-datetime"
          value={datetime}
          onChange={e => setDatetime(e.target.value)}
        />
      )}
    </div>
  )
}
