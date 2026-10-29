/**
 * หน้าที่ของไฟล์: เลย์เอาต์ร่วมของแดชบอร์ดที่ตรวจว่าผู้ใช้เข้าสู่ระบบแล้ว
 * เส้นทาง: /dashboard (ครอบหน้าลูกในเส้นทางนี้)
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import type { ReactElement, ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

/** ตรวจเซสชันก่อนแสดง children และส่งผู้ใช้ที่ยังไม่เข้าสู่ระบบไปหน้า login */
export default async function DashboardLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = await createClient();
  // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard");
  }

  // ไม่ render header/sidebar ใดๆ ที่นี่ — ให้แต่ละ role layout (student/teacher/admin) จัดการเอง
  return <>{children}</>;
}