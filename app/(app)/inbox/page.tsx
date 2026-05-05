import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InboxList, type InboxRow } from "./inbox-list";

const STATUSES = [
  { value: "all", label: "ทั้งหมด" },
  { value: "draft", label: "Draft" },
  { value: "needs_human", label: "ต้องตรวจสอบ" },
  { value: "copied", label: "คัดลอกแล้ว" },
  { value: "sent", label: "ส่งแล้ว" },
  { value: "ignored", label: "ข้าม" },
] as const;

type StatusFilter = (typeof STATUSES)[number]["value"];

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const filter: StatusFilter = STATUSES.some((s) => s.value === sp.status)
    ? (sp.status as StatusFilter)
    : "all";

  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  const supabase = await createClient();

  // Check if any LINE integration exists
  const { data: integration } = await supabase
    .from("line_integrations")
    .select("is_enabled, auto_reply_mode")
    .eq("store_id", ctx.store.id)
    .maybeSingle();

  let query = supabase
    .from("inbox_messages")
    .select(
      "id, platform, customer_name, external_user_id, message_text, ai_draft, intent, risk_level, status, auto_sent, send_error, created_at",
    )
    .eq("store_id", ctx.store.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data: rowsRaw } = await query;
  const rows: InboxRow[] = (rowsRaw ?? []).map((r) => ({
    id: r.id as string,
    platform: (r.platform as string) ?? "line",
    customer_name: (r.customer_name as string | null) ?? null,
    external_user_id: (r.external_user_id as string | null) ?? null,
    message_text: (r.message_text as string) ?? "",
    ai_draft: (r.ai_draft as string | null) ?? "",
    intent: (r.intent as string | null) ?? null,
    risk_level: (r.risk_level as "low" | "medium" | "high") ?? "low",
    status: (r.status as string) ?? "draft",
    auto_sent: Boolean(r.auto_sent),
    send_error: (r.send_error as string | null) ?? null,
    created_at: (r.created_at as string) ?? "",
  }));

  // Count by status (one extra query — small + cheap)
  const { data: countsRaw } = await supabase
    .from("inbox_messages")
    .select("status")
    .eq("store_id", ctx.store.id);
  const counts = (countsRaw ?? []).reduce<Record<string, number>>((acc, r) => {
    const s = (r.status as string) ?? "draft";
    acc[s] = (acc[s] ?? 0) + 1;
    acc.all = (acc.all ?? 0) + 1;
    return acc;
  }, {});

  const setupNotConnected = !integration;
  const setupDisabled = integration && !integration.is_enabled;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">ข้อความเข้าจาก LINE OA</p>
        <h1 className="font-heading text-2xl font-semibold">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          AI ร่างคำตอบให้ทุกข้อความ — โหมด auto-safe จะส่งให้เองตาม intent ที่เลือก
          ส่วน draft ให้คัดลอกส่งเอง
        </p>
      </div>

      {(setupNotConnected || setupDisabled) && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle>
              {setupNotConnected
                ? "ยังไม่ได้เชื่อมต่อ LINE OA"
                : "LINE integration ปิดอยู่"}
            </CardTitle>
            <CardDescription>
              {setupNotConnected
                ? "ตั้งค่า credential ที่หน้าเชื่อมต่อ LINE ก่อน เพื่อให้ webhook ทำงาน"
                : "เปิด toggle 'เปิดใช้งาน' ที่หน้าเชื่อมต่อ LINE — ถ้ายัง webhook จะไม่สร้าง draft ใหม่"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/integrations/line">ไปตั้งค่า LINE</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Button
            key={s.value}
            asChild
            variant={filter === s.value ? "default" : "outline"}
            size="sm"
          >
            <Link href={s.value === "all" ? "/inbox" : `/inbox?status=${s.value}`}>
              {s.label}
              {counts[s.value] !== undefined && (
                <span className="ml-1 text-xs opacity-70">
                  ({counts[s.value] ?? 0})
                </span>
              )}
            </Link>
          </Button>
        ))}
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <Link href={filter === "all" ? "/inbox" : `/inbox?status=${filter}`}>
            ⟳ Refresh
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>ยังไม่มีข้อความ</CardTitle>
            <CardDescription>
              {filter === "all"
                ? "เมื่อมีลูกค้าทักผ่าน LINE OA จะแสดงที่นี่"
                : "ไม่มีข้อความสถานะนี้"}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <InboxList rows={rows} />
      )}
    </div>
  );
}
