/**
 * หน้าที่ของไฟล์: แสดงฟอร์มสร้างคอร์สในพื้นที่แอดมิน
 * เส้นทาง: /dashboard/admin/courses/new
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import CourseCreateForm from "@/components/courses/CourseCreateForm";

/** เปิด CourseCreateForm โดยกำหนด workspace เป็น admin */
export default function AdminNewCoursePage() {
  return <CourseCreateForm workspace="admin" />;
}
