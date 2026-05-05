import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/store";
import { planLimits, planLabel } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  const { profile, store } = ctx;
  const limits = planLimits(profile.plan);
  const replyLeft = Math.max(0, limits.reply - profile.usage_reply);
  const postLeft = Math.max(0, limits.post - profile.usage_post);

  const storeName = store.name?.trim() || "(ยังไม่ได้ตั้งชื่อร้าน)";
  const needsSetup = !store.name?.trim();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">ร้านของคุณ</p>
          <h1 className="font-heading text-2xl font-semibold">{storeName}</h1>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">แพ็กเกจ</p>
          <p className="font-heading text-lg font-medium">
            {planLabel(profile.plan)}
          </p>
        </div>
      </div>

      {needsSetup && (
        <Card>
          <CardHeader>
            <CardTitle>เริ่มต้นด้วยการกรอกข้อมูลร้าน</CardTitle>
            <CardDescription>
              AI จะเก่งมากเมื่อรู้จักร้านคุณดี — ใช้เวลา 5–10 นาทีก็พอ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/brain">กรอกข้อมูลร้าน</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ตอบแชต</CardTitle>
            <CardDescription>
              เหลือ <span className="font-medium text-foreground">{replyLeft}</span>{" "}
              จาก {limits.reply} ครั้ง / เดือน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/reply">เปิดโหมดขาย</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>สร้างโพสต์</CardTitle>
            <CardDescription>
              เหลือ <span className="font-medium text-foreground">{postLeft}</span>{" "}
              จาก {limits.post} ครั้ง / เดือน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/post">สร้างโพสต์</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลร้าน</CardTitle>
          <CardDescription>
            ข้อมูลพื้นฐาน, น้ำเสียง, นโยบาย, สินค้า, FAQ — ใช้สอน AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/brain">
              {needsSetup ? "เริ่มกรอกข้อมูล" : "แก้ไขข้อมูลร้าน"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
