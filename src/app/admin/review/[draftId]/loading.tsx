/**
 * หน้าที่ของไฟล์: ส่วนแสดงสถานะระหว่าง Next.js กำลังโหลดข้อมูลของหน้าที่อยู่ในเส้นทางนี้
 * เส้นทาง: /admin/review/[draftId]
 * เป็น Server Component ที่ Next.js ประมวลผลฝั่งเซิร์ฟเวอร์
 */
/** แสดงข้อความกำลังโหลดระหว่างรอเนื้อหาของหน้า */
export default function Loading() {
  return (
    <div className="min-h-screen w-full bg-[#F7F8FA] py-12 px-6 lg:px-8 flex justify-center items-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-[#FF5A3C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[14px] font-medium text-[#0F1B3D]/60">กำลังโหลดข้อมูลบทเรียน...</p>
      </div>
    </div>
  );
}