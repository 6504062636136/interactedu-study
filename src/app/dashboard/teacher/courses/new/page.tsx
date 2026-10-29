/**
 * หน้าที่ของไฟล์: แสดงฟอร์มสร้างคอร์สในพื้นที่ผู้สอน
 * เส้นทาง: /dashboard/teacher/courses/new
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import CourseCreateForm from "@/components/courses/CourseCreateForm";

/** เปิด CourseCreateForm โดยกำหนด workspace เป็น teacher */
export default function TeacherNewCoursePage() {
  return <CourseCreateForm workspace="teacher" />;
}
