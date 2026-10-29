import { createBrowserClient } from '@supabase/ssr'

// Helper ของเรา: const ผูกชื่อฟังก์ชันลูกศรไว้คงที่; createBrowserClient เป็น Library ที่ดูแล Auth/session ฝั่ง Browser
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )