/**
 * หน้าที่ของไฟล์: ใช้ตัวแก้ไขบทเรียนร่วมสำหรับสร้างหรือแก้ไขบทเรียนในพื้นที่แอดมิน
 * เส้นทาง: /dashboard/admin/courses/[courseId]/lessons/new
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import { CourseLessonEditorPage } from "@/app/dashboard/teacher/courses/[courseId]/lessons/new/page";

/** ส่ง params และ searchParams ให้ CourseLessonEditorPage โดยกำหนด workspace เป็น admin */
export default async function AdminNewLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ lessonId?: string }>;
}) {
  return CourseLessonEditorPage({ params, searchParams, workspace: "admin" });
}
