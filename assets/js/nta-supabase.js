window.NTA_CONFIG = Object.freeze({
  supabaseUrl: "https://wwnwelahpiyshhueitlj.supabase.co",
  publishableKey: "sb_publishable_zO_MwLNLhks3hSlcMw8C0A_5c-9jXfM",
  functionUrl: "https://wwnwelahpiyshhueitlj.supabase.co/functions/v1/nta-public-intake",
  carrierBucket: "NTA_logistics",
  storageFunctionUrl: "https://wwnwelahpiyshhueitlj.supabase.co/functions/v1/nta-storage",
  carrierSecureFunctionUrl: "https://wwnwelahpiyshhueitlj.supabase.co/functions/v1/nta-carrier-secure",
  notifyFunctionUrl: "https://wwnwelahpiyshhueitlj.supabase.co/functions/v1/nta-form-notify"
});

window.NTASupabase = window.supabase?.createClient
  ? window.supabase.createClient(window.NTA_CONFIG.supabaseUrl, window.NTA_CONFIG.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    })
  : null;
