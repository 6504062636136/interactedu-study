/**
 * หน้าที่ของไฟล์: ตรวจบทบาทแอดมินและจัดกรอบเมนูร่วมพร้อมจำนวนคอร์สที่รอตรวจ
 * เส้นทาง: /dashboard/admin (ครอบหน้าลูกในเส้นทางนี้)
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import type { ReactElement, ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AdminShell from "@/components/admin/AdminShell";

/** ตรวจเซสชันและ role ก่อนครอบ children ด้วย AdminShell และส่งข้อมูลผู้ใช้กับจำนวนงานรอตรวจ */
export default async function AdminLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = await createClient();
  // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/admin");
  }

  // profileRes, pendingRes: ผลของงานอ่านข้อมูลที่เริ่มพร้อมกัน โดยเรียงตามคำขอใน Promise.all
  const [profileRes, pendingRes] = await Promise.all([
    supabase.from("profiles").select("role, full_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  if (profileRes.data?.role !== "admin") redirect("/dashboard");

  // displayName: ชื่อที่ใช้แสดง โดยเลือกจากโปรไฟล์หรือข้อมูลบัญชีและมีชื่อสำรองเมื่อไม่มีข้อมูล
  const displayName =
    profileRes.data.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Admin";

  return (
    <AdminShell displayName={displayName} avatarUrl={profileRes.data.avatar_url} pendingCourses={pendingRes.count ?? 0}>
      {children}
    </AdminShell>
  );
}
