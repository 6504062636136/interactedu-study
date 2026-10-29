import "server-only";

import { createClient } from "@supabase/supabase-js";

// Helper ของเราใน Server คืน Supabase SDK client ที่มีสิทธิ์ระบบ; server-only กัน import ไป Browser
// caller ต้องตรวจ Auth/role/เจ้าของก่อนใช้ เพราะ client นี้มีสิทธิ์ข้าม RLS และไม่ได้ยืนยันสิทธิ์ผู้ใช้ให้เอง
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverSecretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serverSecretKey) {
    throw new Error(
      "Supabase server configuration is missing: set SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY)"
    );
  }

  return createClient(url, serverSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
