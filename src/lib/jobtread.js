/*
 * Frontend client for the JobTread bridge.
 * Sends Pave queries to our own /api/jobtread proxy (which holds the secret
 * grant key server-side). Never talks to JobTread directly.
 *
 * Query shapes below are verified against the live Wider Group LTD org.
 */
import { supabase } from './supabase'

export async function pave(query) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ''
  const r = await fetch('/api/jobtread', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ query }),
  })
  const text = await r.text()
  let json
  try { json = JSON.parse(text) } catch { throw new Error('תשובה לא תקינה מהשרת: ' + text.slice(0, 200)) }
  if (!r.ok) throw new Error(json.error || json.message || ('HTTP ' + r.status))
  return json
}

// Health check — needs no grant key. Confirms the proxy + JobTread reachability.
export function jtVersion() {
  return pave({ version: {} })
}

// currentGrant → the signed-in JobTread user and the org(s) they belong to.
// (org lives under user.memberships.nodes[].organization — verified.)
export function jtCurrentGrant() {
  return pave({
    currentGrant: {
      id: {},
      user: {
        id: {}, name: {},
        memberships: { nodes: { id: {}, organization: { id: {}, name: {} } } },
      },
    },
  })
}

// Convenience: resolve the primary organization { id, name }.
export async function jtOrg() {
  const r = await jtCurrentGrant()
  const node = r?.currentGrant?.user?.memberships?.nodes?.[0]
  return node?.organization || null
}

// Open jobs (projects) for an org. where ["closedOn","=",null] = not closed.
export function jtOpenJobs(organizationId, size = 50) {
  return pave({
    organization: {
      $: { id: organizationId },
      id: {},
      name: {},
      jobs: {
        $: { size, where: ['closedOn', '=', null] },
        count: {},
        nodes: {
          id: {},
          name: {},
          number: {},
          createdAt: {},
          closedOn: {},
          location: { id: {}, address: {} },
        },
      },
    },
  })
}
