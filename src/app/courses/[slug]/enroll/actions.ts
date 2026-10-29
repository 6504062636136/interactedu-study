"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { createNotification, notifyAdmins } from "@/lib/notifications/service";

async function requireActiveStudent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  slug: string,
): Promise<void> {
  const { data: profile, error } = await supabase.from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (error || !profile) redirect(`/courses/${slug}/enroll?error=1`);
  if (!profile.is_active) redirect("/account-inactive");
  if (profile.role !== "student") redirect("/dashboard");
}

// 1. คอร์สฟรี: อนุมัติทันที + ส่งโนติหานักเรียน
// ศึกษา 3.2.2.3: ฟอร์ม Enroll เรียก Server Action ของเรา ส่ง courseId=courses.id และ slug=courses.slug สำหรับ URL
// ตรวจ active student แล้วสร้าง/แก้ enrollments เป็น approved, paid_amount=0; DB error redirect กลับพร้อม error; สำเร็จแจ้งผู้เรียน
export async function enrollFreeCourse(courseId: string, slug: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/courses/${slug}/enroll`);
  }
  await requireActiveStudent(supabase, user.id, slug);

  // Promise.all() รอ query อิสระพร้อมกัน; existing คือ enrollment ของคู่ student_id=user.id กับ course_id=courseId
  const [{ data: existing, error: existingError }, { data: course }] = await Promise.all([
    supabase.from("enrollments").select("id, status, access_expires_at")
      .eq("student_id", user.id).eq("course_id", courseId).maybeSingle(),
    supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
  ]);

  if (existingError) {
    console.error("Failed to check existing free enrollment:", existingError.message);
    redirect(`/courses/${slug}/enroll?error=1`);
  }
  if (existing?.status === "approved"
    && (!existing.access_expires_at || new Date(existing.access_expires_at).getTime() > Date.now())) {
    redirect(`/courses/${slug}/success`);
  }

  // ?: เลือก update เมื่อมีแถวเดิม หรือ insert เมื่อยังไม่มี; single() ต้องได้หนึ่งแถว ส่วน maybeSingle() ยอมให้ไม่พบ
  const enrollmentQuery = existing
    ? supabase.from("enrollments").update({
        status: "approved",
        approved_at: new Date().toISOString(),
        paid_amount: 0,
        membership_order_id: null,
        access_expires_at: null,
      }).eq("id", existing.id).select("id").single()
    : supabase.from("enrollments").insert({
        student_id: user.id,
        course_id: courseId,
        status: "approved",
        approved_at: new Date().toISOString(),
        paid_amount: 0,
      }).select("id").single();
  const { data: enrollment, error } = await enrollmentQuery;

  if (error) {
    console.error("Failed to create free enrollment:", error.message);
    redirect(`/courses/${slug}/enroll?error=1`);
  }

  if (enrollment) {
    await createNotification({
      userId: user.id,
      type: "course_access_granted",
      title: "เข้าเรียนได้แล้ว",
      message: `คุณได้รับสิทธิ์เข้าเรียนคอร์ส ${course?.title ?? "ที่ลงทะเบียน"} แล้ว`,
      relatedType: "enrollment",
      relatedId: enrollment.id,
      actionUrl: `/dashboard/student/courses/${courseId}`,
      dedupeKey: `course_access_granted:${enrollment.id}`,
    });
  }

  redirect(`/courses/${slug}/success`);
}

// 2. จ่ายผ่าน Omise QR Code: อนุมัติทันทีอัตโนมัติ + ส่งโนติหานักเรียน
// ข้อจำกัด 3.2.2.4: ไม่พบ UI เรียก Action นี้ใน src; รับ chargeId แล้ว INSERT approved โดยไม่ได้ถาม Omise ในฟังก์ชันนี้
// Flow QR ที่ UI เรียกจริงอยู่ /api/omise/create-charge → charge-status/webhook → approveEnrollmentForCharge
export async function enrollPaidCourseAuto(
  courseId: string,
  slug: string,
  chargeId: string
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/courses/${slug}/enroll`);
  }
  await requireActiveStudent(supabase, user.id, slug);

  const { data: course } = await supabase
    .from("courses")
    .select("title, price")
    .eq("id", courseId)
    .maybeSingle();
  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .insert({
      student_id: user.id,
      course_id: courseId,
      status: "approved",
      approved_at: new Date().toISOString(),
      payment_slip_url: chargeId,
      paid_amount: Number(course?.price ?? 0),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create auto paid enrollment:", error.message);
    redirect(`/courses/${slug}/enroll?error=1`);
  }

  if (enrollment) {
    await createNotification({
      userId: user.id,
      type: "course_access_granted",
      title: "เข้าเรียนได้แล้ว",
      message: `คุณได้รับสิทธิ์เข้าเรียนคอร์ส ${course?.title ?? "ที่ลงทะเบียน"} แล้ว`,
      relatedType: "enrollment",
      relatedId: enrollment.id,
      actionUrl: `/dashboard/student/courses/${courseId}`,
      dedupeKey: `course_access_granted:${enrollment.id}`,
    });
  }

  redirect(`/courses/${slug}/success`);
}

// 3. แนบรูปสลิปโอนเงินเอง: รอแอดมินตรวจ (pending) + ส่งโนติหาแอดมิน
// ศึกษา 3.2.2.5: Action ฝั่ง Server รับ courseId, slug, paymentSlipUrl (URL ที่ส่งเข้ามา) คืนผ่าน redirect
// บันทึก enrollments.pending และ notifyAdmins; ไม่อัปโหลดไฟล์เอง และยังไม่พบ UI caller/ขั้นตอนอนุมัติสลิปครบวงจรใน src
export async function enrollPaidCourseManualSlip(
  courseId: string,
  slug: string,
  paymentSlipUrl: string
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/courses/${slug}/enroll`);
  }
  await requireActiveStudent(supabase, user.id, slug);

  const { data: course } = await supabase
    .from("courses")
    .select("title, price")
    .eq("id", courseId)
    .maybeSingle();
  const { data: enrollment, error } = await supabase
    .from("enrollments")
    .insert({
      student_id: user.id,
      course_id: courseId,
      status: "pending",
      payment_slip_url: paymentSlipUrl,
      paid_amount: Number(course?.price ?? 0),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create manual slip enrollment:", error.message);
    redirect(`/courses/${slug}/enroll?error=1`);
  }

  if (enrollment) {
    await notifyAdmins({
      type: "payment_slip_pending",
      title: "มีหลักฐานการชำระเงินใหม่",
      message: `มีหลักฐานการชำระเงินคอร์ส ${course?.title ?? "ออนไลน์"} รอตรวจสอบ`,
      relatedType: "enrollment",
      relatedId: enrollment.id,
      actionUrl: `/dashboard/admin/users/${user.id}`,
      dedupeKey: `payment_slip_pending:${enrollment.id}`,
    });
  }

  redirect(`/courses/${slug}/enroll?submitted=1`);
}
