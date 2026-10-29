/**
 * หน้าที่ของไฟล์: ทางเข้าหน้าจัดการข้อสอบท้ายคอร์สในพื้นที่ผู้สอน
 * เส้นทาง: /dashboard/teacher/courses/[courseId]/exam
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import CourseExamManagementPage from "@/components/courses/CourseExamManagementPage";

/** อ่าน courseId แล้วเปิด CourseExamManagementPage ด้วย workspace ของผู้สอน */
export default async function TeacherCourseExamPage({ params }: { params: Promise<{ courseId: string }> }) {
  // courseId: ค่ารหัสหรือ slug จากส่วนเส้นทาง URL โดยรอ params ของ Next.js ก่อนใช้งาน
  const { courseId } = await params;
  return <CourseExamManagementPage courseId={courseId} workspace="teacher" />;
}
