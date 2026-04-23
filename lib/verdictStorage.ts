/**
 * verdictStorage — shared storage utility for the Verdict network.
 *
 * Copy this file identically into each calculator site's lib/ folder.
 * All sites use the same Supabase project (same URL + anon key via env vars).
 * The anonymous UUID is the only identity — no auth required.
 *
 * Env vars required in every site:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { VerdictEntry, VerdictProfile, VerdictSiteId } from './types'

const UID_KEY = 'verdict_uid'

// Lazily initialised — safe to import in SSR contexts
let _client: SupabaseClient | null = null
function getClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return _client
}

// ─── UUID management ──────────────────────────────────────────────────────────

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
}

/**
 * Returns the user's UUID, resolving in priority order:
 *   1. ?uid= URL param  (cross-site handoff — absorb and clean from URL)
 *   2. localStorage
 *   3. Generate fresh UUID and create a profile row in Supabase
 *
 * Call once on calculator mount, passing the current site id.
 */
export function getOrCreateUid(siteId: VerdictSiteId): string {
  if (typeof window === 'undefined') return ''

  // 1. Incoming cross-site handoff
  const params = new URLSearchParams(window.location.search)
  const incoming = params.get('uid')
  if (incoming && isValidUuid(incoming)) {
    localStorage.setItem(UID_KEY, incoming)
    params.delete('uid')
    const clean = params.toString()
      ? `${window.location.pathname}?${params}`
      : window.location.pathname
    window.history.replaceState(null, '', clean)
    return incoming
  }

  // 2. Already stored locally
  const stored = localStorage.getItem(UID_KEY)
  if (stored && isValidUuid(stored)) return stored

  // 3. First visit — generate and persist (profile created on first saveEntry)
  const uid = crypto.randomUUID()
  localStorage.setItem(UID_KEY, uid)
  return uid
}

export function getStoredUid(): string | null {
  if (typeof window === 'undefined') return null
  const v = localStorage.getItem(UID_KEY)
  return v && isValidUuid(v) ? v : null
}

/**
 * Appends ?uid=<uuid> to any URL so the receiving site can adopt the same
 * identity. Use on all cross-site navigation links.
 *
 * Example:
 *   <a href={withUid('https://dashboard.compverdict.com')}>My Dashboard</a>
 */
export function withUid(url: string): string {
  const uid = getStoredUid()
  if (!uid) return url
  return `${url}${url.includes('?') ? '&' : '?'}uid=${uid}`
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/**
 * Persist a calculator result. Call after the user clicks "Track this".
 * Upserts the profile first to avoid FK race condition on first save.
 */
export async function saveEntry(
  uid: string,
  type: VerdictSiteId,
  city: string,
  annualSalary: number,
  currency: string,
  input: unknown,
  output: unknown,
): Promise<{ id: string } | null> {
  // Ensure profile row exists before inserting entry (FK constraint)
  await getClient()
    .from('verdict_profiles')
    .upsert({ id: uid, first_site: type }, { onConflict: 'id', ignoreDuplicates: true })

  const { data, error } = await getClient()
    .from('verdict_entries')
    .insert({
      profile_id: uid,
      type,
      city,
      annual_salary: annualSalary,
      currency,
      input,
      output,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[verdictStorage] saveEntry failed:', error.message)
    return null
  }
  return data
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getAllEntries(uid: string): Promise<VerdictEntry[]> {
  const { data } = await getClient()
    .from('verdict_entries')
    .select('*')
    .eq('profile_id', uid)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function getEntriesByType(
  uid: string,
  type: VerdictSiteId,
): Promise<VerdictEntry[]> {
  const { data } = await getClient()
    .from('verdict_entries')
    .select('*')
    .eq('profile_id', uid)
    .eq('type', type)
    .order('created_at', { ascending: false })

  return data ?? []
}

/** Latest entry per type — used by the dashboard snapshot section */
export async function getLatestPerType(
  uid: string,
): Promise<Partial<Record<VerdictSiteId, VerdictEntry>>> {
  const entries = await getAllEntries(uid)
  const latest: Partial<Record<VerdictSiteId, VerdictEntry>> = {}
  for (const e of entries) {
    if (!latest[e.type]) latest[e.type] = e
  }
  return latest
}
