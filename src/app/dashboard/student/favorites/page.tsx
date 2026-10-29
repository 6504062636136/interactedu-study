/**
 * หน้าที่ของไฟล์: แสดงและนำคอร์สออกจากรายการโปรดของผู้เรียน
 * เส้นทาง: /dashboard/student/favorites
 * เป็น Client Component เพื่อรองรับสถานะและการโต้ตอบบนเบราว์เซอร์
 * useState เก็บค่าที่ทำให้หน้าจอแสดงผลใหม่เมื่อเปลี่ยน
 */
// app/dashboard/student/favorites/page.tsx
"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { DEFAULT_COURSE_COVER_URL } from "@/lib/constants/course-cover";

// supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
const supabase = createClient();

interface FavoriteCourse {
  id: string;
  title: string;
  cover_image_url: string | null;
}

/** เก็บรายการคอร์สโปรด โหลดข้อมูลเมื่อเปิดหน้า และอัปเดตรายการเมื่อนำคอร์สออก */
export default function FavoriteCoursesPage(): ReactElement {
  // courses: รายการคอร์สที่ใช้แสดงหรือคำนวณในหน้านี้; setCourses ใช้อัปเดตค่านี้
  const [courses, setCourses] = useState<FavoriteCourse[]>([]);
  // isLoading: สถานะกำลังอ่านข้อมูล ใช้สลับส่วนโหลดและเนื้อหาจริง; setIsLoading ใช้อัปเดตค่านี้
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    /** อ่านผู้ใช้แล้วโหลด course_favorites พร้อมข้อมูลคอร์สสำหรับแสดงการ์ด */
    async function load() {
      // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsLoading(false); return; }

      // data, error: ผลอ่านข้อมูลคอร์สโปรด พร้อมข้อผิดพลาดที่ต้องตรวจเมื่อคำขอไม่สำเร็จ
      const { data, error } = await supabase
        .from("course_favorites")
        .select("course_id, courses(id, title, cover_image_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCourses(
          data
            .map((row) => row.courses as unknown as FavoriteCourse)
            .filter(Boolean)
        );
      }
      setIsLoading(false);
    }
    void load();
  }, []);

  /** ลบรายการโปรดของผู้ใช้ตาม courseId แล้วนำการ์ดนั้นออกจากสถานะในหน้า */
  async function handleRemove(courseId: string) {
    // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("course_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("course_id", courseId);

    setCourses((prev) => prev.filter((c) => c.id !== courseId));
  }

  return (
    <div>
      <h1 className="text-[20px] font-bold text-blue-950 mb-6 flex items-center gap-2">
        <Heart className="w-5 h-5 text-slate-400" />
        คอร์สโปรดของฉัน
      </h1>

      {isLoading ? (
        <p className="text-[13.5px] text-slate-400 py-8 text-center">กำลังโหลด...</p>
      ) : courses.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-xl py-16 text-center">
          <p className="text-[13.5px] text-slate-400">ยังไม่มีคอร์สที่บันทึกไว้</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className="border border-slate-200 rounded-xl overflow-hidden group relative"
            >
              <Link href={`/courses/${course.id}`}>
                <div className="w-full h-32 bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={course.cover_image_url ?? DEFAULT_COURSE_COVER_URL}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <p className="text-[13.5px] font-semibold text-slate-900 line-clamp-2">
                    {course.title}
                  </p>
                </div>
              </Link>
              <button
                onClick={() => handleRemove(course.id)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
                aria-label="ลบออกจากรายการโปรด"
              >
                <Heart className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}