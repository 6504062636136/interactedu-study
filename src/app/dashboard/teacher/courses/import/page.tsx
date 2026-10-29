/**
 * หน้าที่ของไฟล์: นำเข้าข้อมูลคอร์สและบทเรียนจาก Excel ผ่านขั้นอัปโหลด ตรวจตัวอย่าง และดูผล
 * เส้นทาง: /dashboard/teacher/courses/import
 * เป็น Client Component เพื่อรองรับสถานะและการโต้ตอบบนเบราว์เซอร์
 * useState เก็บค่าที่ทำให้หน้าจอแสดงผลใหม่เมื่อเปลี่ยน
 */
// app/dashboard/teacher/courses/import/page.tsx
"use client";

import { useState, type ReactElement } from "react";
import ExcelImportUpload from "@/components/teacher/ExcelImportUpload";
import ExcelImportPreview from "@/components/teacher/ExcelImportPreview";
import ExcelImportResult from "@/components/teacher/ExcelImportResult";
import type {
  ImportCourseMeta,
  ImportLessonRow,
  ImportLessonsResult,
} from "@/app/dashboard/teacher/courses/import/actions";

type Step = "upload" | "preview" | "result";

/** สลับคอมโพเนนต์ตามขั้นตอนนำเข้าและเก็บข้อมูลที่อ่านจากไฟล์ระหว่างขั้นตอน */
export default function ImportCoursePage(): ReactElement {
  // step: ขั้นตอนปัจจุบันของการนำเข้า ใช้เลือกว่าแสดงส่วนอัปโหลด ตรวจตัวอย่าง หรือผลลัพธ์; setStep ใช้อัปเดตค่านี้
  const [step, setStep] = useState<Step>("upload");
  // parsed: ข้อมูลคอร์สและแถวบทเรียนที่อ่านจาก Excel แล้ว เพื่อให้ตรวจสอบก่อนนำเข้า; setParsed ใช้อัปเดตค่านี้
  const [parsed, setParsed] = useState<{ course: ImportCourseMeta; rows: ImportLessonRow[] } | null>(null);
  // result: ผลลัพธ์จากการนำเข้า ใช้แสดงจำนวนและข้อผิดพลาดของรายการที่ประมวลผล; setResult ใช้อัปเดตค่านี้
  const [result, setResult] = useState<ImportLessonsResult | null>(null);

  return (
    <div className="p-8">
      <h1 className="mb-6 text-[20px] font-bold text-[#0F1B3D]">นำเข้าคอร์สจากไฟล์ Excel</h1>

      {step === "upload" && (
        <ExcelImportUpload
          onParsed={(data) => {
            setParsed(data);
            setStep("preview");
          }}
        />
      )}

      {step === "preview" && parsed && (
        <ExcelImportPreview
          course={parsed.course}
          rows={parsed.rows}
          onCancel={() => {
            setParsed(null);
            setStep("upload");
          }}
          onImported={(res) => {
            setResult(res);
            setStep("result");
          }}
        />
      )}

      {step === "result" && result && (
        <ExcelImportResult
          result={result}
          onImportAnother={() => {
            setParsed(null);
            setResult(null);
            setStep("upload");
          }}
        />
      )}
    </div>
  );
}