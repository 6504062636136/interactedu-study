/**
 * หน้าที่ของไฟล์: หน้าภาพรวมคอร์สของผู้เรียน แสดงบทเรียน ความก้าวหน้า ข้อสอบ และใบประกาศนียบัตร
 * เส้นทาง: /dashboard/student/courses/[courseId]
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Award, BookOpen, CheckCircle2, Clock3, Play } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { DEFAULT_COURSE_COVER_URL } from "@/lib/constants/course-cover";
import { getResumeSeconds, isLessonComplete, summarizeStudentProgress, type StudentProgressLesson, type StudentTracking } from "@/lib/courses/student-progress";
import { formatCourseVideoDuration, formatStudyTime } from "@/lib/courses/study-time";
import ClaimCertificateButton from "@/components/certificates/ClaimCertificateButton";
import { hasStartedLearning, loadLearningEnrollments, type LearningEnrollment } from "@/lib/courses/learning-enrollment";
import { loadSavedCourseEnrollments } from "@/lib/courses/course-library";
import SaveCourseButton from "@/components/courses/SaveCourseButton";

interface Lesson extends StudentProgressLesson {
  title: string;
  order_index: number;
  video_duration_seconds: number;
  is_published: boolean | null;
}
interface Module { id: string; title: string; order_index: number; lessons: Lesson[] }
interface OverviewEnrollment extends LearningEnrollment {
  id: string;
  courses: { id: string; title: string; description: string | null; cover_image_url: string | null; category: string | null } | null;
}

/** แปลงวินาทีเป็นเวลาแบบนาที:วินาที โดยตัดค่าทศนิยมและป้องกันค่าติดลบ */
function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

/** ตรวจการลงทะเบียนที่ยังใช้ได้ แล้วโหลดบทเรียน ผลเรียน ข้อสอบ และเงื่อนไขใบประกาศนียบัตร */
export default async function StudentCourseOverview({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams?: Promise<{ start?: string }> }) {
  // courseId: ค่ารหัสหรือ slug จากส่วนเส้นทาง URL โดยรอ params ของ Next.js ก่อนใช้งาน
  const { courseId } = await params;
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = await createClient();
  // user: ผลตรวจผู้ใช้จากเซสชันปัจจุบัน ก่อนอ่านหรือบันทึกข้อมูลเฉพาะบัญชี
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/dashboard/student/courses/${courseId}`);

  // enrollmentData, enrollmentError: ผลอ่านข้อมูลการลงทะเบียน พร้อมข้อผิดพลาดที่ต้องตรวจเมื่อคำขอไม่สำเร็จ
  const { data: enrollmentData, error: enrollmentError } = await loadLearningEnrollments((includeStart) => supabase.from("enrollments")
    .select(`id, membership_order_id, ${includeStart ? "learning_started_at, " : ""}courses(id, title, description, cover_image_url, category)`)
    .eq("student_id", user.id).eq("course_id", courseId).eq("status", "approved")
    .or(`access_expires_at.is.null,access_expires_at.gt.${new Date().toISOString()}`).maybeSingle());
  // enrollment: ข้อมูลการลงทะเบียนของผู้เรียนในคอร์สนี้ที่ใช้ตรวจสิทธิ์และเชื่อมประวัติการเรียน
  const enrollment = enrollmentData as unknown as OverviewEnrollment | null;
  if (enrollmentError) throw new Error("โหลดข้อมูลการลงทะเบียนไม่สำเร็จ");
  if (!enrollment) notFound();
  // course: ข้อมูลคอร์สที่ผูกกับรายการหรือหน้าที่กำลังแสดง ซึ่งอาจเป็น null หากอ่านไม่พบ
  const course = Array.isArray(enrollment.courses) ? enrollment.courses[0] : enrollment.courses;
  if (!course) return (
    <div className="rounded-2xl bg-amber-50 p-6 text-sm text-amber-800">
      <p>คอร์สนี้ยังไม่พร้อมเปิดให้เรียน กรุณาลองใหม่ภายหลังหรือติดต่อผู้ดูแลระบบ</p>
      <Link href="/dashboard/student/courses" className="mt-3 inline-block font-bold underline">กลับไปคอร์สของฉัน</Link>
    </div>
  );

  // modulesResult, trackingResult, settingsResult, certificateResult, attemptResult, studyTimeResult: ผลของงานอ่านข้อมูลที่เริ่มพร้อมกัน โดยเรียงตามคำขอใน Promise.all
  const [modulesResult, trackingResult, settingsResult, certificateResult, attemptResult, studyTimeResult] = await Promise.all([
    supabase.from("modules").select("id, title, order_index, lessons(id, title, order_index, video_duration_seconds, is_published, scorm_source, scorm_manifest)").eq("course_id", courseId).order("order_index"),
    supabase.from("scorm_tracking").select("lesson_id, lesson_status, video_completed, last_accessed, completed_scos, cmi_data").eq("enrollment_id", enrollment.id),
    supabase.from("courses").select("certificate_enabled, certificate_pass_percentage").eq("id", courseId).maybeSingle(),
    supabase.from("certificates").select("id, status, issued_at").eq("user_id", user.id).eq("course_id", courseId).maybeSingle(),
    supabase.from("quiz_attempts").select("id, score, passed, submitted_at").eq("enrollment_id", enrollment.id).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("student_study_time").select("total_seconds").eq("enrollment_id", enrollment.id).maybeSingle(),
  ]);
  if (modulesResult.error) throw new Error("โหลดรายการบทเรียนไม่สำเร็จ");
  // rawModules: ข้อมูลโมดูลและบทเรียนจากฐานข้อมูลก่อนกรองรายการที่ยังไม่เผยแพร่
  const rawModules = (modulesResult.data ?? []) as unknown as Module[];
  // unpublishedLessons: จำนวนบทเรียนที่ยังไม่เผยแพร่ ใช้ป้องกันการถือว่าเรียนครบทั้งคอร์สก่อนเนื้อหาพร้อม
  const unpublishedLessons = rawModules.flatMap((module) => module.lessons ?? []).filter((lesson) => !lesson.is_published).length;
  // modules: โมดูลและบทเรียนภายในคอร์สที่จัดเตรียมไว้สำหรับส่วนนี้
  const modules = rawModules.map((module) => ({ ...module, lessons: [...(module.lessons ?? [])].filter((lesson) => lesson.is_published).sort((a, b) => a.order_index - b.order_index) })).filter((module) => module.lessons.length);
  // lessons: บทเรียนที่ใช้แสดงหรือเป็นฐานคำนวณในส่วนนี้
  const lessons = modules.flatMap((module) => module.lessons);
  // tracking: ประวัติการเรียนที่ใช้คำนวณความก้าวหน้าในส่วนนี้
  const tracking = (trackingResult.data ?? []) as unknown as StudentTracking[];
  // progress: ผลสรุปจากบริการกลาง รวมจำนวนบทเรียนที่จบ เปอร์เซ็นต์ และบทเรียนสำหรับเรียนต่อ
  const progress = summarizeStudentProgress(lessons, tracking);
  // trackingAvailable: ระบุว่าโหลด tracking สำเร็จ จึงใช้ตัดสินเงื่อนไขความสำเร็จของคอร์สได้
  const trackingAvailable = !trackingResult.error;
  // started: ระบุว่ามีประวัติเริ่มเรียนแล้วตามข้อมูลของรายการที่กำลังพิจารณา
  const started = hasStartedLearning({ ...enrollment, scorm_tracking: tracking, student_study_time: studyTimeResult.data });
  // allLessonsComplete: ระบุว่า tracking พร้อม เรียนครบตามบริการกลาง และไม่มีบทเรียนที่ยังไม่เผยแพร่
  const allLessonsComplete = trackingAvailable && progress.allComplete && unpublishedLessons === 0;
  // resume: บทเรียนที่บริการสรุปความก้าวหน้าเลือกให้เรียนต่อ
  const resume = progress.resumeLesson;
  // Loading/prefetching the overview never writes learning state. Only the
  // mounted player records a first start after this authorized redirect.
  if ((await searchParams)?.start === "1" && trackingAvailable && resume) redirect(`/play/${courseId}/${resume.id}`);
  // library: ผลโหลดคลังคอร์สที่บันทึกไว้ ใช้แยกการเก็บคอร์สออกจากสิทธิ์ที่ได้ด้วยสมาชิก
  const library = enrollment.membership_order_id ? await loadSavedCourseEnrollments(supabase, user.id) : null;
  // resumeSeconds: ตำแหน่งเล่นต่อเป็นวินาทีสำหรับบทเรียน SCORM ที่ระบบสร้างเอง
  const resumeSeconds = resume?.scorm_source === "generated" ? getResumeSeconds(progress.byLesson.get(resume.id)) : 0;
  // videoDuration: ข้อความความยาววิดีโอรวมของคอร์สที่จัดรูปแบบแล้วสำหรับแสดงผล
  const videoDuration = formatCourseVideoDuration(lessons.reduce((sum, lesson) => sum + (lesson.video_duration_seconds || 0), 0));
  // certificate: ใบประกาศนียบัตรของผู้เรียนในคอร์สนี้ที่โหลดได้ หรือ null เมื่อยังไม่มี
  const certificate = certificateResult.data;
  // attempt: ผลสอบครั้งล่าสุดที่ query เลือกมาใช้แสดงสถานะการสอบของผู้เรียน
  const attempt = attemptResult.data;
  // passed: ระบุว่าผลสอบที่อ่านมาแจ้งว่าผ่านแล้วหรือไม่
  const passed = attempt?.passed === true;
  // certificateEnabled: สถานะเปิดใช้งานการออกใบประกาศนียบัตรของคอร์ส
  const certificateEnabled = settingsResult.data?.certificate_enabled === true;
  // passPercentage: เกณฑ์ผ่านเป็นเปอร์เซ็นต์ที่ใช้แสดงหรือคำนวณเงื่อนไขสอบผ่าน
  const passPercentage = Number(settingsResult.data?.certificate_pass_percentage ?? 70);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/dashboard/student/courses" className="inline-flex text-[13px] font-semibold text-[#3157D5] hover:underline">← กลับไปคอร์สของฉัน</Link>
      <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white">
        <div className="grid md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="bg-[#0F1B3D] p-6 text-white sm:p-8">
            <p className="text-xs font-bold text-blue-200">{course.category || "คอร์สเรียนของคุณ"}</p>
            <h1 className="mt-2 break-words text-2xl font-extrabold sm:text-3xl">{course.title}</h1>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/70">
              <span className="inline-flex items-center gap-1.5"><BookOpen size={15} /> {progress.total} บทเรียน</span>
              <span className="inline-flex items-center gap-1.5"><Clock3 size={15} /> ความยาวคลิปรวม {videoDuration ?? "ยังไม่ระบุ"}</span>
              {certificateEnabled && <span className="inline-flex items-center gap-1.5"><Award size={15} /> มีใบรับรองเมื่อผ่านเกณฑ์</span>}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={course.cover_image_url || DEFAULT_COURSE_COVER_URL} alt="" className="h-44 w-full object-cover md:h-full" />
        </div>
        <div className="p-6 sm:p-8">
          <h2 className="text-base font-extrabold text-[#0F1B3D]">เกี่ยวกับคอร์สนี้</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{course.description?.trim() || "ผู้สอนยังไม่ได้เพิ่มคำอธิบายคอร์ส"}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-extrabold text-[#0F1B3D]">ความคืบหน้าของคุณ</h2>
            <p className="mt-1 text-sm text-slate-600">{trackingAvailable ? `เรียนครบ ${progress.completed} จาก ${progress.total} บท · ${progress.percent}%` : "โหลดความคืบหน้าไม่สำเร็จ กรุณารีเฟรชหน้า"}</p>
            <p className="mt-1 text-sm font-semibold text-[#3157D5]">เวลาเรียนสะสมในคอร์สนี้: {studyTimeResult.error ? "—" : formatStudyTime(Number(studyTimeResult.data?.total_seconds) || 0)}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            {resume && trackingAvailable && <Link href={`/play/${courseId}/${resume.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3157D5] px-5 py-3 text-sm font-bold text-white hover:bg-[#0F1B3D]">
              <Play size={16} /> {progress.allComplete ? "ทบทวนบทเรียน" : started ? "เรียนต่อจากที่ค้าง" : "เริ่มเรียน"}
            </Link>}
            {enrollment.membership_order_id && !started && <SaveCourseButton courseId={courseId} initialSaved={library?.enrollmentIds.has(enrollment.id)} available={library?.ready ?? false} />}
          </div>
        </div>
        {trackingAvailable && <div role="progressbar" aria-label="ความคืบหน้าบทเรียน" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-[#3157D5]" style={{ width: `${progress.percent}%` }} /></div>}
        {resume && trackingAvailable && !progress.allComplete && <p className="mt-3 text-xs text-slate-600">{progress.started ? "เรียนต่อ" : "บทแรก"}: {resume.title}{resumeSeconds > 0 ? ` · ตำแหน่งที่บันทึกไว้ ${formatTime(resumeSeconds)}` : ""}</p>}
        {allLessonsComplete && <p className="mt-3 text-sm font-semibold text-emerald-700">เรียนครบทุกบทแล้ว{passed || certificate?.status === "issued" ? " และผ่านแบบทดสอบแล้ว" : " พร้อมทำแบบทดสอบท้ายคอร์ส"}</p>}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-extrabold text-[#0F1B3D]">บทเรียนในคอร์ส</h2>
        {modules.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">ยังไม่มีบทเรียนที่พร้อมเปิดให้เรียน</p> : <div className="space-y-5">
          {modules.map((module) => <div key={module.id}>
            <h3 className="mb-2 text-sm font-bold text-slate-600">{module.title}</h3>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {module.lessons.map((lesson) => {
                // record: tracking ของบทเรียนที่กำลังสร้างแถวแสดงผล
                const record = progress.byLesson.get(lesson.id);
                // complete: ระบุว่า tracking ของบทเรียนแถวนี้ผ่านเกณฑ์เรียนจบของบริการกลางแล้วหรือไม่
                const complete = isLessonComplete(record);
                // started: ระบุว่ามีประวัติเริ่มเรียนแล้วตามข้อมูลของรายการที่กำลังพิจารณา
                const started = !!record?.last_accessed || getResumeSeconds(record) > 0;
                // active: ระบุว่าแถวนี้เป็นบทเรียนที่ควรเรียนต่อและยังเรียนไม่จบ เพื่อเน้นพื้นหลังในรายการ
                const active = !complete && resume?.id === lesson.id && progress.started;
                return <Link key={lesson.id} href={`/play/${courseId}/${lesson.id}`} className={`flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-blue-50 ${active ? "bg-blue-50/60" : ""}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${complete ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{complete ? <CheckCircle2 size={18} /> : <Play size={16} />}</span>
                  <div className="min-w-0 flex-1"><p className="break-words text-sm font-bold text-[#0F1B3D]">{lesson.title}</p><p className="mt-1 text-xs text-slate-500">{lesson.video_duration_seconds > 0 ? `${formatTime(lesson.video_duration_seconds)} นาที` : ""}{active ? " · เรียนต่อที่บทนี้" : ""}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${complete ? "bg-emerald-50 text-emerald-700" : started ? "bg-blue-50 text-[#3157D5]" : "bg-slate-100 text-slate-500"}`}>{!trackingAvailable ? "ไม่ทราบสถานะ" : complete ? "เรียนจบแล้ว" : started ? "กำลังเรียน" : "ยังไม่เริ่ม"}</span>
                </Link>;
              })}
            </div>
          </div>)}
        </div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-[#0F1B3D]">แบบทดสอบท้ายคอร์ส</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">เรียนครบทุกบทก่อนทำแบบทดสอบ โดยต้องได้อย่างน้อย {passPercentage}% จึงผ่านเกณฑ์{certificateEnabled ? "และรับใบรับรอง" : ""}</p>
        {attemptResult.error ? <p className="mt-3 text-sm text-amber-700">โหลดผลสอบไม่สำเร็จ กรุณารีเฟรชหน้า</p> : attempt && <p className={`mt-3 text-sm font-bold ${passed ? "text-emerald-700" : "text-orange-700"}`}>ผลสอบล่าสุด {Number(attempt.score)}% · {passed ? "ผ่านแล้ว" : "ยังไม่ผ่าน"}</p>}
        {certificate?.status === "issued" ? <p className="mt-4 text-sm font-semibold text-emerald-700">ผ่านเกณฑ์และได้รับใบรับรองแล้ว</p> : allLessonsComplete ? <Link href={`/dashboard/student/courses/${courseId}/final-exam`} className="mt-4 inline-flex rounded-xl bg-[#0F1B3D] px-5 py-3 text-sm font-bold text-white hover:bg-[#3157D5]">{attempt ? "ทำแบบทดสอบอีกครั้ง" : "เริ่มทำแบบทดสอบ"}</Link> : <p className="mt-4 text-sm font-semibold text-slate-500">{unpublishedLessons > 0 ? "บางบทเรียนอยู่ระหว่างปรับปรุง" : "เรียนให้ครบทุกบทเพื่อปลดล็อกแบบทดสอบ"}</p>}
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-[#0F1B3D]"><Award size={21} /> ใบรับรองของคุณ</h2>
        {certificateResult.error || settingsResult.error ? <p className="mt-3 text-sm text-amber-700">โหลดข้อมูลใบรับรองไม่สำเร็จ กรุณารีเฟรชหน้า</p> : certificate?.status === "issued" ? <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-emerald-800">ได้รับใบรับรองแล้ว · ออกเมื่อ {new Date(certificate.issued_at).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
          <a href={`/api/me/certificates/${certificate.id}/download`} className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">ดาวน์โหลดใบรับรอง PDF</a>
        </div> : certificate?.status === "revoked" ? <p className="mt-3 text-sm text-red-700">ใบรับรองนี้ถูกยกเลิกแล้ว กรุณาติดต่อผู้ดูแลระบบ</p> : !certificateEnabled ? <p className="mt-3 text-sm text-slate-600">คอร์สนี้ไม่ได้เปิดการออกใบรับรอง</p> : allLessonsComplete && passed && attempt ? <div className="mt-3 space-y-3"><p className="text-sm text-emerald-800">คุณผ่านแบบทดสอบแล้ว สามารถขอรับใบรับรองได้</p><ClaimCertificateButton courseId={courseId} attemptId={attempt.id} /></div> : <p className="mt-3 text-sm text-slate-600">เมื่อเรียนครบทุกบทและสอบผ่านตามเกณฑ์ ใบรับรองจะปรากฏให้ดาวน์โหลดที่นี่</p>}
      </section>
    </div>
  );
}
