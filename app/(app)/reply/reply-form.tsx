"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Copy,
  MessageSquare,
  RotateCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { generateBulkRepliesAction } from "./actions";
import {
  REPLY_GOALS,
  splitCustomerMessages,
  type BulkReplyItem,
  type Intent,
  type ReplyGoal,
  type RiskLevel,
} from "./types";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

const PLACEHOLDER = `วางข้อความลูกค้าได้หลายราย เช่น:

- สนใจมัทฉะตัวนี้ค่ะ ราคาเท่าไหร่
- มีส่งฟรีไหมคะ
- ตัวนี้เหมาะกับมือใหม่ไหม
- แพงจัง ลดได้ไหม
- ขอวิธีชงหน่อยค่ะ

หรือคั่นด้วยบรรทัดว่าง / เลข 1. 2. ก็ได้`;

export function ReplyForm({ initialRemaining }: { initialRemaining: number }) {
  const [rawInput, setRawInput] = useState("");
  const [goal, setGoal] = useState<ReplyGoal>("info");
  const [items, setItems] = useState<BulkReplyItem[]>([]);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [pending, startTransition] = useTransition();

  const previewCount = splitCustomerMessages(rawInput).length;

  function onGenerate() {
    if (!rawInput.trim()) {
      toast.error("กรุณาวางข้อความลูกค้า");
      return;
    }
    startTransition(async () => {
      const result = await generateBulkRepliesAction({
        rawInput,
        goal,
      });
      if (result.ok) {
        setItems(result.items);
        setRemaining(result.usageRemaining);
        toast.success(`AI ตอบให้ ${result.items.length} ราย — แก้และคัดลอกไปวางได้เลย`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function onClear() {
    setRawInput("");
    setItems([]);
  }

  const outOfQuota = remaining <= 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Input card */}
      <Card>
        <CardHeader>
          <CardTitle>วางข้อความลูกค้า</CardTitle>
          <CardDescription>
            วางได้ครั้งละหลายราย — ระบบจะแยกให้อัตโนมัติ ครั้งละไม่เกิน 10 ราย
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="goal">เป้าหมายการตอบ</Label>
            <select
              id="goal"
              className={selectClass}
              value={goal}
              disabled={pending}
              onChange={(e) => setGoal(e.target.value as ReplyGoal)}
            >
              {REPLY_GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="raw">ข้อความจากลูกค้า</Label>
            <Textarea
              id="raw"
              rows={8}
              value={rawInput}
              disabled={pending}
              placeholder={PLACEHOLDER}
              onChange={(e) => setRawInput(e.target.value)}
            />
            {previewCount > 0 && (
              <p className="text-xs text-muted-foreground">
                ตรวจพบ <span className="font-medium text-foreground">{previewCount}</span> ราย
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={onGenerate}
              disabled={pending || outOfQuota || !rawInput.trim()}
            >
              <Sparkles />
              {pending ? "AI กำลังคิด..." : "สร้างคำตอบ"}
            </Button>
            {(rawInput || items.length > 0) && (
              <Button
                type="button"
                variant="ghost"
                onClick={onClear}
                disabled={pending}
              >
                <RotateCw />
                เคลียร์
              </Button>
            )}
            {outOfQuota && (
              <p className="text-sm text-destructive">
                ใช้งานครบโควต้าเดือนนี้แล้ว
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            1 batch = นับ 1 ครั้งจากโควต้า ไม่ว่าจะกี่ลูกค้า · เหลือ {remaining} ครั้งเดือนนี้
          </p>
        </CardContent>
      </Card>

      {/* Result cards */}
      {items.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-xl font-semibold">
            คำตอบที่ AI ร่างให้ ({items.length} ราย)
          </h2>
          {items.map((item, i) => (
            <ReplyCard key={i} index={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReplyCard({ index, item }: { index: number; item: BulkReplyItem }) {
  const showHandoffWarning = item.should_handoff || item.risk_level === "high";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-heading text-sm font-medium">
            ลูกค้า #{index + 1}
          </span>
          <IntentBadge intent={item.intent} />
          <RiskBadge level={item.risk_level} />
        </div>
        <p className="mt-2 flex items-start gap-2 text-sm">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span className="whitespace-pre-wrap">{item.customer_message}</span>
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showHandoffWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">
                ควรให้แอดมินตรวจสอบก่อนตอบ
              </p>
              <p className="text-xs text-muted-foreground">
                เรื่องนี้อาจเซนซิทีฟ — อย่าใช้คำตอบ AI ส่งทันที
              </p>
            </div>
          </div>
        )}

        {item.sales_note && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              คำแนะนำสำหรับแม่ค้า
            </p>
            <p className="mt-1">{item.sales_note}</p>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-3">
          <ReplyVariant label="สั้น" body={item.short_reply} />
          <ReplyVariant label="สุภาพ" body={item.polite_reply} />
          <ReplyVariant label="ปิดการขาย" body={item.closing_reply} />
        </div>
      </CardContent>
    </Card>
  );
}

function ReplyVariant({ label, body }: { label: string; body: string }) {
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(body);
      toast.success(`คัดลอกคำตอบ "${label}" แล้ว`);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ — กดเลือกข้อความและ copy เอง");
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCopy}
          aria-label={`คัดลอกคำตอบ ${label}`}
        >
          <Copy />
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
    </div>
  );
}

const INTENT_COLORS: Record<Intent, string> = {
  ถามราคา: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  ขอโปร: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  ลังเล: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  พร้อมซื้อ: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  ขอวิธีใช้: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  เปรียบเทียบ: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  กังวลความน่าเชื่อถือ: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  อื่นๆ: "bg-muted text-muted-foreground",
};

function IntentBadge({ intent }: { intent: Intent }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${INTENT_COLORS[intent]}`}
    >
      {intent}
    </span>
  );
}

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "ความเสี่ยงต่ำ",
  medium: "ระวัง",
  high: "เสี่ยง",
};
const RISK_COLORS: Record<RiskLevel, string> = {
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  high: "bg-destructive/10 text-destructive",
};

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${RISK_COLORS[level]}`}
    >
      {level !== "low" && <TriangleAlert className="size-3" />}
      {RISK_LABEL[level]}
    </span>
  );
}

// Re-export so page.tsx can render the empty-store gate without changes
export function NoBrainGate() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ตั้งค่าข้อมูลร้านก่อน</CardTitle>
        <CardDescription>
          AI ต้องการชื่อร้านและรายละเอียดสินค้า/FAQ เพื่อตอบลูกค้าได้แม่นยำ
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link href="/brain">ไปกรอกข้อมูลร้าน</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
