import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ScheduleVisitModal({ lead, onClose, onSaved }) {
  const [datetime, setDatetime] = useState(lead.visit_datetime ? new Date(lead.visit_datetime).toISOString().slice(0,16) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSchedule = async () => {
    if (!datetime) return setError('בחר תאריך ושעה')
    setSaving(true)
    try {
      await supabase.from('leads').update({
        visit_datetime: new Date(datetime).toISOString(),
        last_contact_at: new Date().toISOString(),
      }).eq('id', lead.id)
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
          <h2>{lead.visit_datetime ? 'עדכן פגישה' : 'קבע פגישה'}</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="visit-address">📍 {lead.project_address}</div>
        <div className="visit-client">{lead.client_name}</div>

        <div className="form-group" style={{ marginTop: 20 }}>
          <label>תאריך ושעה</label>
          <input
            type="datetime-local"
            value={datetime}
            onChange={e => setDatetime(e.target.value)}
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button className="btn-primary" onClick={handleSchedule} disabled={saving}>
          {saving ? 'שומר...' : '📅 שמור פגישה'}
        </button>
      </div>
    </div>
  )
}
