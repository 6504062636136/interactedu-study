/**
 * หน้าที่ของไฟล์: รายชื่อผู้ใช้สำหรับแอดมิน พร้อมค้นหาและกรองบทบาทหรือสถานะบัญชี
 * เส้นทาง: /dashboard/admin/users
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import AdminUserDirectoryTable, { type UserDirectoryRow } from "@/components/admin/AdminUserDirectoryTable";
import AdminUserFilters from "@/components/admin/AdminUserFilters";
import AdminUserArchiveToast from "@/components/admin/AdminUserArchiveToast";

type ProfileRole = "student" | "teacher" | "admin";
type AccountStatus = "all" | "active" | "inactive";

/** ตรวจแอดมิน อ่านสารบัญผู้ใช้ เติมสถานะที่ขาด และกรองข้อมูลก่อนส่งให้ตาราง */
export default async function ManageUsersPage({ searchParams }: { searchParams: Promise<{ role?: string; status?: string; q?: string; archived?: string }> }): Promise<ReactElement> {
  // role, status, q, archived: ค่าจาก query string สำหรับตัวกรอง ข้อความผลลัพธ์ หรือโหมดแก้ไขของหน้า
  const { role, status, q, archived } = await searchParams;
  // activeRole: บทบาทที่เลือกกรอง โดยใช้ all เมื่อค่าจาก URL ไม่ใช่บทบาทที่รองรับ
  const activeRole: ProfileRole | "all" = role === "student" || role === "teacher" || role === "admin" ? role : "all";
  // activeStatus: สถานะที่ผ่านการตรวจและถูกเลือกไว้สำหรับกรองหรือเปิดแท็บ
  const activeStatus: AccountStatus = status === "active" || status === "inactive" ? status : "all";
  // searchTerm: คำค้นปัจจุบันที่ใช้กรองรายการ โดยปรับรูปแบบก่อนเปรียบเทียบ
  const searchTerm = q?.trim().toLocaleLowerCase("th-TH") ?? "";
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = await createClient();
  // actor: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
  const { data: { user: actor } } = await supabase.auth.getUser();
  if (!actor) redirect("/login?redirect=/dashboard/admin/users");
  // actorProfile: ผลอ่านข้อมูลโปรไฟล์ผู้ใช้
  const { data: actorProfile } = await supabase.from("profiles")
    .select("role, is_active")
    .eq("id", actor.id)
    .maybeSingle();
  if (actorProfile?.is_active === false) redirect("/account-inactive");
  if (actorProfile?.role !== "admin") redirect("/dashboard");

  const directoryRes = await supabase.rpc("admin_list_users");
  // allUsers: รายชื่อผู้ใช้ก่อนใช้ตัวกรอง พร้อมข้อมูลที่เติมจากวิธีสำรองเมื่อจำเป็น
  let allUsers = (directoryRes.data ?? []) as UserDirectoryRow[];
  // loadError: ข้อความหรือสถานะผิดพลาดขณะอ่านข้อมูลสำหรับแสดงบนหน้า
  let loadError = directoryRes.error?.message ?? null;

  // ทำให้หน้ารายชื่อยังใช้งานได้ระหว่างรัน migration โดยข้อมูล Auth จะเพิ่มเข้ามาหลัง migration สำเร็จ
  if (directoryRes.error) {
    let fallback = await supabase.from("profiles").select("id, full_name, role, phone, university, faculty, created_at").is("archived_at", null).order("created_at", { ascending: false });
    if (fallback.error?.code === "42703" || fallback.error?.code === "PGRST204") {
      fallback = await supabase.from("profiles").select("id, full_name, role, phone, university, faculty, created_at").order("created_at", { ascending: false });
    }
    allUsers = (fallback.data ?? []).map((profile) => ({ ...profile, email: null, last_sign_in_at: null, enrollment_count: 0, certificate_count: 0, is_active: null })) as UserDirectoryRow[];
    loadError = fallback.error?.message ?? directoryRes.error.message;
  }
  // missingStatusIds: รหัสผู้ใช้ที่ RPC ส่งมาโดยยังไม่มีสถานะ is_active แบบ boolean
  const missingStatusIds = !directoryRes.error
    ? allUsers.filter((entry) => typeof entry.is_active !== "boolean").map((entry) => entry.id)
    : [];
  // statusLoadFailed: แจ้งว่าการเติมสถานะบัญชีจากแหล่งสำรองล้มเหลว
  let statusLoadFailed = false;
  if (missingStatusIds.length > 0) {
    try {
      // The directory RPC may still return its older column set. Only an authorized admin
      // reaches this server-only fallback; never expose the privileged client to the browser.
      const admin = createAdminClient();
      // statuses, error: ผลอ่านข้อมูลโปรไฟล์ผู้ใช้ พร้อมข้อผิดพลาดที่ต้องตรวจเมื่อคำขอไม่สำเร็จ
      const { data: statuses, error } = await admin.from("profiles")
        .select("id, is_active")
        .in("id", missingStatusIds);
      if (error) {
        statusLoadFailed = true;
        console.error("[admin users] Could not load account status", error.message);
      } else {
        // statusById: สถานะใช้งานบัญชีที่อ่านเพิ่มเติมโดยใช้รหัสผู้ใช้ค้นหา
        const statusById = new Map((statuses ?? []).map((entry) => [entry.id, entry.is_active]));
        allUsers = allUsers.map((entry) => ({ ...entry, is_active: statusById.get(entry.id) ?? entry.is_active }));
      }
    } catch (error) {
      statusLoadFailed = true;
      console.error("[admin users] Account status fallback unavailable", error);
    }
  }
  allUsers = allUsers.map((entry) => ({ ...entry, is_active: typeof entry.is_active === "boolean" ? entry.is_active : null }));
  // statusReady: ระบุว่าการเรียกสารบัญผู้ใช้หลักสำเร็จเพียงพอสำหรับจัดการสถานะ
  const statusReady = !directoryRes.error;
  // statusesComplete: ระบุว่าผู้ใช้ทุกรายมีสถานะบัญชีให้แสดงแล้ว
  const statusesComplete = allUsers.every((entry) => entry.is_active !== null);

  const users = allUsers.filter((user) => {
    // matchesRole: ผลตรวจว่าบทบาทผู้ใช้ตรงกับตัวกรองหรือเลือกแสดงทั้งหมด
    const matchesRole = activeRole === "all" || user.role === activeRole;
    // matchesStatus: ผลตรวจว่าสถานะรายการตรงกับตัวกรองหรือเลือกแสดงทั้งหมด
    const matchesStatus = activeStatus === "all" || user.is_active === (activeStatus === "active");
    const searchable = `${user.full_name ?? ""} ${user.email ?? ""} ${user.phone ?? ""}`.toLocaleLowerCase("th-TH");
    return matchesRole && matchesStatus && (!searchTerm || searchable.includes(searchTerm));
  });
  /** นับผู้ใช้ใน allUsers ที่มีบทบาทตรงกับ target เพื่อแสดงจำนวนในหน้ารายชื่อ */
  const countRole = (target: ProfileRole) => allUsers.filter((user) => user.role === target).length;

  return (
    <div>
      <div className="mb-7"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FF5A3C]">User management</p><h1 className="mt-1 text-[28px] font-extrabold tracking-[-0.03em] text-[#0F1B3D]">ข้อมูลผู้ใช้</h1><p className="mt-1.5 text-[13.5px] text-slate-500">ค้นหาและเปิดดูโปรไฟล์ ประวัติการเรียน และใบรับรองของผู้ใช้</p></div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[["บัญชีทั้งหมด", allUsers.length, ""], ["นักเรียน", countRole("student"), "text-blue-700"], ["ครูผู้สอน", countRole("teacher"), "text-violet-700"], ["แอดมิน", countRole("admin"), "text-slate-700"]].map(([label, count, color]) => <div key={String(label)} className="rounded-2xl border border-slate-200/70 bg-white px-5 py-4"><p className="text-[11.5px] text-slate-400">{label}</p><p className={`mt-1 text-[22px] font-extrabold ${color || "text-[#0F1B3D]"}`}>{count}</p></div>)}</div>
      {archived === "1" && <AdminUserArchiveToast />}
      {(!statusReady || !statusesComplete) && <div role="alert" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">{directoryRes.error ? "โหลดข้อมูลจัดการบัญชีไม่สำเร็จ กรุณาลองใหม่ หากยังไม่พร้อมให้ตรวจ migration สถานะบัญชี" : statusLoadFailed ? "โหลดสถานะบางบัญชีไม่สำเร็จ กรุณาลองใหม่" : "ยังแสดงสถานะบางบัญชีได้ไม่ครบ กรุณาลองใหม่"}{loadError ? ` (${loadError})` : ""}</div>}
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <AdminUserFilters key={JSON.stringify([activeRole, activeStatus, q ?? ""])} query={q ?? ""} role={activeRole} status={activeStatus} />
        </div>
        {users.length ? <AdminUserDirectoryTable users={users} currentUserId={actor?.id ?? null} statusReady={statusReady} /> : <div className="py-16 text-center text-sm text-slate-400">ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</div>}
      </div>
    </div>
  );
}
