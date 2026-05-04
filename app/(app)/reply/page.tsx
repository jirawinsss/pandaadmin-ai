import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/store";
import { planLimits } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReplyForm } from "./reply-form";
import { ReplyHistory } from "./reply-history";

export default async function ReplyPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  const limits = planLimits(ctx.profile.plan);
  const remaining = Math.max(0, limits.reply - ctx.profile.usage_reply);
  const needsSetup = !ctx.store.name?.trim();

  const supabase = await createClient();
  const { data: history } = await supabase
    .from("reply_history")
    .select("id, customer_msg, ai_reply, created_at")
    .eq("store_id", ctx.store.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          เหลือ <span className="font-medium text-foreground">{remaining}</span>{" "}
          จาก {limits.reply} ครั้ง / เดือน
        </p>
        <h1 className="font-heading text-2xl font-semibold">ตอบแชต</h1>
        <p className="text-sm text-muted-foreground">
          วางข้อความที่ลูกค้าส่งมา → AI จะร่างคำตอบในน้ำเสียงร้านของคุณ
        </p>
      </div>

      {needsSetup ? (
        <Card>
          <CardHeader>
            <CardTitle>ตั้งค่าข้อมูลร้านก่อน</CardTitle>
            <CardDescription>
              AI ต้องการชื่อร้านและรายละเอียดเพื่อตอบลูกค้าได้ถูกต้อง
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/brain">ไปกรอกข้อมูลร้าน</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ReplyForm initialRemaining={remaining} />
      )}

      <ReplyHistory items={history ?? []} />
    </div>
  );
}
