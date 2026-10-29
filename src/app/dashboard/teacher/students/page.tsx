/**
 * หน้าที่ของไฟล์: สรุปรายชื่อผู้เรียน ความก้าวหน้า และคะแนนในคอร์สของผู้สอน
 * เส้นทาง: /dashboard/teacher/students
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import TeacherStudentsClient, {
  type TeacherCourseOption,
  type TeacherStudentProgressRow,
} from "@/components/teacher/TeacherStudentsClient";
import { createClient } from "@/utils/supabase/server";

interface CourseRow {
  id: string;
  title: string;
}

interface EnrollmentRow {
  id: string;
  student_id: string;
  course_id: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  university: string | null;
  faculty: string | null;
}

interface LessonRow {
  id: string;
  title: string;
  order_index: number;
}

interface ModuleRow {
  id: string;
  course_id: string;
  order_index: number;
  lessons: LessonRow[];
}

interface TrackingRow {
  enrollment_id: string;
  lesson_id: string;
  lesson_status: string | null;
  video_completed: boolean | null;
  score_raw: number | string | null;
  quiz_score_recorded: boolean | null;
  course_final_exam_recorded: boolean | null;
  quiz_attempted_at: string | null;
}

/** ถือว่าบทเรียนเสร็จเมื่อ tracking ระบุ video_completed หรือสถานะ completed/passed */
function isCompleted(row: TrackingRow | undefined): boolean {
  return Boolean(
    row &&
      (row.video_completed === true || row.lesson_status === "completed" || row.lesson_status === "passed")
  );
}

/** เลือกคะแนนที่บันทึกจริงล่าสุด จัดให้อยู่ระหว่าง 0–100 และระบุว่าเป็นคะแนนคอร์สหรือควิซ */
function scoreFromTracking(rows: TrackingRow[]): {
  score: number | null;
  label: string | null;
} {
  // scoredRows: tracking ที่มีคะแนนยืนยันแล้ว เรียงจากวันที่ทำล่าสุดก่อน
  const scoredRows = rows
    .filter(
      (row) =>
        row.score_raw !== null &&
        (row.course_final_exam_recorded === true || row.quiz_score_recorded === true)
    )
    .sort((a, b) => {
      const dateDiff =
        new Date(b.quiz_attempted_at ?? 0).getTime() - new Date(a.quiz_attempted_at ?? 0).getTime();
      if (dateDiff !== 0) return dateDiff;
      return Number(b.course_final_exam_recorded) - Number(a.course_final_exam_recorded);
    });

  const latest = scoredRows[0];
  if (!latest) return { score: null, label: null };

  // numericScore: คะแนนล่าสุดที่แปลงเป็นตัวเลขก่อนตรวจช่วงและปัดทศนิยม
  const numericScore = Number(latest.score_raw);
  if (!Number.isFinite(numericScore)) return { score: null, label: null };

  return {
    score: Math.max(0, Math.min(100, Math.round(numericScore * 100) / 100)),
    label: latest.course_final_exam_recorded ? "ข้อสอบท้ายคอร์ส" : "ควิซล่าสุด",
  };
}

/** อ่านคอร์สที่ผู้ใช้สร้าง แล้วรวมการลงทะเบียน โปรไฟล์ บทเรียน และ tracking ให้ตารางผู้เรียน */
// ศึกษา 3.2.2.17: Server Component ของเราอ่าน user → courses.created_by=user.id → enrollments.approved ของ courseIds
// อ่าน profiles/modules/lessons/scorm_tracking รวมเป็น rows ส่ง TeacherStudentsClient; ไม่มีคอร์ส/ผู้เรียนแสดงว่าง, query error ส่ง loadError
export default async function TeacherStudentsPage(): Promise<ReactElement> {
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = await createClient();
  // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/dashboard/teacher/students");

  // courseData, courseError: ผลอ่านข้อมูลคอร์ส พร้อมข้อผิดพลาดที่ต้องตรวจเมื่อคำขอไม่สำเร็จ
  const { data: courseData, error: courseError } = await supabase
    .from("courses")
    .select("id, title")
    .eq("created_by", user.id)
    .order("title", { ascending: true });

  // courses: รายการคอร์สที่ใช้แสดงหรือคำนวณในหน้านี้
  const courses = (courseData ?? []) as CourseRow[];
  // courseOptions: รหัสและชื่อคอร์สสำหรับตัวเลือกกรองรายชื่อผู้เรียน
  const courseOptions: TeacherCourseOption[] = courses.map((course) => ({
    id: course.id,
    title: course.title,
  }));

  if (courseError) {
    return (
      <TeacherStudentsClient
        courses={[]}
        rows={[]}
        loadError="โหลดข้อมูลคอร์สไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
      />
    );
  }

  if (courses.length === 0) {
    return <TeacherStudentsClient courses={[]} rows={[]} />;
  }

  // courseIds: รหัสคอร์สที่ใช้จำกัดการอ่านข้อมูลเกี่ยวข้องให้ตรงกับรายการที่กำลังแสดง
  const courseIds = courses.map((course) => course.id);
  // enrollmentData, enrollmentError: ผลอ่านข้อมูลการลงทะเบียน พร้อมข้อผิดพลาดที่ต้องตรวจเมื่อคำขอไม่สำเร็จ
  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id, student_id, course_id, created_at")
    .in("course_id", courseIds)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (enrollmentError) {
    return (
      <TeacherStudentsClient
        courses={courseOptions}
        rows={[]}
        loadError="โหลดรายชื่อนักเรียนไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ฐานข้อมูลแล้วลองใหม่"
      />
    );
  }

  // enrollments: รายการลงทะเบียนที่ผ่านเงื่อนไข query และตัวกรองของหน้านี้แล้ว
  const enrollments = (enrollmentData ?? []) as EnrollmentRow[];
  if (enrollments.length === 0) {
    return <TeacherStudentsClient courses={courseOptions} rows={[]} />;
  }

  // studentIds: รหัสผู้เรียนที่ไม่ซ้ำกันสำหรับอ่านโปรไฟล์ในคำขอเดียว
  const studentIds = [...new Set(enrollments.map((enrollment) => enrollment.student_id))];
  // enrollmentIds: รหัสการลงทะเบียนที่ใช้จับคู่และอ่านข้อมูลความก้าวหน้า
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);

  // profilesResult, modulesResult, trackingResult: ผลของงานอ่านข้อมูลที่เริ่มพร้อมกัน โดยเรียงตามคำขอใน Promise.all
  const [profilesResult, modulesResult, trackingResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, university, faculty")
      .in("id", studentIds),
    supabase
      .from("modules")
      .select("id, course_id, order_index, lessons(id, title, order_index)")
      .in("course_id", courseIds)
      .order("order_index", { ascending: true }),
    supabase
      .from("scorm_tracking")
      .select(
        "enrollment_id, lesson_id, lesson_status, video_completed, score_raw, quiz_score_recorded, course_final_exam_recorded, quiz_attempted_at"
      )
      .in("enrollment_id", enrollmentIds),
  ]);

  const queryErrors = [profilesResult.error, modulesResult.error, trackingResult.error].filter(Boolean);

  // profiles: รายการโปรไฟล์ที่ใช้เติมข้อมูลผู้เรียนหรือเจ้าของรายการ
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  // modules: โมดูลและบทเรียนภายในคอร์สที่จัดเตรียมไว้สำหรับส่วนนี้
  const modules = (modulesResult.data ?? []) as unknown as ModuleRow[];
  // trackingRows: แถวความก้าวหน้าที่อ่านได้จากฐานข้อมูล ก่อนจัดกลุ่มหรือสรุปผล
  const trackingRows = (trackingResult.data ?? []) as TrackingRow[];

  // courseById: ข้อมูลคอร์สที่ค้นได้โดยรหัส เพื่อเชื่อมข้อมูลกับแต่ละการลงทะเบียน
  const courseById = new Map(courses.map((course) => [course.id, course]));
  // profileById: ข้อมูลโปรไฟล์ที่ค้นได้โดยรหัสผู้ใช้ เพื่อเติมชื่อและข้อมูลผู้เรียน
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  // lessonsByCourse: จัดกลุ่มบทเรียนตามรหัสคอร์สเพื่อใช้สรุปข้อมูลรายคอร์ส
  const lessonsByCourse = new Map<string, LessonRow[]>();
  // trackingByEnrollment: จัดกลุ่ม tracking ตามรหัสการลงทะเบียน เพื่อแยกความก้าวหน้าของแต่ละผู้เรียน
  const trackingByEnrollment = new Map<string, TrackingRow[]>();

  for (const moduleRow of modules) {
    const existingLessons = lessonsByCourse.get(moduleRow.course_id) ?? [];
    const orderedLessons = [...(moduleRow.lessons ?? [])].sort(
      (a, b) => a.order_index - b.order_index
    );
    existingLessons.push(...orderedLessons);
    lessonsByCourse.set(moduleRow.course_id, existingLessons);
  }

  for (const tracking of trackingRows) {
    const existingRows = trackingByEnrollment.get(tracking.enrollment_id) ?? [];
    existingRows.push(tracking);
    trackingByEnrollment.set(tracking.enrollment_id, existingRows);
  }

  // rows: ข้อมูลผู้เรียนต่อการลงทะเบียน รวมชื่อ คอร์ส ความก้าวหน้า บทเรียนถัดไป และคะแนน
  const rows: TeacherStudentProgressRow[] = enrollments.flatMap((enrollment) => {
    // course: ข้อมูลคอร์สที่ผูกกับรายการหรือหน้าที่กำลังแสดง ซึ่งอาจเป็น null หากอ่านไม่พบ
    const course = courseById.get(enrollment.course_id);
    if (!course) return [];

    // profile: ข้อมูลโปรไฟล์ที่ใช้แสดงรายละเอียดหรือเติมข้อมูลผู้ใช้ในส่วนนี้
    const profile = profileById.get(enrollment.student_id);
    // lessons: บทเรียนที่ใช้แสดงหรือเป็นฐานคำนวณในส่วนนี้
    const lessons = lessonsByCourse.get(enrollment.course_id) ?? [];
    // enrollmentTracking: ประวัติการเรียนเฉพาะการลงทะเบียนที่กำลังสร้างข้อมูลแสดงผล
    const enrollmentTracking = trackingByEnrollment.get(enrollment.id) ?? [];
    // trackingByLesson: จับคู่รหัสบทเรียนกับ tracking เพื่อเช็กความสำเร็จของบทเรียนได้โดยตรง
    const trackingByLesson = new Map(
      enrollmentTracking.map((tracking) => [tracking.lesson_id, tracking])
    );
    // completedLessons: จำนวนบทเรียนที่ tracking ระบุว่าเสร็จแล้วตามกติกาของหน้านี้
    const completedLessons = lessons.filter((lesson) =>
      isCompleted(trackingByLesson.get(lesson.id))
    ).length;
    // totalLessons: จำนวนบทเรียนที่นำมาคำนวณหรือแสดงในส่วนนี้
    const totalLessons = lessons.length;
    // progress: เปอร์เซ็นต์ความก้าวหน้าที่คำนวณจากบทเรียนที่เสร็จเทียบกับบทเรียนทั้งหมด
    const progress =
      totalLessons > 0 ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;
    const nextLesson = lessons.find((lesson) => !isCompleted(trackingByLesson.get(lesson.id)));
    // ข้อจำกัด: หน้านี้ยังอ่านคะแนนผ่าน scoreFromTracking/scorm_tracking ไม่ได้อ่าน quiz_attempts ซึ่ง Final Exam ปัจจุบันใช้เก็บผลหลัก
    const latestScore = scoreFromTracking(enrollmentTracking);

    return [
      {
        enrollmentId: enrollment.id,
        studentId: enrollment.student_id,
        studentName: profile?.full_name?.trim() || `นักเรียน ${enrollment.student_id.slice(0, 8)}`,
        avatarUrl: profile?.avatar_url ?? null,
        university: profile?.university ?? null,
        faculty: profile?.faculty ?? null,
        courseId: course.id,
        courseTitle: course.title,
        enrolledAt: enrollment.created_at,
        progress,
        completedLessons,
        totalLessons,
        latestScore: latestScore.score,
        scoreLabel: latestScore.label,
        nextLessonTitle: nextLesson?.title ?? null,
        status:
          totalLessons > 0 && progress === 100
            ? "completed"
            : progress > 0
              ? "in_progress"
              : "not_started",
      },
    ];
  });

  return (
    <TeacherStudentsClient
      courses={courseOptions}
      rows={rows}
      loadError={
        queryErrors.length > 0
          ? "ข้อมูลบางส่วนโหลดไม่สำเร็จ กรุณารัน migration ล่าสุดหรือตรวจสอบ RLS ของ Supabase"
          : undefined
      }
    />
  );
}
