/**
 * หน้าที่ของไฟล์: ใช้หน้าจัดการเอกสารประกอบร่วมในพื้นที่แอดมิน
 * เส้นทาง: /dashboard/admin/courses/[courseId]/materials
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import { CourseMaterialsWorkspacePage } from "@/app/dashboard/teacher/courses/[courseId]/materials/page";

/** ส่ง params ให้ CourseMaterialsWorkspacePage โดยกำหนด workspace เป็น admin */
export default async function AdminCourseMaterialsPage({ params }: { params: Promise<{ courseId: string }> }) {
  return CourseMaterialsWorkspacePage({ params, workspace: "admin" });
}
