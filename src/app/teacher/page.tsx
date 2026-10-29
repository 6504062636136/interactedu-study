/**
 * หน้าที่ของไฟล์: ทางเข้าเดิมของผู้สอนที่ส่งต่อไปแดชบอร์ดผู้สอน
 * เส้นทาง: /teacher
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
// app/teacher/page.tsx
import { redirect } from "next/navigation";
/** เปลี่ยนเส้นทางจาก /teacher ไป /dashboard/teacher */
export default function TeacherHomePage(): never {
  redirect("/dashboard/teacher");
}
