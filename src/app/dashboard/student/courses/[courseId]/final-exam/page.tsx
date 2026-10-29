/**
 * หน้าที่ของไฟล์: ทางเข้าสู่หน้าทำข้อสอบท้ายคอร์สของผู้เรียน
 * เส้นทาง: /dashboard/student/courses/[courseId]/final-exam
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import type { ReactElement } from "react";
import CourseFinalExam from "@/components/courses/CourseFinalExam";

/** อ่าน courseId จาก URL แล้วส่งให้ CourseFinalExam ซึ่งจัดการโหลดข้อสอบและคำตอบ */
export default async function CourseFinalExamPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}): Promise<ReactElement> {
  // courseId: ค่ารหัสหรือ slug จากส่วนเส้นทาง URL โดยรอ params ของ Next.js ก่อนใช้งาน
  const { courseId } = await params;
  return <CourseFinalExam courseId={courseId} />;
}
