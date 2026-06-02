import { useState } from 'react'
import { addLead } from '../lib/supabase'

export default function AddLeadModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    project_address: '',
    client_name: '',
    phone: '',
    description: '',
    estimated_value: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.project_address.trim()) return setError('כתובת הפרויקט חובה')
    if (!form.client_name.trim())     return setError('שם הלקוח חובה')
    setSaving(true)
    try {
      await addLead({
        ...form,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      })
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
          <h2>ליד חדש</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="form-group">
          <label>כתובת הפרויקט *</label>
          <input
            placeholder="123 Ocean Ave, Brooklyn"
            value={form.project_address}
            onChange={e => set('project_address', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>שם הלקוח *</label>
          <input
            placeholder="John Smith"
            value={form.client_name}
            onChange={e => set('client_name', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>טלפון</label>
          <input
            placeholder="+1 718 555 0100"
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>סכום משוער ($)</label>
          <input
            placeholder="25000"
            type="number"
            value={form.estimated_value}
            onChange={e => set('estimated_value', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>תיאור קצר</label>
          <textarea
            placeholder="kitchen renovation, full gut..."
            rows={3}
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        {error && <div className="form-error">{error}</div>}

        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'שומר...' : 'הוסף ליד'}
        </button>
      </div>
    </div>
  )
}
