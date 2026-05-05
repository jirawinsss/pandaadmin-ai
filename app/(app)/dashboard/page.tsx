import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, Inbox as InboxIcon, MessageSquare, Send } from "lucide-react";

import { getCurrentContext } from "@/lib/store";
import { createClient } from "@/lib/supabase/server";
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

  // Inbox stats — last 7 days for trend, plus the pending count which spans
  // any age (a 2-week-old un-replied draft still matters)
  const supabase = await createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    { data: recentMsgs },
    { count: pendingCountRaw },
    { data: integration },
  ] = await Promise.all([
    supabase
      .from("inbox_messages")
      .select("status, auto_sent, created_at")
      .eq("store_id", store.id)
      .gte("created_at", sevenDaysAgo.toISOString()),
    supabase
      .from("inbox_messages")
      .select("*", { count: "exact", head: true })
      .eq("store_id", store.id)
      .in("status", ["draft", "needs_human"]),
    supabase
      .from("line_integrations")
      .select("is_enabled, auto_reply_mode")
      .eq("store_id", store.id)
      .maybeSingle(),
  ]);

  const recent = recentMsgs ?? [];
  const todayMsgs = recent.filter(
    (m) => new Date(m.created_at as string) >= todayStart,
  );
  const todayCount = todayMsgs.length;
  const todayAutoSent = todayMsgs.filter((m) => m.auto_sent).length;
  const weekCount = recent.length;
  const pending = pendingCountRaw ?? 0;

  const lineConnected = Boolean(integration?.is_enabled);
  const inAutoSafe = integration?.auto_reply_mode === "auto_safe";

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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>Inbox</CardTitle>
              <CardDescription>
                {lineConnected
                  ? inAutoSafe
                    ? "AI ตอบลูกค้าให้เองในโหมด auto-safe"
                    : "AI ร่างคำตอบให้ — คุณกดคัดลอกแล้วส่งเอง"
                  : "เชื่อมต่อ LINE OA เพื่อให้ AI ดูแลข้อความให้"}
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={lineConnected ? "/inbox" : "/integrations/line"}>
                {lineConnected ? "ดู Inbox →" : "เชื่อมต่อ LINE →"}
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat
              icon={<MessageSquare className="size-4" />}
              label="ข้อความวันนี้"
              value={todayCount}
            />
            <Stat
              icon={<Bot className="size-4" />}
              label="AI ตอบให้วันนี้"
              value={todayAutoSent}
              tone="primary"
            />
            <Stat
              icon={<InboxIcon className="size-4" />}
              label="รอตอบ"
              value={pending}
              tone={pending > 0 ? "warning" : "default"}
            />
            <Stat
              icon={<Send className="size-4" />}
              label="7 วันรวม"
              value={weekCount}
              tone="muted"
            />
          </div>
        </CardContent>
      </Card>

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

function Stat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "default" | "primary" | "warning" | "muted";
}) {
  const valueClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "muted"
          ? "text-muted-foreground"
          : "";
  const iconClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "warning"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex size-6 items-center justify-center rounded ${iconClass}`}
        >
          {icon}
        </span>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-2 font-heading text-2xl font-semibold ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
