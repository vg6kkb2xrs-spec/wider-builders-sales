import { useState } from 'react'
import { createCalendarEvent, updateLeadCalendar, updateLeadStage } from '../lib/supabase'

export default function ScheduleVisitModal({ lead, onClose, onSaved }) {
  const [datetime, setDatetime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSchedule = async () => {
    if (!datetime) return setError('בחר תאריך ושעה')
    setSaving(true)
    try {
      const event = await createCalendarEvent(lead, datetime)
      await updateLeadCalendar(lead.id, event.id, datetime)
      await updateLeadStage(lead.id, 'visit_scheduled')
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-header">
          <h2>קבע ביקור</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="visit-address">
          📍 {lead.project_address}
        </div>
        <div className="visit-client">{lead.client_name}</div>

        <div className="form-group" style={{marginTop:20}}>
          <label>תאריך ושעת הביקור</label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={e => setDatetime(e.target.value)}
          />
        </div>

        <div className="gcal-note">
          האירוע יתווסף לגוגל קלנדר שלך עם כל פרטי הפרויקט
        </div>

        {error && <div className="form-error">{error}</div>}

        <button className="btn-primary" onClick={handleSchedule} disabled={saving}>
          {saving ? 'מוסיף ליומן...' : '📅 קבע ביקור'}
        </button>
      </div>
    </div>
  )
}
