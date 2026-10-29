/**
 * หน้าที่ของไฟล์: ฟอร์มสร้างคอร์สร่วมของผู้สอนและแอดมิน จัดการตรวจข้อมูล อัปโหลดปก และบันทึกคอร์ส
 * เป็น Client Component เพื่อรองรับสถานะและการโต้ตอบบนเบราว์เซอร์
 * useState เก็บค่าที่ทำให้หน้าจอแสดงผลใหม่เมื่อเปลี่ยน ส่วน useRef เก็บค่าอ้างอิงที่ไม่สั่งแสดงผลใหม่
 */
"use client";

import { useState, useRef, useEffect, type ChangeEvent, type FormEvent, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCourse } from "@/app/dashboard/teacher/courses/actions";
import { createClient } from "@/utils/supabase/client";
import { CATEGORIES, type Category } from "@/lib/constants/categories";
//const CATEGORIES = ["เทคโนโลยี", "ธุรกิจ", "ภาษา", "การออกแบบ", "การตลาด", "พัฒนาตนเอง", "อื่นๆ"];

type Workspace = "teacher" | "admin";

interface CourseFieldErrors {
  courseCode?: string;
  title?: string;
  customCategory?: string;
  price?: string;
}

// OFFLINE_MESSAGE: ข้อความที่ใช้แจ้งเมื่ออุปกรณ์ไม่มีการเชื่อมต่ออินเทอร์เน็ต
const OFFLINE_MESSAGE = "ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบสัญญาณเน็ตแล้วลองใหม่อีกครั้ง";
// SYSTEM_ERROR_MESSAGE: ข้อความกลางเมื่อระบบไม่สามารถทำรายการได้ในขณะนี้
const SYSTEM_ERROR_MESSAGE = "ระบบขัดข้องชั่วคราว ไม่สามารถบันทึกข้อมูลคอร์สได้ กรุณาลองใหม่อีกครั้งในภายหลัง";
// อนุญาตตัวอักษรอังกฤษ/ตัวเลข/ขีดกลาง/ขีดล่างเท่านั้น (เช่น CS101, ENG-201, WEB_01) — กันภาษาไทย/สัญลักษณ์/HTML tag หลุดเข้ามา
const COURSE_CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
// COURSE_CODE_FORMAT_ERROR: ข้อความที่แสดงเมื่อรหัสคอร์สไม่ผ่านรูปแบบที่กำหนด
const COURSE_CODE_FORMAT_ERROR = "รหัสวิชาต้องเป็นตัวอักษรภาษาอังกฤษและตัวเลขเท่านั้น (เช่น CS101)";

/** จัดกรอบแต่ละหมวดของฟอร์มด้วยชื่อ คำอธิบาย และ children ของช่องกรอก */
function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#0F1B3D]/[0.06] bg-white p-6 shadow-[0_1px_2px_rgba(15,27,61,0.04)]">
      <h2 className="text-[14.5px] font-bold text-[#0F1B3D]">{title}</h2>
      {subtitle ? <p className="mb-4 mt-0.5 text-[12.5px] text-[#0F1B3D]/40">{subtitle}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

// inputClass: คลาสตกแต่งร่วมของ input เพื่อให้ช่องกรอกมีรูปแบบเดียวกัน
const inputClass =
  "w-full rounded-lg border border-[#0F1B3D]/[0.08] bg-[#F7F8FA] px-3.5 py-2.5 text-[13.5px] text-[#0F1B3D] outline-none transition-colors placeholder:text-[#0F1B3D]/30 focus:border-[#0F1B3D]/30 focus:bg-white";
// labelClass: คลาสตกแต่งร่วมของป้ายชื่อช่องกรอก
const labelClass = "mb-1.5 block text-[13px] font-semibold text-[#0F1B3D]/70";

/** เก็บข้อมูลคอร์สและสถานะฟอร์ม โดย workspace กำหนดพื้นที่แดชบอร์ดที่จะกลับไปหลังบันทึก */
export default function CourseCreateForm({ workspace }: { workspace: Workspace }): ReactElement {
  // router: ตัวควบคุมการเปลี่ยนหน้าและรีเฟรชข้อมูลผ่าน Next.js บนเบราว์เซอร์
  const router = useRouter();
  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = createClient();
  const basePath = `/dashboard/${workspace}`;

  // courseCode: รหัสวิชาที่ผู้ใช้กรอกเพื่อใช้อ้างอิงคอร์ส; setCourseCode ใช้อัปเดตค่านี้
  const [courseCode, setCourseCode] = useState("");
  // title: ชื่อที่ใช้แสดงหรือค่าชื่อที่กำลังแก้ไขในฟอร์มส่วนนี้; setTitle ใช้อัปเดตค่านี้
  const [title, setTitle] = useState("");
  // category: หมวดหมู่คอร์สหรือคำถามที่ใช้จัดกลุ่มและแสดงผลในส่วนนี้; setCategory ใช้อัปเดตค่านี้
  //const [category, setCategory] = useState(CATEGORIES[0]);
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  // customCategory: ชื่อหมวดหมู่ที่ผู้ใช้พิมพ์เมื่อเลือกหมวดอื่น ๆ; setCustomCategory ใช้อัปเดตค่านี้
  const [customCategory, setCustomCategory] = useState("");
  // description: รายละเอียดคอร์สที่ผู้ใช้กรอกในฟอร์ม; setDescription ใช้อัปเดตค่านี้
  const [description, setDescription] = useState("");
  // isFree: ระบุว่าเป็นคอร์สฟรี เพื่อเลือกส่วนสมัครฟรีหรือส่วนชำระเงิน; setIsFree ใช้อัปเดตค่านี้
  const [isFree, setIsFree] = useState(false);
  // price: ราคาคอร์สที่กรอกในฟอร์ม ก่อนแปลงเป็นตัวเลขตอนบันทึก; setPrice ใช้อัปเดตค่านี้
  const [price, setPrice] = useState("0");
  // certificateEnabled: สถานะเปิดใช้งานการออกใบประกาศนียบัตรของคอร์ส; setCertificateEnabled ใช้อัปเดตค่านี้
  const [certificateEnabled, setCertificateEnabled] = useState(true);
  // certificatePassPercentage: คะแนนร้อยละขั้นต่ำที่กำหนดให้ผ่านเกณฑ์ใบประกาศนียบัตร; setCertificatePassPercentage ใช้อัปเดตค่านี้
  const [certificatePassPercentage, setCertificatePassPercentage] = useState("70");
  // coverFile: ไฟล์ภาพปกที่รออัปโหลดตอนบันทึกคอร์ส; setCoverFile ใช้อัปเดตค่านี้
  const [coverFile, setCoverFile] = useState<File | null>(null);
  // coverPreview: URL ชั่วคราวของภาพปกสำหรับแสดงตัวอย่างในฟอร์ม; setCoverPreview ใช้อัปเดตค่านี้
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  // fieldErrors: ข้อความตรวจสอบข้อมูลแยกตามชื่อช่อง เพื่อแสดงข้อผิดพลาดใกล้ช่องกรอก; setFieldErrors ใช้อัปเดตค่านี้
  const [fieldErrors, setFieldErrors] = useState<CourseFieldErrors>({});
  // error: ข้อผิดพลาดปัจจุบันที่ใช้แจ้งให้ผู้ใช้ทราบในส่วนนี้; setError ใช้อัปเดตค่านี้
  const [error, setError] = useState<string | null>(null);
  // saving: สถานะกำลังบันทึกข้อมูลของฟอร์มนี้; setSaving ใช้อัปเดตค่านี้
  const [saving, setSaving] = useState(false);
  // savingStep: ข้อความอธิบายขั้นตอนที่กำลังทำ เช่น อัปโหลดปกหรือบันทึกคอร์ส; setSavingStep ใช้อัปเดตค่านี้
  const [savingStep, setSavingStep] = useState<string | null>(null);
  // isOffline: สถานะที่เบราว์เซอร์รายงานว่าไม่มีการเชื่อมต่ออินเทอร์เน็ต; setIsOffline ใช้อัปเดตค่านี้
  const [isOffline, setIsOffline] = useState(false);

  // courseCodeRef: อ้างถึงช่องรหัสวิชาเพื่อย้ายโฟกัสเมื่อกรอกข้อมูลไม่ถูกต้อง
  const courseCodeRef = useRef<HTMLInputElement>(null);
  // titleRef: อ้างถึงช่องชื่อคอร์สเพื่อย้ายโฟกัสเมื่อกรอกข้อมูลไม่ถูกต้อง
  const titleRef = useRef<HTMLInputElement>(null);
  // customCategoryRef: อ้างถึงช่องชื่อหมวดหมู่เพื่อย้ายโฟกัสเมื่อกรอกข้อมูลไม่ถูกต้อง
  const customCategoryRef = useRef<HTMLInputElement>(null);
  // priceRef: อ้างถึงช่องราคาเพื่อย้ายโฟกัสเมื่อกรอกข้อมูลไม่ถูกต้อง
  const priceRef = useRef<HTMLInputElement>(null);
  // ref แบบ synchronous กันดับเบิลคลิก/กดรัวๆ ยิง request สร้างคอร์สซ้ำ (state update เป็น async)
  const isSavingRef = useRef(false);

  // แถบแจ้งเตือนด้านบนสุดของจอ: เด้งขึ้นทันทีที่เน็ตหลุด ไม่ต้องรอกดบันทึกก่อนถึงจะรู้
  useEffect(() => {
    setIsOffline(!navigator.onLine);
    /** ปรับสถานะว่าเบราว์เซอร์กลับมาออนไลน์เพื่อให้ฟอร์มใช้งานได้ตามปกติ */
    const handleOnline = () => setIsOffline(false);
    /** ปรับสถานะว่าเบราว์เซอร์ออฟไลน์เพื่อให้ฟอร์มแสดงข้อความการเชื่อมต่อ */
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  /** เก็บไฟล์ปกที่เลือกและสร้าง URL ชั่วคราวสำหรับแสดงภาพตัวอย่าง */
  function handleCoverChange(event: ChangeEvent<HTMLInputElement>) {
    // file: ไฟล์ที่ผู้ใช้เลือกจาก input เพื่อนำไปตรวจและอัปโหลด
    const file = event.target.files?.[0] ?? null;
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  /** ตรวจรหัส ชื่อ หมวดหมู่ และราคาคอร์สก่อนอัปโหลดหรือส่งคำขอสร้างคอร์ส */
  function validate(): CourseFieldErrors {
    // errors: ข้อผิดพลาดแยกตามชื่อช่อง ซึ่งต้องแก้ให้ครบก่อนส่งฟอร์ม
    const errors: CourseFieldErrors = {};
    // trimmedCode: รหัสวิชาที่ตัดช่องว่างหัวท้ายก่อนตรวจว่ากรอกครบและตรงรูปแบบ
    const trimmedCode = courseCode.trim();
    if (!trimmedCode) {
      errors.courseCode = "กรุณากรอกรหัสวิชา";
    } else if (!COURSE_CODE_PATTERN.test(trimmedCode)) {
      errors.courseCode = COURSE_CODE_FORMAT_ERROR;
    }
    if (!title.trim()) errors.title = "กรุณากรอกชื่อคอร์ส";
    if (category === "อื่นๆ" && !customCategory.trim()) errors.customCategory = "กรุณาระบุหมวดวิชา";

    // ราคาบังคับเช็คเฉพาะตอนไม่ติ๊ก "คอร์สเรียนฟรี" — ติ๊กฟรีแล้วราคาถูก force เป็น 0 ที่ server อยู่แล้ว
    if (!isFree) {
      // trimmedPrice: ราคาที่ตัดช่องว่างหัวท้ายเพื่อแยกกรณียังไม่กรอกจากการกรอกศูนย์
      const trimmedPrice = price.trim();
      if (!trimmedPrice) {
        errors.price = "กรุณากรอกราคาคอร์ส หรือติ๊กเลือกคอร์สเรียนฟรี";
      } else {
        // priceNumber: ค่าราคาที่แปลงเป็นตัวเลขสำหรับตรวจช่วงราคาที่อนุญาต
        const priceNumber = Number(trimmedPrice);
        if (Number.isNaN(priceNumber)) {
          errors.price = "ราคาต้องเป็นตัวเลขเท่านั้น";
        } else if (priceNumber < 0) {
          errors.price = "ราคาต้องมากกว่าหรือเท่ากับ 0";
        } else if (priceNumber < 20) {
          errors.price = "ราคาคอร์สขั้นต่ำ 20 บาท";
        }
      }
    }
    return errors;
  }

  /** แปลงข้อผิดพลาดที่รับมาเป็นข้อความภาษาไทยตามสาเหตุ เช่น เน็ตขาดหรือระบบไม่พร้อม */
  // แปล error จาก server/เครือข่ายให้เป็นภาษาที่เข้าใจง่าย ไม่ใช้ศัพท์เทคนิค
  function toFriendlyMessage(err: unknown): string {
    if (typeof navigator !== "undefined" && !navigator.onLine) return OFFLINE_MESSAGE;

    const raw = err instanceof Error ? err.message : String(err);
    // message: ข้อความผิดพลาดดิบที่แปลงเป็นตัวพิมพ์เล็ก เพื่อเลือกข้อความภาษาไทยตามสาเหตุ
    const message = raw.toLowerCase();

    // ข้อความเฉพาะที่ server action ส่งมาแล้ว (เช่น รหัสวิชาซ้ำ) ให้ผ่านตรงๆ ไม่ต้อง map ซ้ำ
    if (raw === "รหัสวิชานี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบและใช้รหัสวิชาอื่น") return raw;
    if (raw === SYSTEM_ERROR_MESSAGE) return raw;

    if (message.includes("failed to fetch") || message.includes("network")) return OFFLINE_MESSAGE;
    if (message.includes("timeout") || message.includes("timed out")) return SYSTEM_ERROR_MESSAGE;

    // ข้อความจาก validation ของ server action (เช่น "กรุณาใส่ชื่อคอร์ส") ยังอ่านง่ายอยู่แล้ว ปล่อยผ่าน
    return raw || SYSTEM_ERROR_MESSAGE;
  }

  /** ป้องกันการส่งซ้ำ ตรวจฟอร์ม อัปโหลดปก แล้วเรียก Server Action สร้างคอร์ส */
  // ศึกษา 3.2.2.6: ผู้สอนส่งฟอร์ม → helper ใน Browser; อัปโหลดปกไป Supabase Storage course-covers แล้วส่ง URL/ข้อมูลไป createCourse
  // Action คืน courseId จึง router.push ไปจัดการคอร์ส; catch แสดง error (Storage กับ Database เป็นคนละขั้นตอน)
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // กันดับเบิลคลิก/กดรัวๆ ยิง request ซ้ำ — เช็ค ref แบบ synchronous ก่อนแม้แต่จะ setState
    if (isSavingRef.current) return;

    setError(null);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError(OFFLINE_MESSAGE);
      return;
    }

    // errors: ข้อผิดพลาดแยกตามชื่อช่อง ซึ่งต้องแก้ให้ครบก่อนส่งฟอร์ม
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // auto-focus ไปช่องแรกสุดที่มีปัญหาตามลำดับในฟอร์ม
      if (errors.courseCode) courseCodeRef.current?.focus();
      else if (errors.title) titleRef.current?.focus();
      else if (errors.customCategory) customCategoryRef.current?.focus();
      else if (errors.price) priceRef.current?.focus();
      return;
    }

    setFieldErrors({});
    // finalCategory: หมวดหมู่สุดท้ายที่เลือกจากตัวเลือกหรือข้อความที่ผู้ใช้กรอกเอง
    const finalCategory = category === "อื่นๆ" ? customCategory.trim() : category;
    isSavingRef.current = true;
    setSaving(true);

    try {
      // coverImageUrl: URL ภาพปกที่อัปโหลดสำเร็จและจะส่งบันทึกกับคอร์ส
      let coverImageUrl: string | null = null;
      if (coverFile) {
        setSavingStep("กำลังอัปโหลดปกคอร์ส...");
        const extension = coverFile.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("course-covers").upload(path, coverFile);
        if (uploadError) throw new Error(`อัปโหลดปกคอร์สไม่สำเร็จ: ${uploadError.message}`);
        coverImageUrl = supabase.storage.from("course-covers").getPublicUrl(path).data.publicUrl;
      }

      setSavingStep("กำลังสร้างคอร์ส...");
      const result = await createCourse({
        title,
        courseCode,
        category: finalCategory,
        description: description || null,
        isFree,
        price: Number(price),
        coverImageUrl,
        certificateEnabled,
        certificatePassPercentage: Number(certificatePassPercentage),
      });

      if (result.error || !result.courseId) throw new Error(result.error ?? SYSTEM_ERROR_MESSAGE);
      router.push(`${basePath}/courses/${result.courseId}`);
    } catch (submitError) {
      setError(toFriendlyMessage(submitError));
      isSavingRef.current = false;
      setSaving(false);
      setSavingStep(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {isOffline && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-2.5 text-center text-[13px] font-semibold text-white shadow-lg"
        >
          คุณกำลังออฟไลน์ ข้อมูลอาจไม่ถูกบันทึก
        </div>
      )}
      <div className="mb-6">
        <Link href={`${basePath}/courses`} className="mb-2 inline-block text-[12.5px] font-semibold text-[#0F1B3D]/40 hover:text-[#0F1B3D]">
          ← กลับหน้าคอร์ส
        </Link>
        <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-[#0F1B3D]">สร้างคอร์สใหม่</h1>
        <p className="mt-1.5 text-[14px] text-[#0F1B3D]/50">ตั้งค่าคอร์สและเกณฑ์ใบรับรอง จากนั้นเพิ่มบทเรียนและบททดสอบท้ายคอร์ส</p>
      </div>

      {error && <div role="alert" className="mb-5 rounded-lg border border-[#FF5A3C]/20 bg-[#FF5A3C]/[0.08] px-4 py-3 text-[13px] text-[#EB4A2D]">{error}</div>}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <SectionCard title="ข้อมูลพื้นฐาน">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>รหัสวิชา <span className="text-red-500">*</span></span>
              <input
                ref={courseCodeRef}
                required
                value={courseCode}
                onChange={(event) => {
                  // แปลงเป็นตัวพิมพ์ใหญ่ให้อัตโนมัติตามมาตรฐานรหัสวิชา (react-2026 -> REACT-2026)
                  setCourseCode(event.target.value.toUpperCase());
                  setFieldErrors((prev) => (prev.courseCode ? { ...prev, courseCode: undefined } : prev));
                }}
                placeholder="เช่น WEB101"
                aria-invalid={!!fieldErrors.courseCode}
                aria-describedby={fieldErrors.courseCode ? "courseCode-error" : undefined}
                className={`${inputClass} ${fieldErrors.courseCode ? "!border-red-400 focus:!border-red-500" : ""}`}
              />
              {fieldErrors.courseCode && (
                <p id="courseCode-error" className="mt-1.5 text-[12.5px] font-medium text-red-600">{fieldErrors.courseCode}</p>
              )}
            </label>

            <label>
              <span className={labelClass}>หมวดวิชา</span>
              <select
                value={category}
                onChange={(event) => {
                  const next = event.target.value as Category;
                  setCategory(next);
                  // TC-CC-10: สลับออกจาก "อื่นๆ" แล้วต้องเคลียร์ค่า/error ของช่อง "ระบุหมวดวิชา" ทันที
                  if (next !== "อื่นๆ") {
                    setCustomCategory("");
                    setFieldErrors((prev) => (prev.customCategory ? { ...prev, customCategory: undefined } : prev));
                  }
                }}
                className={inputClass}
              >
                {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          {category === "อื่นๆ" && (
            <label className="mt-4 block">
              <span className={labelClass}>ระบุหมวดวิชา <span className="text-red-500">*</span></span>
              <input
                ref={customCategoryRef}
                required
                value={customCategory}
                onChange={(event) => {
                  setCustomCategory(event.target.value);
                  setFieldErrors((prev) => (prev.customCategory ? { ...prev, customCategory: undefined } : prev));
                }}
                aria-invalid={!!fieldErrors.customCategory}
                aria-describedby={fieldErrors.customCategory ? "customCategory-error" : undefined}
                className={`${inputClass} ${fieldErrors.customCategory ? "!border-red-400 focus:!border-red-500" : ""}`}
              />
              {fieldErrors.customCategory && (
                <p id="customCategory-error" className="mt-1.5 text-[12.5px] font-medium text-red-600">{fieldErrors.customCategory}</p>
              )}
            </label>
          )}
          <label className="mt-4 block">
            <span className={labelClass}>ชื่อคอร์ส <span className="text-red-500">*</span></span>
            <input
              ref={titleRef}
              required
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setFieldErrors((prev) => (prev.title ? { ...prev, title: undefined } : prev));
              }}
              placeholder="เช่น พื้นฐาน React สำหรับผู้เริ่มต้น"
              aria-invalid={!!fieldErrors.title}
              aria-describedby={fieldErrors.title ? "title-error" : undefined}
              className={`${inputClass} ${fieldErrors.title ? "!border-red-400 focus:!border-red-500" : ""}`}
            />
            {fieldErrors.title && (
              <p id="title-error" className="mt-1.5 text-[12.5px] font-medium text-red-600">{fieldErrors.title}</p>
            )}
          </label>
          <label className="mt-4 block"><span className={labelClass}>คำอธิบาย</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className={inputClass} /></label>
        </SectionCard>

        <SectionCard title="บททดสอบท้ายคอร์สและใบรับรอง" subtitle="ใบรับรองจะออกอัตโนมัติเมื่อเรียนครบและผ่านบททดสอบท้ายคอร์ส">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={certificateEnabled} onChange={(event) => setCertificateEnabled(event.target.checked)} className="h-4 w-4 accent-[#FF5A3C]" />
            <span className="text-[13.5px] font-semibold text-[#0F1B3D]/70">เปิดใช้งานใบรับรองสำหรับคอร์สนี้</span>
          </label>
          <label className="mt-4 block max-w-xs"><span className={labelClass}>คะแนนผ่านบททดสอบ (%)</span><input type="number" min={0} max={100} step="0.01" required value={certificatePassPercentage} onChange={(event) => setCertificatePassPercentage(event.target.value)} className={inputClass} /></label>
        </SectionCard>

        <SectionCard title="ราคา">
          <label className="mb-3 flex w-fit cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(event) => {
                const checked = event.target.checked;
                setIsFree(checked);
                // ติ๊กฟรีแล้วช่องราคาจะถูกซ่อน/ไม่เกี่ยวข้องอีกต่อไป เคลียร์ error ค้างทิ้งด้วย
                if (checked) setFieldErrors((prev) => (prev.price ? { ...prev, price: undefined } : prev));
              }}
              className="h-4 w-4 accent-[#0F1B3D]"
            />
            <span className="text-[13.5px] font-medium text-[#0F1B3D]/70">คอร์สเรียนฟรี</span>
          </label>
          {!isFree && (
            <label className="block max-w-xs">
              <span className={labelClass}>ราคา (บาท) <span className="text-red-500">*</span></span>
              <input
                ref={priceRef}
                type="number"
                min={0}
                step="1"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  setFieldErrors((prev) => (prev.price ? { ...prev, price: undefined } : prev));
                }}
                aria-invalid={!!fieldErrors.price}
                aria-describedby={fieldErrors.price ? "price-error" : undefined}
                className={`${inputClass} ${fieldErrors.price ? "!border-red-400 focus:!border-red-500" : ""}`}
              />
              {fieldErrors.price && (
                <p id="price-error" className="mt-1.5 text-[12.5px] font-medium text-red-600">{fieldErrors.price}</p>
              )}
            </label>
          )}
        </SectionCard>

        <SectionCard title="ปกคอร์ส" subtitle="แนะนำอัตราส่วน 16:9">
          <div className="flex items-center gap-4">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="ตัวอย่างปกคอร์ส" className="h-20 w-32 rounded-lg border border-[#0F1B3D]/[0.08] object-cover" />
            ) : <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-dashed border-[#0F1B3D]/20 bg-[#F7F8FA] text-[11px] text-[#0F1B3D]/30">ไม่มีรูป</div>}
            <label className="cursor-pointer rounded-lg bg-[#0F1B3D]/[0.06] px-4 py-2 text-[13px] font-semibold text-[#0F1B3D]/70 hover:bg-[#0F1B3D]/10">เลือกรูปภาพ<input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" /></label>
          </div>
        </SectionCard>

        <button type="submit" disabled={saving} className="w-full rounded-full bg-[#0F1B3D] py-4 text-[15px] font-bold text-white transition-colors hover:bg-[#182852] disabled:opacity-60">
          {saving ? savingStep ?? "กำลังบันทึก..." : "สร้างคอร์ส แล้วไปจัดการเนื้อหา →"}
        </button>
      </form>
    </div>
  );
}
