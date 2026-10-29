import "server-only";

import { createNotification } from "@/lib/notifications/service";
import { createAdminClient } from "@/utils/supabase/admin";

interface EnrollmentRow {
  id: string;
  student_id: string;
  course_id: string;
  status: string;
  paid_amount: number | string | null;
  courses: { title: string; price: number | string | null } | { title: string; price: number | string | null }[] | null;
}

function courseData(row: EnrollmentRow): { title: string; price: number | string | null } | null {
  const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
  return course ?? null;
}
//join ไปตาราง courses (ดึง title กับ price ของคอร์สนั้นมาด้วยในคราวเดียว ผ่าน foreign key relationship)
// Helper ของเราใน Server รับ chargeId คืน boolean (false=ไม่พบ enrollment) หรือ throw เมื่อ DB error
// charge-status/webhook เรียกหลังตรวจ successful; หา enrollments.payment_slip_url แล้วเปลี่ยน pending เป็น approved และแจ้ง student_id
export async function approveEnrollmentForCharge(chargeId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("id, student_id, course_id, status, paid_amount, courses(title, price)")
    .eq("payment_slip_url", chargeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return false;

  const enrollment = data as unknown as EnrollmentRow;
  const course = courseData(enrollment);
  const storedAmount = Number(enrollment.paid_amount ?? 0);
  const paidAmount = storedAmount > 0 ? storedAmount : Math.max(0, Number(course?.price ?? 0));
  // ค่าปรับปรุงสิทธิ์ซื้อรายคอร์ส: ไม่มีวันหมดอายุ/สมาชิก; ไม่เปลี่ยน approved_at เดิมเมื่ออนุมัติซ้ำ และ dedupeKey ด้านล่างใช้ enrollment.id กันแถวแจ้งเตือนซ้ำ
  const approvalValues: { status: string; paid_amount: number; approved_at?: string; membership_order_id: null; access_expires_at: null } = {
    status: "approved",
    paid_amount: paidAmount,
    membership_order_id: null,
    access_expires_at: null,
  };
  if (enrollment.status !== "approved") approvalValues.approved_at = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("enrollments")
    .update(approvalValues)
    .eq("id", enrollment.id);
  if (updateError) throw new Error(updateError.message);

  await createNotification({
    userId: enrollment.student_id,
    type: "payment_approved",
    title: "ชำระเงินเรียบร้อยแล้ว",
    message: `ชำระเงินเรียบร้อยแล้ว สามารถเข้าเรียนคอร์ส ${course?.title ?? "ที่ลงทะเบียน"} ได้แล้ว`,
    relatedType: "enrollment",
    relatedId: enrollment.id,
    actionUrl: `/dashboard/student/courses/${enrollment.course_id}`,
    dedupeKey: `payment_approved:${enrollment.id}`,
  });

  return true;
}
