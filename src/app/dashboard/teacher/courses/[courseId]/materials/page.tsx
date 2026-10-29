/**
 * หน้าที่ของไฟล์: ตรวจสิทธิ์คอร์สและเตรียมรายการเอกสารประกอบให้หน้าจัดการไฟล์
 * เส้นทาง: /dashboard/teacher/courses/[courseId]/materials
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
// app/teacher/courses/[courseId]/materials/page.tsx
import type { ReactElement } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import CourseMaterialsUpload from "@/components/teacher/CourseMaterialsUpload";

interface PageProps {
  params: Promise<{ courseId: string }>;
}

/** ตรวจผู้ใช้ บทบาท และเจ้าของคอร์ส แล้วโหลดเอกสารให้ CourseMaterialsUpload ตาม workspace */
export async function CourseMaterialsWorkspacePage({ params, workspace = "teacher" }: PageProps & { workspace?: "teacher" | "admin" }): Promise<ReactElement> {
  // courseId: ค่ารหัสหรือ slug จากส่วนเส้นทาง URL โดยรอ params ของ Next.js ก่อนใช้งาน
  const { courseId } = await params;
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = await createClient();

  // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/dashboard/${workspace}/courses/${courseId}/materials`);

  // profile: ผลอ่านข้อมูลโปรไฟล์ผู้ใช้
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "teacher" && profile?.role !== "admin") redirect("/");

  // course: ผลอ่านข้อมูลคอร์ส
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, created_by")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) notFound();
  if (profile.role === "teacher" && course.created_by !== user.id) redirect(`/dashboard/${workspace}`);

  // materials: ผลอ่านข้อมูลเอกสารประกอบคอร์ส
  const { data: materials } = await supabase
    .from("course_materials")
    .select("id, file_name, file_url")
    .eq("course_id", courseId)
    .order("order_index", { ascending: true });

  return (
    <div className="min-h-screen w-full bg-[#F7F8FA] py-12 px-6 lg:px-8">
      <main className="max-w-3xl mx-auto">
        <Link
          href={`/dashboard/${workspace}/courses/${course.id}`}
          className="text-[12.5px] font-semibold text-[#0F1B3D]/40 hover:text-[#0F1B3D] mb-2 inline-block"
        >
          ← กลับไปที่คอร์ส
        </Link>
        <p className="text-[13px] font-bold text-[#FF5A3C] mb-1">{course.title}</p>
        <h1 className="text-[24px] font-extrabold text-[#0F1B3D] tracking-[-0.02em] mb-6">
          เอกสารประกอบคอร์ส
        </h1>

        <CourseMaterialsUpload courseId={course.id} initialMaterials={materials ?? []} />
      </main>
    </div>
  );
}

/** ส่ง props ของหน้าให้ตัวจัดการเอกสารร่วมในพื้นที่ผู้สอน */
export default async function CourseMaterialsPage(props: PageProps): Promise<ReactElement> {
  return CourseMaterialsWorkspacePage({ ...props, workspace: "teacher" });
}
