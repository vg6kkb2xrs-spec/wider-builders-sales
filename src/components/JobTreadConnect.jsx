import { useState } from 'react'
import { jtVersion, jtCurrentGrant, jtOpenJobs } from '../lib/jobtread'

/*
 * Phase-1 diagnostic for the JobTread bridge (manager-only).
 * Proves the pipe end-to-end and prints RAW responses, so we can read the
 * real Pave schema from the live org and then build the project UI against
 * confirmed field names (instead of guessing).
 */
export default function JobTreadConnect() {
  const [status, setStatus] = useState('')
  const [orgId, setOrgId] = useState('')
  const [raw, setRaw] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const run = async (label, fn) => {
    setBusy(true); setStatus(label + '…'); setRaw('')
    try {
      const res = await fn()
      setRaw(JSON.stringify(res, null, 2))
      setStatus('✓ ' + label)
      return res
    } catch (e) {
      setStatus('✗ ' + (e.message || 'שגיאה'))
      return null
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="sec-hdr" onClick={() => setOpen(true)} style={{ cursor: 'pointer', color: 'var(--ink3)' }}>
        חיבור JobTread · בטא ›
      </div>
    )
  }

  return (
    <div className="mgr-card" style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--ink3)' }}>
          חיבור JobTread · בטא
        </div>
        <span onClick={() => setOpen(false)} style={{ cursor: 'pointer', color: 'var(--ink3)', fontSize: 12 }}>הסתר</span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="mb" style={{ flex: 'none', padding: '10px 14px' }} onClick={() => run('בדיקת חיבור', jtVersion)} disabled={busy}>בדוק חיבור</button>
        <button className="mb" style={{ flex: 'none', padding: '10px 14px' }} disabled={busy}
          onClick={async () => { const r = await run('זיהוי ארגון', jtCurrentGrant); const id = r?.currentGrant?.organization?.id; if (id) setOrgId(id) }}>
          זהה ארגון
        </button>
        <button className="mb" style={{ flex: 'none', padding: '10px 14px' }} disabled={busy}
          onClick={() => orgId ? run('משיכת פרויקטים', () => jtOpenJobs(orgId)) : setStatus('קודם זהה ארגון')}>
          משוך פרויקטים
        </button>
      </div>

      {orgId && <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 8 }}>Org ID: <span className="mono" style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}>{orgId}</span></div>}
      {status && (
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8,
          color: status.startsWith('✓') ? 'var(--accent-deep)' : status.startsWith('✗') ? 'var(--alert-deep)' : 'var(--ink2)' }}>
          {status}
        </div>
      )}
      {raw && (
        <pre style={{ direction: 'ltr', textAlign: 'left', fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.5,
          background: 'var(--input)', padding: 12, borderRadius: 10, overflow: 'auto', maxHeight: 280, color: 'var(--ink)' }}>
          {raw}
        </pre>
      )}
    </div>
  )
}
