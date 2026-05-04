import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            แม่ค้า AI
          </h1>
          <p className="text-lg text-muted-foreground">
            ผู้ช่วยอัจฉริยะสำหรับแม่ค้าออนไลน์ —
            จำข้อมูลร้านคุณ ตอบแชตเก่ง ทำโพสต์ขายดี ในน้ำเสียงของคุณเอง
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/register">เริ่มใช้ฟรี</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">เข้าสู่ระบบ</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
