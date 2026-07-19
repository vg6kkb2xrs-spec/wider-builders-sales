import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getReceipts, addReceipt, updateReceipt, deleteReceipt } from '../lib/supabase'
import { uploadFileToDrive, appendToSheet, updateSheetRow, getSavedSheetId, saveSheetId, ensureGoogleToken } from '../lib/googleApi'

const fmt = (n) => `$${Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2})}`

const TRANSACTION_TYPES = ['Client Deposit','New Bill','Bill Payment','Material Expense','Labor Expense','Vendor Refund','General Expense']
const PAYMENT_METHODS = ['Check','Zelle','Company Debit Card 4699','Material Account 2961','Tzvi personal','Israel Amex','ATM','Cash','Paid by contractor','Paid by Client','Not paid']

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function SheetSetupModal({ onClose, onSaved }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const extractId = (input) => {
    const match = input.match(/\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : input.trim()
  }

  const save = async () => {
    const id = extractId(url)
    if (!id) return setError('הדבק קישור תקין לגיליון')
    setSaving(true)
    try {
      await saveSheetId(id)
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
        <div className="modal-head">
          <h2>חבר גיליון Google Sheets</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="field">
          <label>קישור לגיליון הקיים</label>
          <input placeholder="https://docs.google.com/spreadsheets/d/..." value={url} onChange={e => setUrl(e.target.value)} autoFocus />
        </div>
        {error && <div className="field-error">{error}</div>}
        <button className="submit-btn" onClick={save} disabled={saving}>{saving ? 'מחבר...' : 'חבר גיליון'}</button>
      </div>
    </div>
  )
}

function ReviewModal({ scanned, fileUrl, leads, sheetId, onClose, onSaved }) {
  const [form, setForm] = useState({
    project_name: scanned.project_guess || '',
    transaction_type: scanned.transaction_type || 'General Expense',
    amount: scanned.amount || '',
    billable: false,
    payment_method: scanned.payment_method || '',
    memo: scanned.memo || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) return setError('הכנס סכום')
    if (!form.transaction_type) return setError('בחר סוג עסקה')
    setSaving(true)
    try {
      const now = new Date()
      const timestamp = now.toLocaleDateString('en-US', { year:'numeric', month:'2-digit', day:'2-digit' }) + ' ' + now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true })
      const receipt = await addReceipt({
        project_name: form.project_name || null,
        transaction_type: form.transaction_type,
        amount: Number(form.amount),
        billable: form.billable,
        payment_method: form.payment_method || null,
        memo: form.memo || null,
        file_url: fileUrl,
      })

      if (sheetId) {
        try {
          const sheetResult = await appendToSheet(sheetId, [
            timestamp,
            form.project_name || '',
            form.transaction_type,
            form.amount,
            form.billable ? 'Billable' : '',
            form.payment_method || '',
            form.memo || '',
            fileUrl || '',
          ])
          if (sheetResult?.rowNumber) {
            await updateReceipt(receipt.id, { sheet_row: sheetResult.rowNumber, sheet_tab: sheetResult.tabName })
          }
        } catch (sheetErr) {
          console.error('Sheet sync failed:', sheetErr)
        }
      }

      onSaved(receipt)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-head">
          <h2>אשר פרטי קבלה</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ background:'var(--accent-soft)', border:'1px solid var(--accent)', borderRadius:12, padding:'8px 12px', marginBottom:14, fontSize:12, color:'var(--accent-deep)', fontWeight:600 }}>
          ✓ זוהה אוטומטית — בדוק ותקן במידת הצורך
        </div>

        <div className="field">
          <label>פרויקט</label>
          <select className="address-select" value={form.project_name} onChange={e => setForm(f => ({...f, project_name: e.target.value}))}>
            <option value="">— ללא פרויקט ספציפי —</option>
            {leads.map(l => (
              <option key={l.id} value={l.project_address}>{l.project_address}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>סוג עסקה</label>
          <select value={form.transaction_type} onChange={e => setForm(f => ({...f, transaction_type: e.target.value}))}>
            {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="field">
          <label>סכום ($)</label>
          <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <input type="checkbox" id="billable" checked={form.billable} onChange={e => setForm(f => ({...f, billable: e.target.checked}))} style={{ width:18, height:18 }} />
          <label htmlFor="billable" style={{ fontSize:13, color:'var(--ink)' }}>Billable (ניתן לחיוב הלקוח)</label>
        </div>

        <div className="field">
          <label>אופן תשלום</label>
          <select value={form.payment_method} onChange={e => setForm(f => ({...f, payment_method: e.target.value}))}>
            <option value="">— לא ידוע —</option>
            {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="field">
          <label>הערה</label>
          <input value={form.memo} onChange={e => setForm(f => ({...f, memo: e.target.value}))} />
        </div>

        {error && <div className="field-error">{error}</div>}
        <button className="submit-btn" onClick={save} disabled={saving}>{saving ? 'שומר...' : '✓ אשר ושמור'}</button>
      </div>
    </div>
  )
}

function EditReceiptModal({ receipt, leads, sheetId, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({
    project_name: receipt.project_name || '',
    transaction_type: receipt.transaction_type || 'General Expense',
    amount: receipt.amount || '',
    billable: receipt.billable || false,
    payment_method: receipt.payment_method || '',
    memo: receipt.memo || '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) return setError('הכנס סכום')
    if (!form.transaction_type) return setError('בחר סוג עסקה')
    setSaving(true)
    try {
      await updateReceipt(receipt.id, {
        project_name: form.project_name || null,
        transaction_type: form.transaction_type,
        amount: Number(form.amount),
        billable: form.billable,
        payment_method: form.payment_method || null,
        memo: form.memo || null,
      })

      if (sheetId && receipt.sheet_row) {
        try {
          await updateSheetRow(sheetId, receipt.sheet_row, [
            receipt.created_at ? new Date(receipt.created_at).toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'}) + ' ' + new Date(receipt.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}) : '',
            form.project_name || '',
            form.transaction_type,
            form.amount,
            form.billable ? 'Billable' : '',
            form.payment_method || '',
            form.memo || '',
            receipt.file_url || '',
          ], receipt.sheet_tab)
        } catch (sheetErr) {
          console.error('Sheet row update failed:', sheetErr)
        }
      }

      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!confirm('למחוק את הקבלה? פעולה זו אינה הפיכה.')) return
    setDeleting(true)
    try {
      await deleteReceipt(receipt.id)
      onDeleted()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="modal-head">
          <h2>ערוך קבלה</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {receipt.file_url && (
          <a href={receipt.file_url} target="_blank" rel="noopener noreferrer"
            style={{ display:'block', fontSize:13, color:'var(--ink2)', marginBottom:14, textDecoration:'underline' }}>
            📄 צפה בקובץ המקורי
          </a>
        )}

        <div className="field">
          <label>פרויקט</label>
          <select className="address-select" value={form.project_name} onChange={e => setForm(f => ({...f, project_name: e.target.value}))}>
            <option value="">— ללא פרויקט ספציפי —</option>
            {leads.map(l => (
              <option key={l.id} value={l.project_address}>{l.project_address}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>סוג עסקה</label>
          <select value={form.transaction_type} onChange={e => setForm(f => ({...f, transaction_type: e.target.value}))}>
            {TRANSACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="field">
          <label>סכום ($)</label>
          <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} />
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <input type="checkbox" id="edit_billable" checked={form.billable} onChange={e => setForm(f => ({...f, billable: e.target.checked}))} style={{ width:18, height:18 }} />
          <label htmlFor="edit_billable" style={{ fontSize:13, color:'var(--ink)' }}>Billable (ניתן לחיוב הלקוח)</label>
        </div>

        <div className="field">
          <label>אופן תשלום</label>
          <select value={form.payment_method} onChange={e => setForm(f => ({...f, payment_method: e.target.value}))}>
            <option value="">— לא ידוע —</option>
            {PAYMENT_METHODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div className="field">
          <label>הערה</label>
          <input value={form.memo} onChange={e => setForm(f => ({...f, memo: e.target.value}))} />
        </div>

        {error && <div className="field-error">{error}</div>}
        <button className="submit-btn" onClick={save} disabled={saving}>{saving ? 'שומר...' : 'שמור שינויים'}</button>
        <button onClick={remove} disabled={deleting}
          style={{ width:'100%', marginTop:8, padding:12, background:'#FFF5F5', color:'var(--alert-deep)', border:'1px solid transparent', borderRadius:12, fontSize:14, fontWeight:600, cursor:'pointer' }}>
          {deleting ? 'מוחק...' : 'מחק קבלה'}
        </button>

        {sheetId && receipt.sheet_row && (
          <div style={{ fontSize:11, color:'var(--accent-deep)', marginTop:10, textAlign:'center' }}>
            ✓ שינויים כאן יתעדכנו גם בגיליון Google Sheets
          </div>
        )}
        {sheetId && !receipt.sheet_row && (
          <div style={{ fontSize:11, color:'var(--ink3)', marginTop:10, textAlign:'center' }}>
            קבלה זו נוצרה לפני חיבור הגיליון — שינויים כאן לא יתעדכנו בו
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReceiptsView({ isManager, autoTriggerUpload }) {
  const [receipts, setReceipts] = useState([])
  const [leads, setLeads] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [reviewData, setReviewData] = useState(null)
  const [showSheetSetup, setShowSheetSetup] = useState(false)
  const [sheetId, setSheetId] = useState(null)
  const [editingReceipt, setEditingReceipt] = useState(null)
  const fileInputRef = useRef(null)

  const load = async () => {
    const [r, l, sid] = await Promise.all([
      getReceipts(),
      supabase.from('leads').select('id, project_address').order('updated_at', { ascending: false }),
      getSavedSheetId(),
    ])
    setReceipts(r)
    setLeads(l.data || [])
    setSheetId(sid)
  }
  useEffect(() => { load() }, [])

  // Note: we deliberately do NOT auto-click the file input here.
  // Programmatically triggering file pickers / OAuth popups outside of a
  // direct, synchronous user tap is blocked by mobile browsers (especially
  // iOS Safari), which previously caused the upload flow to hang silently.
  // Instead, autoTriggerUpload just highlights the upload zone so the user
  // can tap it themselves - one extra tap, but it actually works.

  const handleUploadTap = async () => {
    // Request Google authorization directly on tap, as close to the user
    // gesture as possible, so mobile browsers don't block the OAuth popup.
    setScanError('')
    try {
      await ensureGoogleToken()
      fileInputRef.current?.click()
    } catch (err) {
      setScanError(err.message || 'לא ניתן להתחבר ל-Google. אפשר חלונות קופצים (popups) ונסה שוב.')
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 6 * 1024 * 1024) {
      setScanError('הקובץ גדול מדי (מקסימום 6MB). נסה תמונה קטנה יותר או PDF דחוס.')
      return
    }

    setScanError('')
    setScanning(true)
    let fileUrl = null
    try {
      const base64 = await fileToBase64(file)
      const mediaType = file.type || 'image/jpeg'

      const [scanRes, driveResult] = await Promise.all([
        fetch('/api/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType, projectAddresses: leads.map(l => l.project_address) }),
        }).then(async r => {
          const text = await r.text()
          try {
            return JSON.parse(text)
          } catch {
            console.error('Non-JSON response from scan-receipt:', text.slice(0, 200))
            throw new Error('שרת הסריקה לא זמין כרגע. נסה שוב בעוד רגע.')
          }
        }),
        uploadFileToDrive(file).catch(err => {
          console.error('Drive upload failed', err)
          setScanError('הקובץ נסרק בהצלחה, אך ההעלאה ל-Google Drive נכשלה. הקבלה תישמר ללא קישור לקובץ.')
          return null
        }),
      ])

      fileUrl = driveResult

      if (scanRes.error) throw new Error(scanRes.error)

      setReviewData({ scanned: scanRes, fileUrl })
    } catch (err) {
      setScanError(err.message || 'שגיאה בסריקת הקבלה')
    } finally {
      setScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const totalExpenses = receipts.filter(r => r.transaction_type !== 'Client Deposit' && r.transaction_type !== 'Vendor Refund').reduce((s,r) => s + Number(r.amount), 0)
  const totalIncome = receipts.filter(r => r.transaction_type === 'Client Deposit' || r.transaction_type === 'Vendor Refund').reduce((s,r) => s + Number(r.amount), 0)

  return (
    <div className="body" dir="rtl">
      {reviewData && (
        <ReviewModal
          scanned={reviewData.scanned}
          fileUrl={reviewData.fileUrl}
          leads={leads}
          sheetId={sheetId}
          onClose={() => setReviewData(null)}
          onSaved={() => { setReviewData(null); load() }}
        />
      )}
      {showSheetSetup && (
        <SheetSetupModal onClose={() => setShowSheetSetup(false)} onSaved={() => { setShowSheetSetup(false); load() }} />
      )}
      {editingReceipt && (
        <EditReceiptModal
          receipt={editingReceipt}
          leads={leads}
          sheetId={sheetId}
          onClose={() => setEditingReceipt(null)}
          onSaved={() => { setEditingReceipt(null); load() }}
          onDeleted={() => { setEditingReceipt(null); load() }}
        />
      )}

      <div style={{ margin:'10px 12px', background:'var(--accent-deep)', borderRadius:16, padding:'16px', color:'#fff' }}>
        <div style={{ fontSize:11, opacity:.75 }}>קבלות וחשבוניות</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10 }}>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:10, padding:'8px 10px' }}>
            <div style={{ fontSize:10, opacity:.75 }}>סה"כ הוצאות</div>
            <div style={{ fontSize:16, fontWeight:700, marginTop:1 }}>{fmt(totalExpenses)}</div>
          </div>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:10, padding:'8px 10px' }}>
            <div style={{ fontSize:10, opacity:.75 }}>סה"כ הכנסות</div>
            <div style={{ fontSize:16, fontWeight:700, marginTop:1 }}>{fmt(totalIncome)}</div>
          </div>
        </div>
      </div>

      <div style={{ margin:'0 12px 10px' }}>
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{ display:'none' }} id="receipt-upload" />
        <div onClick={scanning ? undefined : handleUploadTap}
          style={{
            display:'block', borderRadius:14, padding:20, textAlign:'center', cursor: scanning ? 'default' : 'pointer',
            border: autoTriggerUpload ? '2px solid var(--accent-deep)' : '1.5px dashed var(--line)',
            background: autoTriggerUpload ? 'var(--accent-soft)' : 'var(--line2)',
            boxShadow: autoTriggerUpload ? '0 0 0 3px rgba(29,158,117,.15)' : 'none',
            transition: 'all .2s',
          }}>
          {scanning ? (
            <>
              <div style={{ fontSize:28, marginBottom:6 }}>⏳</div>
              <div style={{ fontSize:12, color:'var(--ink2)', fontWeight:600 }}>קורא את הקבלה...</div>
            </>
          ) : (
            <>
              <div style={{ fontSize:28, marginBottom:6 }}>📄</div>
              <div style={{ fontSize:12, color:'var(--ink2)', fontWeight:600 }}>
                {autoTriggerUpload ? '👆 לחץ כאן להעלות תמונה או PDF' : 'העלה תמונה או PDF של קבלה'}
              </div>
            </>
          )}
        </div>
        {scanError && <div className="field-error" style={{ marginTop:8 }}>{scanError}</div>}
      </div>

      <div style={{ margin:'0 12px 10px', textAlign:'center' }}>
        <button onClick={() => setShowSheetSetup(true)}
          style={{ fontSize:12, color:'var(--ink2)', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
          {sheetId ? '✓ מחובר לגיליון Google Sheets — שנה' : 'חבר גיליון Google Sheets'}
        </button>
      </div>

      <div className="sec-hdr">קבלות אחרונות</div>
      {receipts.length === 0 && <div className="empty"><div className="empty-sub">עדיין לא הועלו קבלות</div></div>}
      {receipts.map(r => (
        <div key={r.id} onClick={() => setEditingReceipt(r)}
          style={{ background:'#fff', margin:'0 12px 6px', borderRadius:14, padding:'11px 13px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
          <div style={{ width:3, borderRadius:2, alignSelf:'stretch', background: (r.transaction_type==='Client Deposit'||r.transaction_type==='Vendor Refund') ? 'var(--accent-deep)' : 'var(--alert-deep)' }}/>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--ink)' }}>{r.memo || r.transaction_type}</div>
            <div style={{ fontSize:11, color:'var(--ink2)', marginTop:1, unicodeBidi:'plaintext' }}>
              {r.transaction_type}{r.project_name && ` · ${r.project_name}`}{r.billable && ' · Billable'}
            </div>
          </div>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:13, fontWeight:700, color: (r.transaction_type==='Client Deposit'||r.transaction_type==='Vendor Refund') ? 'var(--accent-deep)' : 'var(--alert-deep)' }}>
              {fmt(r.amount)}
            </div>
            {r.file_url && (
              <a href={r.file_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:10, color:'var(--ink2)' }} onClick={e => e.stopPropagation()}>
                צפה בקובץ
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}







