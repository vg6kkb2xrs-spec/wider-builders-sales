import { useState, useEffect } from 'react'
import { updateLeadCalendar } from '../lib/supabase'
import { supabase } from '../lib/supabase'

const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export default function ScheduleVisitModal({ lead, onClose, onSaved }) {
  const [datetime, setDatetime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [hasToken, setHasToken] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasToken(!!(session?.provider_token))
    })
  }, [])

  const requestAccess = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: GCAL_SCOPE,
        redirectTo: window.location.href,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      }
    })
  }

  const handleSchedule = async () => {
    if (!datetime) return setError('בחר תאריך ושעה')
    setSaving(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.provider_token

      if (!token) {
        setSaving(false)
        setHasToken(false)
        return
      }

      const start = new Date(datetime)
      const end = new Date(start.getTime() + 60 * 60 * 1000)

      const event = {
        summary: lead.project_address,
        description: [
          `לקוח: ${lead.client_name}`,
          `טלפון: ${lead.phone || '—'}`,
          `תיאור: ${lead.description || '—'}`,
          `סכום משוער: $${(lead.estimated_value || 0).toLocaleString()}`,
        ].join('\n'),
        location: lead.project_address,
        start: { dateTime: start.toISOString(), timeZone: 'America/New_York' },
        end: { dateTime: end.toISOString(), timeZone: 'America/New_York' },
      }

      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      })

      if (res.status === 401 || res.status === 403) {
        setSaving(false)
        setHasToken(false)
        return
      }

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message || 'שגיאה ביצירת אירוע')
      }

      const created = await res.json()
      await updateLeadCalendar(lead.id, created.id, datetime)
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // מסך בקשת אישור
  if (hasToken === false) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
          <div className="modal-header">
            <h2>נדרש אישור יומן</h2>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>
              כדי להוסיף פגישות לגוגל קלנדר
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
              תועבר למסך גוגל — אשר את הגישה ליומן ותחזור אוטומטית לאפליקציה.
            </div>
            <button className="btn-primary" onClick={requestAccess}>
              אשר גישה לגוגל קלנדר →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-header">
          <h2>קבע ביקור</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="visit-address">📍 {lead.project_address}</div>
        <div className="visit-client">{lead.client_name}</div>

        <div className="form-group" style={{ marginTop: 20 }}>
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
