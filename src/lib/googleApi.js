// Google OAuth + Drive/Sheets integration for receipts
import { supabase } from './supabase'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets'

const TOKEN_KEY = 'google_access_token'
const TOKEN_EXPIRY_KEY = 'google_token_expiry'

let tokenClient = null

function loadGis() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const check = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(check)
        resolve()
      }
    }, 200)
  })
}

export function getStoredToken() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY)
  if (token && expiry && Date.now() < Number(expiry)) return token
  return null
}

export async function requestGoogleAccess() {
  await loadGis()
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) return reject(resp)
        sessionStorage.setItem(TOKEN_KEY, resp.access_token)
        sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + (resp.expires_in - 60) * 1000))
        resolve(resp.access_token)
      },
    })
    tokenClient.requestAccessToken()
  })
}

export async function ensureGoogleToken() {
  const existing = getStoredToken()
  if (existing) return existing
  return requestGoogleAccess()
}

// ===== DRIVE =====
const RECEIPTS_FOLDER_NAME = 'Wider Builders Receipts'
let cachedFolderId = null

async function getOrCreateFolder(token) {
  if (cachedFolderId) return cachedFolderId
  const q = encodeURIComponent(`name='${RECEIPTS_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (data.files?.length > 0) {
    cachedFolderId = data.files[0].id
    return cachedFolderId
  }
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: RECEIPTS_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  const created = await createRes.json()
  cachedFolderId = created.id
  return cachedFolderId
}

export async function uploadFileToDrive(file) {
  const token = await ensureGoogleToken()
  const folderId = await getOrCreateFolder(token)

  const metadata = { name: `${Date.now()}_${file.name}`, parents: [folderId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const data = await res.json()

  // Make file viewable by anyone with link
  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  return data.webViewLink
}

// ===== SHEETS =====
// Sheet ID is now shared across all users via Supabase (app_settings table)
// instead of localStorage, which was per-browser and not shared between agents.
let cachedSheetId = undefined // undefined = not loaded yet, null = loaded but empty

export async function getSavedSheetId() {
  if (cachedSheetId !== undefined) return cachedSheetId
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'sheets_id')
    .maybeSingle()
  cachedSheetId = data?.value || null
  return cachedSheetId
}

export async function saveSheetId(id) {
  await supabase
    .from('app_settings')
    .upsert({ key: 'sheets_id', value: id }, { onConflict: 'key' })
  cachedSheetId = id
}

export async function appendToSheet(sheetId, row, sheetName) {
  const token = await ensureGoogleToken()
  const range = sheetName ? `'${sheetName}'!A:H` : 'A:H'
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] }),
    }
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error?.message || 'שגיאה בכתיבה לגיליון')
  }
  return res.json()
}

