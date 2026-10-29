/**
 * หน้าที่ของไฟล์: แสดงโปรไฟล์แอดมินและฟอร์มแก้ไขข้อมูลส่วนตัว
 * เส้นทาง: /dashboard/admin/profile
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import Link from "next/link";
import { Mail, UserRound } from "lucide-react";
import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import AdminUserProfileForm from "@/components/admin/AdminUserProfileForm";
import { createClient } from "@/utils/supabase/server";

/** ตรวจบทบาทแอดมิน โหลดข้อมูลโปรไฟล์ และส่งค่าให้ฟอร์มข้อมูลส่วนตัว */
export default async function AdminProfilePage(): Promise<ReactElement> {
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = await createClient();
  // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/admin/profile");

  // profile: ผลอ่านข้อมูลโปรไฟล์ผู้ใช้
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, phone, university, faculty")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/dashboard");

  // fullName: ชื่อเต็มที่นำมาแสดงหรือใช้เป็นค่าเริ่มต้นของฟอร์มโปรไฟล์
  const fullName = profile.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/admin" className="mb-4 inline-flex text-[13px] font-semibold text-slate-500 hover:text-[#3157D5]">
        ← กลับไปภาพรวมระบบ
      </Link>
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3157D5]">Admin account</p>
        <h1 className="mt-1 text-[30px] font-extrabold tracking-[-0.035em] text-[#0F1B3D]">โปรไฟล์ของฉัน</h1>
        <p className="mt-1 text-[14px] text-slate-600">ดูและแก้ไขข้อมูลส่วนตัวของบัญชีผู้ดูแลระบบ</p>
      </div>

      <section className="mb-5 rounded-[24px] bg-[linear-gradient(115deg,#0F1B3D,#1B326B)] p-6 text-white shadow-[0_16px_36px_rgba(15,27,61,0.12)] sm:p-7" aria-label="ข้อมูลบัญชี">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
            <UserRound size={26} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FFB299]">ผู้ดูแลระบบ</p>
            <p className="mt-1 truncate text-[20px] font-extrabold">{fullName || "ยังไม่ระบุชื่อ"}</p>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-[13px] text-white/75">
          <Mail size={16} aria-hidden="true" />
          <span className="break-all">{user.email ?? "ไม่พบอีเมล"}</span>
        </div>
      </section>

      <AdminUserProfileForm
        userId={user.id}
        initialFullName={fullName}
        initialPhone={profile.phone}
        initialUniversity={profile.university}
        initialFaculty={profile.faculty}
        selfProfile
      />
      <p className="text-[12px] text-slate-500">อีเมลเป็นบัญชีสำหรับเข้าสู่ระบบ และไม่สามารถแก้ไขจากหน้านี้ได้</p>
    </div>
  );
}
