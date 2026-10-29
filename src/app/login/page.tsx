/**
 * หน้าที่ของไฟล์: ฟอร์มเข้าสู่ระบบ ตรวจข้อมูลก่อนส่ง และนำผู้ใช้ไปหน้าตามบทบาท
 * เส้นทาง: /login
 * เป็น Client Component เพื่อรองรับสถานะและการโต้ตอบบนเบราว์เซอร์
 * useState เก็บค่าที่ทำให้หน้าจอแสดงผลใหม่เมื่อเปลี่ยน ส่วน useRef เก็บค่าอ้างอิงที่ไม่สั่งแสดงผลใหม่
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useSyncExternalStore, type FormEvent, type ChangeEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import AppBrand from "@/components/AppBrand";

interface LoginFieldErrors {
  email?: string;
  password?: string;
}

// EMAIL_PATTERN: รูปแบบตรวจอีเมลเบื้องต้นก่อนส่งข้อมูลไปยังระบบยืนยันตัวตน
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// OFFLINE_MESSAGE: ข้อความที่ใช้แจ้งเมื่ออุปกรณ์ไม่มีการเชื่อมต่ออินเทอร์เน็ต
const OFFLINE_MESSAGE = "ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบสัญญาณ Wi-Fi หรือเน็ตมือถือ แล้วลองใหม่อีกครั้ง";
// SYSTEM_ERROR_MESSAGE: ข้อความกลางเมื่อระบบไม่สามารถทำรายการได้ในขณะนี้
const SYSTEM_ERROR_MESSAGE = "ระบบขัดข้องชั่วคราว ไม่สามารถเข้าสู่ระบบได้ในขณะนี้ กรุณาลองใหม่อีกครั้งในภายหลัง";
// ใช้ข้อความกลางเดียวกันทั้งกรณีอีเมลไม่มีในระบบ และรหัสผ่านผิด — ไม่ระบุเจาะจงว่าจุดไหนผิด
// เพื่อความปลอดภัย (ป้องกันการเดาว่าอีเมลไหนมีอยู่ในระบบจริง)
const INVALID_CREDENTIALS_MESSAGE = "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";
// RATE_LIMIT_MESSAGE: ข้อความเมื่อพยายามเข้าสู่ระบบถี่เกินกว่าระบบอนุญาต
const RATE_LIMIT_MESSAGE = "คุณลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง";

/** ติดตามเหตุการณ์ออนไลน์และออฟไลน์ เรียก onChange เมื่อสถานะเปลี่ยน และคืนฟังก์ชันถอดตัวฟัง */
function subscribeConnection(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** จัดการฟอร์มเข้าสู่ระบบ การแจ้งข้อผิดพลาด และการตรวจสถานะบัญชีหลังยืนยันตัวตน */
export default function LoginPage() {
  // router: ตัวควบคุมการเปลี่ยนหน้าและรีเฟรชข้อมูลผ่าน Next.js บนเบราว์เซอร์
  const router = useRouter();
  // email: อีเมลบัญชีที่ใช้แสดงหรือกรอกเพื่อยืนยันตัวตน; setEmail ใช้อัปเดตค่านี้
  const [email, setEmail] = useState<string>("");
  // password: รหัสผ่านที่ผู้ใช้กรอกในฟอร์มยืนยันตัวตน; setPassword ใช้อัปเดตค่านี้
  const [password, setPassword] = useState<string>("");
  // fieldErrors: ข้อความตรวจสอบข้อมูลแยกตามชื่อช่อง เพื่อแสดงข้อผิดพลาดใกล้ช่องกรอก; setFieldErrors ใช้อัปเดตค่านี้
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  // formError: ข้อความผิดพลาดระดับฟอร์มที่แสดงเมื่อส่งข้อมูลไม่สำเร็จ; setFormError ใช้อัปเดตค่านี้
  const [formError, setFormError] = useState<string | null>(null);
  // isSubmitting: สถานะกำลังส่งฟอร์ม ใช้แสดงความคืบหน้าและควบคุมปุ่มส่ง; setIsSubmitting ใช้อัปเดตค่านี้
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // isOffline: สถานะที่เบราว์เซอร์รายงานว่าไม่มีการเชื่อมต่ออินเทอร์เน็ต
  const isOffline = useSyncExternalStore(subscribeConnection, () => !navigator.onLine, () => false);

  // supabase: ไคลเอนต์ Supabase ของบริบทนี้ ใช้อ่านเซสชันและรับส่งข้อมูลกับฐานข้อมูล
  const supabase = createClient();
  // emailRef: อ้างถึงช่องอีเมลเพื่อย้ายโฟกัสเมื่อกรอกข้อมูลไม่ถูกต้อง
  const emailRef = useRef<HTMLInputElement>(null);
  // passwordRef: อ้างถึงช่องรหัสผ่านเพื่อย้ายโฟกัสเมื่อกรอกข้อมูลไม่ถูกต้อง
  const passwordRef = useRef<HTMLInputElement>(null);
  // ref แบบ synchronous กันดับเบิลคลิก/กดรัวๆ ยิง request login ซ้ำ (state update เป็น async)
  const isSubmittingRef = useRef<boolean>(false);

  /** อัปเดตอีเมลที่กรอกและล้างข้อความผิดพลาดของช่องอีเมล */
  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setEmail(e.target.value);
    setFieldErrors((prev) => (prev.email ? { ...prev, email: undefined } : prev));
  };

  /** อัปเดตรหัสผ่านที่กรอกและล้างข้อความผิดพลาดของช่องรหัสผ่าน */
  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
    setFieldErrors((prev) => (prev.password ? { ...prev, password: undefined } : prev));
  };

  /** ตรวจอีเมลและรหัสผ่านในฟอร์ม แล้วคืนข้อความผิดพลาดแยกตามช่อง */
  const validate = (): LoginFieldErrors => {
    // errors: ข้อผิดพลาดแยกตามชื่อช่อง ซึ่งต้องแก้ให้ครบก่อนส่งฟอร์ม
    const errors: LoginFieldErrors = {};
    // trimmedEmail: อีเมลที่ตัดช่องว่างหัวท้ายก่อนตรวจรูปแบบหรือส่งข้อมูล
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = "กรุณากรอกอีเมล";
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.email = "รูปแบบอีเมลไม่ถูกต้อง (ตัวอย่าง: name@example.com)";
    }
    if (!password) {
      errors.password = "กรุณากรอกรหัสผ่าน";
    }
    return errors;
  };

  /** แปลงข้อผิดพลาดที่รับมาเป็นข้อความภาษาไทยตามสาเหตุ เช่น เน็ตขาดหรือระบบไม่พร้อม */
  // แปล error จาก Supabase/เครือข่ายให้เป็นภาษาที่เข้าใจง่าย ไม่ใช้ศัพท์เทคนิค
  const toFriendlyMessage = (err: unknown): string => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return OFFLINE_MESSAGE;
    }

    const raw =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : String(err);
    // message: ข้อความผิดพลาดดิบที่แปลงเป็นตัวพิมพ์เล็ก เพื่อเทียบรูปแบบก่อนเลือกข้อความแจ้งผู้ใช้
    const message = raw.toLowerCase();

    if (message.includes("invalid login credentials") || message.includes("invalid email or password")) {
      return INVALID_CREDENTIALS_MESSAGE;
    }
    if (message.includes("rate limit") || message.includes("too many")) {
      return RATE_LIMIT_MESSAGE;
    }
    // เน็ตหลุดจริงๆ แต่ navigator.onLine ยังไม่ทันเปลี่ยนเป็น false (บาง browser/dev-tool)
    if (message.includes("failed to fetch") || message.includes("network error") || message.includes("networkerror")) {
      return OFFLINE_MESSAGE;
    }
    if (message.includes("timeout") || message.includes("timed out")) {
      return SYSTEM_ERROR_MESSAGE;
    }

    return SYSTEM_ERROR_MESSAGE;
  };

  /** ป้องกันการส่งซ้ำ เข้าสู่ระบบด้วย Supabase และตรวจโปรไฟล์เพื่อเลือกปลายทาง */
  // ศึกษา 3.2.2.2: /login ส่ง email/password จาก Browser → signInWithPassword ของ Supabase Auth
  // ฟังก์ชันเรา รับ event คืน Promise<void>; Auth สำเร็จยังต้องอ่าน role/สถานะบัญชีก่อนเลือก Dashboard
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    // กันดับเบิลคลิก/กดรัวๆ ยิง request ซ้ำ — เช็ค ref แบบ synchronous ก่อนแม้แต่จะ setState
    if (isSubmittingRef.current) return;

    setFormError(null);

    // เช็คเน็ตก่อนเลย ไม่ต้องรอ fetch ไปแล้วค่อยพังกลางทาง
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setFormError(OFFLINE_MESSAGE);
      return;
    }

    // errors: ข้อผิดพลาดแยกตามชื่อช่อง ซึ่งต้องแก้ให้ครบก่อนส่งฟอร์ม
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.email) {
        emailRef.current?.focus();
      } else if (errors.password) {
        passwordRef.current?.focus();
      }
      return;
    }

    setFieldErrors({});
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        console.error("Login failed:", loginError);
        setFormError(toFriendlyMessage(loginError));
        return;
      }

      if (data.user) {
        // user.id มาจาก Auth; ใช้ค้น profiles.id เพื่ออ่าน role/is_active; let เพราะ fallback อาจเปลี่ยนค่าภายหลัง
        let { data: profile, error: profileError } = await supabase
          // from เลือกตาราง, select เลือกคอลัมน์, eq กรองค่าเท่ากัน และ single ต้องได้หนึ่งแถว; เป็น method จาก Supabase SDK
          .from("profiles")
          .select("role, is_active")
          .eq("id", data.user.id)
          .single();

        if (profileError?.code === "42703") {
          const fallback = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
          profile = fallback.data as typeof profile;
          profileError = fallback.error;
        }
        if (profileError) {
          await supabase.auth.signOut({ scope: "local" });
          setFormError("ตรวจสอบสถานะบัญชีไม่สำเร็จ กรุณาลองใหม่");
          return;
        }
        // ?. อ่านเมื่อ profile มีค่า; === เทียบค่าและชนิด: false จึง signOut ล้าง session ในเครื่อง แล้ว replace ไปหน้าบัญชีปิด
        if (profile?.is_active === false) {
          // archiveState: ผลอ่านข้อมูลโปรไฟล์ผู้ใช้
          const { data: archiveState } = await supabase.from("profiles").select("archived_at").eq("id", data.user.id).maybeSingle();
          await supabase.auth.signOut({ scope: "local" });
          router.replace(archiveState?.archived_at ? "/account-inactive?reason=archived" : "/account-inactive");
          return;
        }

        // router ของ Next.js: refresh โหลดข้อมูล Server ใหม่; push ด้านล่างเพิ่มหน้า Dashboard ในประวัติ ส่วน replace แทนหน้าปัจจุบัน
        router.refresh();

        if (profile?.role === "admin") {
          router.push("/dashboard/admin");
        } else if (profile?.role === "teacher") {
          router.push("/dashboard/teacher");
        } else {
          router.push("/dashboard/student");
        }
      }
    } catch (catchError) {
      console.error("Login failed:", catchError);
      setFormError(toFriendlyMessage(catchError));
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-canvas relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-12">
      {isOffline && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-red-600 px-4 py-2.5 text-center text-[13px] font-semibold text-white shadow-lg"
        >
          คุณกำลังออฟไลน์ ข้อมูลอาจไม่ถูกบันทึก
        </div>
      )}
      {/* Ambient background blobs, same language as landing hero */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#FF5A3C]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#7C5CFF]/10 blur-3xl" />

      <div className="relative w-full max-w-[440px]">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <AppBrand />
        </div>

        <div className="rounded-[30px] border border-white/80 bg-white/90 px-8 py-10 shadow-[0_32px_80px_-24px_rgba(15,27,61,0.24)] backdrop-blur-xl sm:px-10 sm:py-12">
          <div className="flex flex-col items-center text-center mb-8">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-[#0F1B3D] bg-[#FFCB47] px-3.5 py-1.5 rounded-full mb-5 rotate-[-1.5deg]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0F1B3D]" />
              ยินดีต้อนรับกลับมา
            </span>

            <h1 className="text-[26px] leading-tight font-extrabold text-[#0F1B3D] tracking-[-0.02em]">
              เข้าสู่ระบบ
            </h1>
            <p className="mt-2.5 text-[14px] text-[#0F1B3D]/50 leading-relaxed max-w-[280px] font-medium">
              เข้าถึงคอร์สเรียน ความคืบหน้า และใบรับรองของคุณ
            </p>
          </div>

          {/* แบนเนอร์สรุปภาพรวมด้านบน — ใช้สำหรับ error ที่ไม่ผูกกับช่องใดช่องหนึ่งโดยเฉพาะ
              (เช่น อีเมล/รหัสผ่านไม่ถูกต้อง, rate limit, ระบบขัดข้อง) ส่วน validation รายช่อง
              จะโชว์ใต้ input โดยตรงแทน */}
          {formError && (
            <div role="alert" className="mb-6 rounded-xl bg-[#FF5A3C]/[0.08] border border-[#FF5A3C]/20 px-4 py-3">
              <p className="text-[13px] font-semibold text-[#EB4A2D] leading-snug">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-[13px] font-bold text-[#0F1B3D]/70 mb-1.5">
                อีเมล <span className="text-red-500">*</span>
              </label>
              <input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@example.com"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                className={`modern-field px-4 py-3 text-[14px] placeholder:text-slate-300 ${
                  fieldErrors.email ? "!border-red-400 focus:!border-red-500 focus:!ring-red-200" : ""
                }`}
              />
              {fieldErrors.email && (
                <p id="email-error" className="mt-1.5 text-[12.5px] font-medium text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-[13px] font-bold text-[#0F1B3D]/70">
                  รหัสผ่าน <span className="text-red-500">*</span>
                </label>
              </div>
              <input
                ref={passwordRef}
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="••••••••"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
                className={`modern-field px-4 py-3 text-[14px] placeholder:text-slate-300 ${
                  fieldErrors.password ? "!border-red-400 focus:!border-red-500 focus:!ring-red-200" : ""
                }`}
              />
              {fieldErrors.password && (
                <p id="password-error" className="mt-1.5 text-[12.5px] font-medium text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#FF5A3C,#F04B2D)] px-4 py-3.5 text-[14px] font-bold text-white shadow-[0_14px_28px_-12px_rgba(255,90,60,0.65)] transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                "กำลังเข้าสู่ระบบ..."
              ) : (
                <>
                  เข้าสู่ระบบ
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12H19M19 12L13 6M19 12L13 18"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-[13.5px] text-[#0F1B3D]/50 font-medium">
            ยังไม่มีบัญชี?{" "}
            <Link href="/signup" className="font-bold text-[#0F1B3D] hover:text-[#FF5A3C] transition-colors">
              สมัครสมาชิก
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
