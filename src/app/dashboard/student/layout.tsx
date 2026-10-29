/**
 * หน้าที่ของไฟล์: จัดกรอบ เมนู และข้อมูลผู้ใช้ร่วมสำหรับแดชบอร์ดผู้เรียน
 * เส้นทาง: /dashboard/student (ครอบหน้าลูกในเส้นทางนี้)
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import type { ReactElement, ReactNode } from "react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar from "@/components/DashboardSidebar";
import { createClient } from "@/utils/supabase/server";
import { getActivePlusExpiry } from "@/lib/payments/active-plus";

/** โหลดชื่อ รูป และวันหมดอายุ Plus แล้วครอบ children ด้วยกรอบแดชบอร์ดผู้เรียน */
export default async function StudentLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = await createClient();
  // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // profile: ผลอ่านข้อมูลโปรไฟล์ผู้ใช้
  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };
  // displayName: ชื่อที่ใช้แสดง โดยเลือกจากโปรไฟล์หรือข้อมูลบัญชีและมีชื่อสำรองเมื่อไม่มีข้อมูล
  const displayName =
    profile?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "ผู้ใช้";
  // plusExpiresAt: วันหมดอายุ Plus ที่มีผลใช้งานของผู้ใช้ หรือ null เมื่อไม่มีสมาชิกที่ใช้งานอยู่
  const plusExpiresAt = user ? await getActivePlusExpiry(supabase, user.id) : null;

  return (
    <DashboardShell displayName={displayName} avatarUrl={profile?.avatar_url} role="student" plusExpiresAt={plusExpiresAt} sidebar={<DashboardSidebar />}>
      {children}
    </DashboardShell>
  );
}
