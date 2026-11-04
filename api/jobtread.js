/*
 * JobTread bridge — server-side proxy to the JobTread "Pave" API.
 *
 * Why a proxy: the JobTread grant key is a SECRET and must never reach the
 * browser. The frontend sends a Pave `query` here; this function injects the
 * grant key server-side and forwards it to https://api.jobtread.com/pave.
 *
 * Phase 1 is READ-ONLY on purpose: JobTread already two-way-syncs with
 * QuickBooks, so Wider must not become a third writer and create conflicts.
 * Any mutation-looking top-level query key is rejected until we deliberately
 * open specific, owned write flows.
 *
 * Env vars (set in Vercel → Project → Settings → Environment Variables):
 *   JOBTREAD_GRANT_KEY  — created in JobTread: Settings → Integrations →
 *                         JobTread API → Grants (shown once).
 *   SUPABASE_URL / SUPABASE_ANON_KEY (or the VITE_ equivalents) — used to
 *                         verify the caller is a signed-in Wider user.
 */

const PAVE_URL = 'https://api.jobtread.com/pave'
const WRITE_KEY = /^(create|update|delete|remove|send|archive|restore|duplicate|move|merge)/i

async function verifySupabaseUser(token) {
  if (!token) return null
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', {
      headers: { apikey: anon, Authorization: 'Bearer ' + token },
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const grantKey = process.env.JOBTREAD_GRANT_KEY
  const query = req.body && req.body.query
  if (!query || typeof query !== 'object') {
    return res.status(400).json({ error: 'Missing query' })
  }

  // The {version:{}} query needs no key and no auth — a safe health check.
  const topKeys = Object.keys(query).filter(k => k !== '$')
  const isHealthCheck = topKeys.length === 1 && topKeys[0] === 'version'

  if (!isHealthCheck) {
    // 1) Must be a signed-in Wider user.
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const user = await verifySupabaseUser(token)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    // 2) Must be configured.
    if (!grantKey) {
      return res.status(503).json({ error: 'JobTread not connected yet (missing JOBTREAD_GRANT_KEY)' })
    }

    // 3) Read-only in Phase 1.
    const writes = topKeys.filter(k => WRITE_KEY.test(k))
    if (writes.length) {
      return res.status(403).json({ error: 'Read-only bridge (Phase 1). Blocked: ' + writes.join(', ') })
    }
  }

  // Inject the grant key server-side; never let the client set it.
  const payload = { query: { ...query, $: { notify: false, ...(query.$ || {}) } } }
  if (!isHealthCheck) payload.query.$.grantKey = grantKey
  else delete payload.query.$.grantKey

  try {
    const r = await fetch(PAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const text = await r.text()
    res.status(r.status)
    res.setHeader('Content-Type', 'application/json')
    return res.send(text)
  } catch (e) {
    return res.status(502).json({ error: 'JobTread request failed: ' + (e && e.message) })
  }
}
