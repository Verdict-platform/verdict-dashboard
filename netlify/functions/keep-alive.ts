import { createClient } from '@supabase/supabase-js'

export const handler = async () => {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: 'missing env vars' }) }
  }

  const supabase = createClient(url, key)

  // Lightweight count query — just enough to register activity with Supabase
  const { error } = await supabase
    .from('verdict_profiles')
    .select('id', { count: 'exact', head: true })

  return {
    statusCode: error ? 500 : 200,
    body: JSON.stringify({
      ok: !error,
      ts: new Date().toISOString(),
      ...(error && { error: error.message }),
    }),
  }
}
