import { useState } from 'react'
import { createCalendarEvent, updateLeadCalendar, updateLeadStage } from '../lib/supabase'
import { supabase } from '../lib/supabase'

const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

async function requestCalendarAccess() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: GCAL_SCOPE,
      redirectTo: window.location.href,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    }
  })
  if (error) throw error
}

async function hasCalendarToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return !!(session?.provider_token)
}

export default function ScheduleVisitModal({ lead, onClose, onSaved }) {
  const [datetime, setDatetime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [needsAuth, setNeedsAuth] = useState(false)

  const handleSchedule = async () => {
    if (!datetime) return setError('בחר תאריך ושעה')
    setSaving(true)
    setError('')

    try {
      // בדוק אם יש token לקלנדר
      const hasToken = await hasCalendarToken()
      if (!hasToken) {
        setNeedsAuth(true)
        setSaving(false)
        return
      }

      const event = await createCalendarEvent(lead, datetime)
      await updateLeadCalendar(lead.id, event.id, datetime)
      onSaved()
    } catch (e) {
      // אם השגיאה היא על token — בקש אישור
      if (e.message?.includes('token') || e.message?.includes('401') || e.message?.includes('אין Google')) {
        setNeedsAuth(true)
      } else {
        setError(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  // מסך בקשת אישור קלנדר
  if (needsAuth) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
          <div className="modal-header">
            <h2>נדרש אישור</h2>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>

          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
              כדי להוסיף פגישות ליומן גוגל
            </div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.5 }}>
              צריך לאשר גישה ליומן שלך. לחץ על הכפתור ובמסך גוגל אשר את הגישה.
            </div>
            <button
              className="btn-primary"
              onClick={requestCalendarAccess}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
              </svg>
              אשר גישה לגוגל קלנדר
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
