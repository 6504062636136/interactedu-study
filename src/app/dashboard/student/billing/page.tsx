/**
 * หน้าที่ของไฟล์: แสดงประวัติลงทะเบียนและการชำระเงินแพ็กเกจของผู้เรียน
 * เส้นทาง: /dashboard/student/billing
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import type { ReactElement } from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isMissingMembershipSchema } from "@/lib/payments/membership-errors";

interface BillingCourse {
  title: string;
  cover_image_url: string | null;
  price: number;
}

interface BillingRow {
  id: string;
  status: string;
  payment_slip_url: string | null;
  created_at: string;
  approved_at: string | null;
  courses: BillingCourse | null;
}

interface MembershipBillingRow {
  id: string;
  status: string;
  paid_amount: number | string;
  created_at: string;
  expires_at: string | null;
  duration_months: number;
}

/** แปลงวันเวลาของรายการเป็นข้อความวันที่และเวลาสำหรับประวัติการชำระเงิน */
function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** แปลงสถานะการลงทะเบียนเป็นข้อความและคลาสสีของป้ายสถานะ */
function statusBadge(status: string): { label: string; className: string } {
  if (status === "approved") return { label: "ชำระเงินแล้ว", className: "bg-[#00B37E] text-white" };
  if (status === "pending") return { label: "รอการชำระเงิน", className: "bg-[#FFCB47] text-[#0F1B3D]" };
  return { label: "ถูกปฏิเสธ", className: "bg-[#0F1B3D]/10 text-[#0F1B3D]/60" };
}

/** เลือกข้อความวิธีชำระเงินจากราคาคอร์สและข้อมูลอ้างอิงการชำระ */
function paymentMethodLabel(price: number, chargeRef: string | null): string {
  if (price === 0) return "ฟรี";
  if (chargeRef) return "ชำระด้วย PromptPay (QR Code)";
  return "ยังไม่ระบุวิธีชำระเงิน";
}

/** โหลดรายการลงทะเบียนและคำสั่งซื้อ Plus ของผู้ใช้ แล้วแสดงสถานะการชำระเงิน */
export default async function BillingPage(): Promise<ReactElement> {
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = await createClient();
  // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/student/billing");

  // courseResult, membershipData, membershipError: ผลของงานอ่านข้อมูลที่เริ่มพร้อมกัน โดยเรียงตามคำขอใน Promise.all
  const [courseResult, { data: membershipData, error: membershipError }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id, status, payment_slip_url, membership_order_id, created_at, approved_at, courses(title, cover_image_url, price)")
      .eq("student_id", user.id)
      .is("membership_order_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_membership_orders")
      .select("id, status, paid_amount, created_at, expires_at, duration_months")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  // data, courseError: ผลอ่านข้อมูลการลงทะเบียน พร้อมข้อผิดพลาดที่ต้องตรวจเมื่อคำขอไม่สำเร็จ
  // Existing course purchases remain readable before the membership migration.
  const { data, error: courseError } = isMissingMembershipSchema(courseResult.error)
    ? await supabase.from("enrollments")
      .select("id, status, payment_slip_url, created_at, approved_at, courses(title, cover_image_url, price)")
      .eq("student_id", user.id).order("created_at", { ascending: false })
    : courseResult;
  // loadError: ข้อความหรือสถานะผิดพลาดขณะอ่านข้อมูลสำหรับแสดงบนหน้า
  const loadError = Boolean(courseError || membershipError);
  if (loadError) console.error("[billing] Failed to load orders", courseError?.message, membershipError?.message);

  // orders: รายการลงทะเบียนคอร์สที่ใช้สร้างประวัติคำสั่งซื้อ
  const orders = (data ?? []) as unknown as BillingRow[];
  // membershipOrders: รายการคำสั่งซื้อแพ็กเกจ Plus ของผู้เรียน
  const membershipOrders = (membershipData ?? []) as MembershipBillingRow[];
  // totalOrders: จำนวนรายการคอร์สและคำสั่งซื้อ Plus รวมกัน
  const totalOrders = orders.length + membershipOrders.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-[22px] font-extrabold text-[#0F1B3D] tracking-[-0.02em]">ประวัติการสั่งซื้อ</h1>
      </div>
      <p className="text-[13.5px] text-[#0F1B3D]/40 font-medium mb-8">{totalOrders} รายการ{loadError ? "ที่โหลดได้" : ""}</p>
      {loadError && <p role="alert" className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">โหลดประวัติการชำระเงินได้ไม่ครบ กรุณาลองใหม่ภายหลัง <Link href="/dashboard/student/billing" className="font-bold underline">โหลดใหม่</Link></p>}

      {totalOrders > 0 ? (
        <div className="space-y-5">
          {membershipOrders.map((order) => {
            const badge = order.status === "active"
              ? { label: "ชำระเงินแล้ว", className: "bg-[#00B37E] text-white" }
              : order.status === "pending"
                ? { label: "รอการชำระเงิน", className: "bg-[#FFCB47] text-[#0F1B3D]" }
                : { label: "ไม่สำเร็จ", className: "bg-[#0F1B3D]/10 text-[#0F1B3D]/60" };
            return (
              <div key={`membership-${order.id}`} className="overflow-hidden rounded-2xl border border-[#0F1B3D]/[0.06]">
                <div className="flex items-center justify-between bg-[#3157D5]/5 px-5 py-3">
                  <span className="text-[13px] font-bold text-[#0F1B3D]">Plus {order.duration_months === 12 ? "รายปี" : "รายเดือน"}: {order.id.slice(0, 8).toUpperCase()}</span>
                  <span className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${badge.className}`}>{badge.label}</span>
                </div>
                <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[14.5px] font-bold text-[#0F1B3D]">เข้าเรียนได้ทุกคอร์สเป็นเวลา {order.duration_months === 12 ? "12 เดือน" : "1 เดือน"}</p>
                    <p className="mt-1 text-[12.5px] text-[#0F1B3D]/40">วันที่สั่งซื้อ: {formatDateTime(order.created_at)}</p>
                    {order.expires_at && <p className="text-[12.5px] text-[#0F1B3D]/40">ใช้สิทธิ์ได้ถึง: {formatDateTime(order.expires_at)}</p>}
                  </div>
                  <p className="shrink-0 text-right text-[17px] font-extrabold text-[#0F1B3D]">
                    {Number(order.paid_amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} THB
                  </p>
                </div>
              </div>
            );
          })}
          {orders.map((order) => {
            const badge = statusBadge(order.status);
            // orderCode: รหัสย่อจากรหัสรายการ ใช้ช่วยอ้างอิงคำสั่งซื้อบนหน้าจอ
            const orderCode = order.id.slice(0, 8).toUpperCase();
            return (
              <div key={order.id} className="rounded-2xl border border-[#0F1B3D]/[0.06] overflow-hidden">
                <div
                  className={`flex items-center justify-between px-5 py-3 ${
                    order.status === "approved" ? "bg-[#00B37E]/10" : "bg-[#FFCB47]/15"
                  }`}
                >
                  <span className="text-[13px] font-bold text-[#0F1B3D]">คำสั่งซื้อ: {orderCode}</span>
                  <span className={`text-[11.5px] font-bold px-3 py-1 rounded-full ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative w-24 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-[#0F1B3D] to-[#182852] shrink-0">
                    {order.courses?.cover_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={order.courses.cover_image_url}
                        alt={order.courses.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-[14.5px] font-bold text-[#0F1B3D] mb-1">{order.courses?.title ?? "คอร์สที่ไม่พร้อมแสดงข้อมูล"}</p>
                    <p className="text-[12.5px] text-[#0F1B3D]/40 font-medium">
                      วันที่สั่งซื้อ: {formatDateTime(order.created_at)}
                    </p>
                    <p className="text-[12.5px] text-[#0F1B3D]/40 font-medium">
                      วิธีชำระเงิน: {order.courses ? paymentMethodLabel(order.courses.price, order.payment_slip_url) : "—"}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[12px] text-[#0F1B3D]/40 font-medium mb-1">ยอดชำระ</p>
                    <p className="text-[17px] font-extrabold text-[#0F1B3D]">
                      {order.courses ? (order.courses.price === 0 ? "0.00" : order.courses.price.toLocaleString("th-TH")) : "—"} THB
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : !loadError ? (
        <div className="rounded-2xl border border-dashed border-[#0F1B3D]/15 bg-white px-5 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3F6FF] text-xl font-extrabold text-[#3157D5]" aria-hidden="true">฿</span>
          <h2 className="mt-4 text-base font-extrabold text-[#0F1B3D]">ยังไม่มีประวัติการชำระเงิน</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">เมื่อสมัคร Plus หรือซื้อคอร์ส รายการชำระเงินจะแสดงในหน้านี้ คุณสามารถดูแพ็กเกจ Plus ได้ทุกเมื่อ</p>
          <Link href="/membership" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#3157D5] px-5 text-sm font-bold text-white transition hover:bg-[#2446B8]">
            ดูแพ็กเกจ Plus
          </Link>
        </div>
      ) : null}
    </div>
  );
}
