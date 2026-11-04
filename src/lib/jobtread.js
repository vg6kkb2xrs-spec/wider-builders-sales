/*
 * Frontend client for the JobTread bridge.
 * Sends Pave queries to our own /api/jobtread proxy (which holds the secret
 * grant key server-side). Never talks to JobTread directly.
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
  if (!r.ok) throw new Error(json.error || ('HTTP ' + r.status))
  return json
}

// --- Phase 1 discovery helpers (minimal, schema-safe) ---

// Health check: needs no grant key. Confirms the proxy + JobTread reachability.
export function jtVersion() {
  return pave({ version: {} })
}

// Identifies the connected JobTread organization. `id` is required on any object.
export function jtCurrentGrant() {
  return pave({
    currentGrant: {
      id: {},
      user: { id: {}, name: {} },
      organization: { id: {}, name: {} },
    },
  })
}

// Lists open jobs for an organization (closedOn = null = open).
export function jtOpenJobs(organizationId, size = 25) {
  return pave({
    organization: {
      $: { id: organizationId },
      id: {},
      jobs: {
        $: { size, where: [['closedOn', '=', null]] },
        nodes: {
          id: {},
          name: {},
          number: {},
          createdAt: {},
        },
      },
    },
  })
}
