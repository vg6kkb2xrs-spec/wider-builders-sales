import { useState } from 'react'
import { addLead } from '../lib/supabase'
import AddressInput from './AddressInput'

export default function AddLeadModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ project_address: '', client_name: '', phone: '', description: '', estimated_value: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.project_address.trim()) return setError('כתובת הפרויקט חובה')
    if (!form.client_name.trim()) return setError('שם הלקוח חובה')
    setSaving(true)
    try {
      await addLead({ ...form, estimated_value: form.estimated_value ? Number(form.estimated_value) : null })
      onSaved()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-head">
          <h2>שיחה נכנסת חדשה</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="field">
          <label>כתובת הפרויקט *</label>
          <AddressInput
            value={form.project_address}
            onChange={v => set('project_address', v)}
            placeholder="123 Ocean Ave, Brooklyn"
          />
        </div>

        <div className="field">
          <label>שם הלקוח *</label>
          <input placeholder="John Smith" value={form.client_name} onChange={e => set('client_name', e.target.value)} />
        </div>

        <div className="field">
          <label>טלפון</label>
          <input placeholder="+1 718 555 0100" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>

        <div className="field">
          <label>סכום משוער ($)</label>
          <input placeholder="25,000" type="number" value={form.estimated_value} onChange={e => set('estimated_value', e.target.value)} />
        </div>

        <div className="field">
          <label>תיאור קצר</label>
          <textarea rows={2} placeholder="שיפוץ מטבח, תוספת בנייה..." value={form.description} onChange={e => set('description', e.target.value)} />
        </div>

        {error && <div className="field-error">{error}</div>}
        <button className="submit-btn" onClick={handleSave} disabled={saving}>{saving ? 'שומר...' : 'הוסף ליד'}</button>
      </div>
    </div>
  )
}
