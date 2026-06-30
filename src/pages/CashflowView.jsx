import { useEffect, useState } from 'react'
import { getBankBalance, setBankBalance, getCashflowEntries, addCashflowEntry, deleteCashflowEntry, updateCashflowEntry } from '../lib/supabase'

const fmtK = (n) => {
  const v = Number(n||0)
  const sign = v < 0 ? '-' : ''
  const abs = Math.abs(v)
  return sign + (abs>=1000000?`$${(abs/1000000).toFixed(1)}M`:abs>=1000?`$${Math.round(abs/1000)}K`:`$${Math.round(abs)}`)
}
const fmt = (n) => `$${Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0})}`

function sameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}

// Expand a recurring entry into occurrences within [from, to]
function expandRecurring(entry, from, to) {
  if (!entry.is_recurring) {
    const d = new Date(entry.entry_date)
    return (d >= from && d <= to) ? [{ ...entry, _date: d }] : []
  }
  const occurrences = []
  let d = new Date(entry.entry_date)
  const step = entry.recurrence_frequency === 'weekly' ? 7 : entry.recurrence_frequency === 'yearly' ? 365 : 30
  // fast-forward to range
  while (d < from) {
    if (entry.recurrence_frequency === 'monthly') d.setMonth(d.getMonth()+1)
    else d.setDate(d.getDate() + step)
  }
  while (d <= to) {
    occurrences.push({ ...entry, _date: new Date(d) })
    if (entry.recurrence_frequency === 'monthly') d.setMonth(d.getMonth()+1)
    else d.setDate(d.getDate() + step)
  }
  return occurrences
}

function EditBalanceModal({ current, onClose, onSaved }) {
  const [amount, setAmount] = useState(current || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (amount === '') return
    setSaving(true)
    await setBankBalance(Number(amount))
    setSaving(false)
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-head">
          <h2>עדכן יתרת בנק</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="field">
          <label>יתרה נוכחית בבנק ($)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
        </div>
        <button className="submit-btn" onClick={save} disabled={saving}>{saving ? 'שומר...' : 'עדכן'}</button>
      </div>
    </div>
  )
}

function AddEntryModal({ existing, onClose, onSaved, onDelete }) {
  const [type, setType] = useState(existing?.type || 'expense')
  const [category, setCategory] = useState(existing?.category || 'one_time')
  const [description, setDescription] = useState(existing?.description || '')
  const [amount, setAmount] = useState(existing?.amount ?? '')
  const [date, setDate] = useState(existing?.entry_date || new Date().toISOString().slice(0,10))
  const [recurring, setRecurring] = useState(existing?.is_recurring || false)
  const [frequency, setFrequency] = useState(existing?.recurrence_frequency || 'monthly')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!description.trim()) return setError('כתוב תיאור')
    if (!amount || Number(amount) <= 0) return setError('הכנס סכום')
    setSaving(true)
    try {
      const payload = {
        type, category, description: description.trim(),
        amount: Number(amount), entry_date: date,
        is_recurring: category === 'fixed' && recurring,
        recurrence_frequency: (category === 'fixed' && recurring) ? frequency : null,
      }
      if (existing) await updateCashflowEntry(existing.id, payload)
      else await addCashflowEntry(payload)
      onSaved()
    } catch(e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const remove = async () => {
    if (!confirm('למחוק את הרשומה?')) return
    setDeleting(true)
    try {
      await deleteCashflowEntry(existing.id)
      onDelete()
    } catch(e) { setError(e.message) }
    finally { setDeleting(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-head">
          <h2>{existing ? 'ערוך תזרים' : 'הוסף תזרים'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          <button onClick={() => setType('income')}
            style={{ flex:1, padding:10, borderRadius:12, border: type==='income' ? '1.5px solid #1D9E75' : '1.5px solid #E5E5EA',
              background: type==='income' ? '#E8F5EF' : '#fff', color: type==='income' ? '#1D9E75' : '#8E8E93',
              fontSize:13, fontWeight:600, cursor:'pointer' }}>
            הכנסה
          </button>
          <button onClick={() => setType('expense')}
            style={{ flex:1, padding:10, borderRadius:12, border: type==='expense' ? '1.5px solid #E24B4A' : '1.5px solid #E5E5EA',
              background: type==='expense' ? '#FFF5F5' : '#fff', color: type==='expense' ? '#E24B4A' : '#8E8E93',
              fontSize:13, fontWeight:600, cursor:'pointer' }}>
            הוצאה
          </button>
        </div>

        <div className="field">
          <label>תיאור</label>
          <input placeholder="שכר עובדים, חומרי בניין..." value={description} onChange={e => setDescription(e.target.value)} autoFocus />
        </div>

        <div className="field">
          <label>סכום ($)</label>
          <input type="number" placeholder="5,000" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>

        <div className="field">
          <label>תאריך</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label>סוג</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="one_time">חד פעמי</option>
            <option value="fixed">קבוע</option>
          </select>
        </div>

        {category === 'fixed' && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
              <input type="checkbox" id="recur" checked={recurring} onChange={e => setRecurring(e.target.checked)} style={{ width:18, height:18 }} />
              <label htmlFor="recur" style={{ fontSize:13, color:'#1a1a1a' }}>חוזר אוטומטית</label>
            </div>
            {recurring && (
              <div className="field">
                <label>תדירות</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)}>
                  <option value="weekly">שבועי</option>
                  <option value="monthly">חודשי</option>
                  <option value="yearly">שנתי</option>
                </select>
              </div>
            )}
          </>
        )}

        {error && <div className="field-error">{error}</div>}
        <button className="submit-btn" onClick={save} disabled={saving}>{saving ? 'שומר...' : existing ? 'שמור שינויים' : 'הוסף'}</button>
        {existing && (
          <button onClick={remove} disabled={deleting}
            style={{ width:'100%', marginTop:8, padding:12, background:'#FFF5F5', color:'#E24B4A', border:'1px solid #F7C1C1', borderRadius:12, fontSize:14, fontWeight:600, cursor:'pointer' }}>
            {deleting ? 'מוחק...' : 'מחק רשומה'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function CashflowView({ isManager }) {
  const [balance, setBalance] = useState(null)
  const [entries, setEntries] = useState([])
  const [view, setView] = useState('week')
  const [showEditBalance, setShowEditBalance] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)

  const load = async () => {
    const [b, e] = await Promise.all([getBankBalance(), getCashflowEntries()])
    setBalance(b)
    setEntries(e)
  }
  useEffect(() => { load() }, [])

  const currentBalance = Number(balance?.amount || 0)

  // Compute the two independent projection windows
  const today = new Date()
  today.setHours(0,0,0,0)
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)
  const monthEnd = new Date(today)
  monthEnd.setDate(monthEnd.getDate() + 30)

  const sumDelta = (occs) => occs.reduce((s,o) => s + (o.type==='income' ? Number(o.amount) : -Number(o.amount)), 0)

  const weekProjection = currentBalance + sumDelta(entries.flatMap(e => expandRecurring(e, today, weekEnd)))
  const monthProjection = currentBalance + sumDelta(entries.flatMap(e => expandRecurring(e, today, monthEnd)))

  // List range depends on the selected tab (week/month toggle)
  const rangeEnd = view === 'week' ? weekEnd : monthEnd

  const occurrences = entries.flatMap(e => expandRecurring(e, today, rangeEnd))
    .sort((a,b) => a._date - b._date)

  let running = currentBalance
  const occurrencesWithBalance = occurrences.map(o => {
    running += o.type === 'income' ? Number(o.amount) : -Number(o.amount)
    return { ...o, _runningBalance: running }
  })

  // Group by day
  const grouped = {}
  occurrencesWithBalance.forEach(o => {
    const key = sameDay(o._date, today) ? 'today' : o._date.toLocaleDateString('he-IL', { weekday:'long', day:'numeric', month:'long' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(o)
  })

  return (
    <div className="body" dir="rtl">
      {showEditBalance && (
        <EditBalanceModal current={currentBalance} onClose={() => setShowEditBalance(false)} onSaved={() => { setShowEditBalance(false); load() }} />
      )}
      {(showAdd || editingEntry) && (
        <AddEntryModal
          existing={editingEntry}
          onClose={() => { setShowAdd(false); setEditingEntry(null) }}
          onSaved={() => { setShowAdd(false); setEditingEntry(null); load() }}
          onDelete={() => { setEditingEntry(null); load() }}
        />
      )}

      {/* Balance card */}
      <div style={{ margin:'10px 12px', background:'#185FA5', borderRadius:16, padding:'16px 16px 14px', color:'#fff' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:11, opacity:.75 }}>יתרת בנק נוכחית</div>
            <div style={{ fontSize:32, fontWeight:700, letterSpacing:-1, marginTop:2 }}>{fmt(currentBalance)}</div>
            {balance?.updated_at && (
              <div style={{ fontSize:10, opacity:.6, marginTop:2 }}>
                עודכן {new Date(balance.updated_at).toLocaleDateString('he-IL',{day:'numeric',month:'short'})}
              </div>
            )}
          </div>
          {isManager && (
            <button onClick={() => setShowEditBalance(true)}
              style={{ background:'rgba(255,255,255,.18)', border:'none', borderRadius:'50%', width:32, height:32, color:'#fff', fontSize:14, cursor:'pointer' }}>
              ✎
            </button>
          )}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:10, padding:'8px 10px' }}>
            <div style={{ fontSize:10, opacity:.75 }}>צפי לסוף השבוע</div>
            <div style={{ fontSize:15, fontWeight:700, marginTop:1, color: weekProjection < 0 ? '#FFB3B3' : '#fff' }}>
              {fmt(weekProjection)}
            </div>
          </div>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:10, padding:'8px 10px' }}>
            <div style={{ fontSize:10, opacity:.75 }}>צפי לסוף החודש</div>
            <div style={{ fontSize:15, fontWeight:700, marginTop:1, color: monthProjection < 0 ? '#FFB3B3' : '#fff' }}>
              {fmt(monthProjection)}
            </div>
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display:'flex', background:'rgba(0,0,0,.03)', borderRadius:10, padding:3, margin:'0 12px 8px' }}>
        <button onClick={() => setView('week')}
          style={{ flex:1, padding:'7px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, cursor:'pointer',
            background: view==='week' ? '#185FA5' : 'none', color: view==='week' ? '#fff' : '#8E8E93' }}>
          שבועי
        </button>
        <button onClick={() => setView('month')}
          style={{ flex:1, padding:'7px', fontSize:12, fontWeight:600, border:'none', borderRadius:8, cursor:'pointer',
            background: view==='month' ? '#185FA5' : 'none', color: view==='month' ? '#fff' : '#8E8E93' }}>
          חודשי
        </button>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="empty"><div className="empty-sub">אין תנועות בטווח הזה</div></div>
      )}

      {Object.entries(grouped).map(([key, items]) => (
        <div key={key}>
          <div className="sec-hdr">{key === 'today' ? 'היום' : key}</div>
          {items.map((item, i) => (
            <div key={item.id+i} onClick={() => isManager && setEditingEntry(item)}
              style={{ background:'#fff', margin:'0 12px 6px', borderRadius:14, padding:'11px 13px', display:'flex', alignItems:'center', gap:10, cursor: isManager ? 'pointer' : 'default' }}>
              <div style={{ width:3, borderRadius:2, alignSelf:'stretch', background: item.type==='income' ? '#1D9E75' : '#E24B4A' }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{item.description}</div>
                <div style={{ fontSize:11, color:'#8E8E93', marginTop:1 }}>
                  {item.category === 'fixed' ? 'קבוע' : 'חד פעמי'}
                  {item.is_recurring && ` · חוזר ${item.recurrence_frequency==='weekly'?'שבועי':item.recurrence_frequency==='yearly'?'שנתי':'חודשי'}`}
                </div>
              </div>
              <div style={{ textAlign:'left' }}>
                <div style={{ fontSize:13, fontWeight:700, color: item.type==='income' ? '#1D9E75' : '#E24B4A' }}>
                  {item.type==='income' ? '+' : '-'}{fmt(item.amount)}
                </div>
                <div style={{ fontSize:10, color:'#B0B0B0', marginTop:1 }}>{fmtK(item._runningBalance)}</div>
              </div>
            </div>
          ))}
        </div>
      ))}

      {isManager && (
        <button className="add-btn" style={{ background:'#185FA5' }} onClick={() => setShowAdd(true)}>
          <i className="ti ti-plus" style={{ fontSize:16 }} aria-hidden="true"/>
          הוסף תזרים
        </button>
      )}
    </div>
  )
}


