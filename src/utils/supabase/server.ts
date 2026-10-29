import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createFetchWithTimeout } from "@/utils/supabase/fetch-with-timeout";

// Helper ของเราใน Server: await cookies() ของ Next.js แล้วคืน Supabase client จาก @supabase/ssr ที่ใช้ session ของ request
export async function createClient({ timeoutMs = 10000 }: { timeoutMs?: number } = {}) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: createFetchWithTimeout(timeoutMs),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // เรียกจาก Server Component ล้วนๆ (ไม่มี response ให้เซ็ต cookie)
            // ปล่อยผ่านได้ ถ้ามี middleware คอย refresh session อยู่แล้ว
          }
        },
      },
    }
  );
}
