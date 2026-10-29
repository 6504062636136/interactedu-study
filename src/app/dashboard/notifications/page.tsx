/**
 * หน้าที่ของไฟล์: แสดงรายการแจ้งเตือนของผู้ใช้ในแดชบอร์ด
 * เส้นทาง: /dashboard/notifications
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import type { ReactElement } from "react";
import Link from "next/link";
import NotificationList from "@/components/notifications/NotificationList";
import AppBrand from "@/components/AppBrand";
import { createClient } from "@/utils/supabase/server";

/** เลือกเส้นทางหน้าแรกของแดชบอร์ดจาก role ของผู้ใช้ */
function dashboardHome(role: string | null | undefined): string {
  if (role === "admin") return "/dashboard/admin";
  if (role === "teacher") return "/dashboard/teacher";
  if (role === "student") return "/dashboard/student";
  return "/";
}

/** อ่านบทบาทเพื่อเลือกปุ่มกลับ แล้วแสดงคอมโพเนนต์รายการแจ้งเตือน */
export default async function NotificationsPage(): Promise<ReactElement> {
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = await createClient();
  // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // profile: ผลอ่านข้อมูลโปรไฟล์ผู้ใช้
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  // homeHref: เส้นทางกลับหน้าแดชบอร์ดที่เลือกตามบทบาทผู้ใช้
  const homeHref = dashboardHome(profile?.role);

  return (
    <div className="app-canvas min-h-screen">
      <header className="app-topbar sticky top-0 z-40"><div className="mx-auto flex h-[74px] max-w-5xl items-center px-5 sm:px-7"><AppBrand compact /></div></header>
      <main className="px-5 py-7 sm:px-7 lg:py-10">
        <div className="mx-auto max-w-4xl">
          <Link
            href={homeHref}
            className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#3157D5] shadow-sm transition-colors hover:bg-blue-50"
          >
            <span aria-hidden="true">←</span>
            กลับหน้าหลัก
          </Link>
          <div className="app-surface p-5 sm:p-7 lg:p-9"><NotificationList /></div>
        </div>
      </main>
    </div>
  );
}

