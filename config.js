/* Sambungan ke database Supabase. Isi dua nilai ini (lihat README-setup.md).
   Kunci "anon" memang boleh terlihat publik. Yang melindungi data adalah aturan di supabase.sql.
   JANGAN pernah menempel kunci "service_role" di sini. */
window.MA_CONFIG = {
  SUPABASE_URL: "https://yorzbzsufyazezgwowhc.supabase.co",       // contoh: "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "sb_publishable_VrnXG6Xvpx7eZV_B5ieXlg_9z81zVq5"   // kunci "anon public" dari Project Settings > API
};