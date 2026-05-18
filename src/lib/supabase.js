import { createClient } from '@supabase/supabase-js'

// ── Replace these with your own Supabase project credentials ──
const SUPABASE_URL = 'https://yayovhfettjrxryluvbz.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_pgKRjgTXeL7GGqeWFj1BfQ_c4Vjs_gn'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Helper: write to audit_logs ──
export async function auditLog(action, details) {
  try {
    await supabase.from('audit_logs').insert({
      admin_id: (await supabase.auth.getUser()).data?.user?.id || null,
      action,
      details,
      ip_address: 'client',
    })
  } catch (e) {
    console.warn('Audit log failed:', e)
  }
}
