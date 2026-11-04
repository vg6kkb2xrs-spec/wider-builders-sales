import { useState } from 'react'
import { jtOrg, jtOpenJobs } from '../lib/jobtread'

/*
 * Projects pulled live from JobTread (manager-only, lives in the Manager
 * dashboard). Phase 1 = read-only list of open jobs. Query shapes verified
 * against the live org. Needs JOBTREAD_GRANT_KEY set in Vercel to light up;
 * until then it shows a friendly "not connected" message.
 */
export default function JobTreadConnect() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [org, setOrg] = useState(null)
  const [jobs, setJobs] = useState(null)
  const [count, setCount] = useState(0)

  const load = async () => {
    setLoading(true); setErr('')
    try {
      const o = await jtOrg()
      setOrg(o)
      if (!o) { setErr('לא נמצא ארגון'); return }
      const r = await jtOpenJobs(o.id)
      const j = r?.organization?.jobs
      setJobs(j?.nodes || [])
      setCount(j?.count || 0)
    } catch (e) {
      setErr(e.message || 'שגיאה')
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && jobs === null && !loading) load()
  }

  return (
    <>
      <div className="sec-hdr" onClick={toggle}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>פרויקטים · JobTread{count ? ` · ${count}` : ''}</span>
        <span style={{ color: 'var(--accent-deep)', fontWeight: 700 }}>{open ? 'הסתר' : 'הצג ›'}</span>
      </div>

      {open && (
        <>
          {loading && <div className="task-empty">טוען מ-JobTread…</div>}

          {err && (
            <div className="mgr-card">
              <div style={{ fontSize: 13, color: 'var(--alert-deep)', fontWeight: 600, marginBottom: 6 }}>
                לא ניתן למשוך פרויקטים
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink2)' }}>{err}</div>
              {/connected|configured|grant/i.test(err) && (
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 8 }}>
                  צריך להוסיף את <span className="mono">JOBTREAD_GRANT_KEY</span> במשתני הסביבה ב-Vercel.
                </div>
              )}
              <button className="mb" style={{ marginTop: 10 }} onClick={load}>נסה שוב</button>
            </div>
          )}

          {!loading && !err && org && (
            <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '0 12px 8px', direction: 'ltr', textAlign: 'right' }}>
              {org.name}
            </div>
          )}

          {!loading && !err && jobs && jobs.length === 0 && (
            <div className="task-empty">אין פרויקטים פתוחים</div>
          )}

          {!loading && !err && jobs && jobs.map(j => (
            <div key={j.id} className="lead-card" style={{ cursor: 'default' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="l-addr">{j.name}</div>
                {j.location?.address && (
                  <div className="l-client" style={{ direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' }}>
                    {j.location.address}
                  </div>
                )}
              </div>
              <span className="s-pill" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)' }}>
                #{j.number}
              </span>
            </div>
          ))}
        </>
      )}
    </>
  )
}
