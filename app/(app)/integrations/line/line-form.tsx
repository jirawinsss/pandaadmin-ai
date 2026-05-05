"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { INTENTS, type Intent } from "@/app/(app)/reply/types";

import { saveLineIntegrationAction } from "./actions";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

// Per-intent safety annotation. "recommend" = pre-checked by default,
// "consider" = pickable but flagged, "risky" = pickable but warns.
const INTENT_SAFETY: Record<Intent, "recommend" | "consider" | "risky"> = {
  ถามราคา: "recommend",
  ขอวิธีใช้: "recommend",
  เปรียบเทียบ: "recommend",
  พร้อมซื้อ: "consider",
  ขอโปร: "risky",
  ลังเล: "risky",
  กังวลความน่าเชื่อถือ: "risky",
  อื่นๆ: "risky",
};

const SAFETY_LABEL: Record<"recommend" | "consider" | "risky", string> = {
  recommend: "แนะนำ",
  consider: "พิจารณา",
  risky: "ระวัง",
};

const SAFETY_BADGE: Record<"recommend" | "consider" | "risky", string> = {
  recommend: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  consider: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  risky: "bg-destructive/10 text-destructive",
};

type Initial = {
  tokenMasked: string;
  secretMasked: string;
  isEnabled: boolean;
  mode: string;
  intents: string[];
  intentCounts: Record<string, number>;
  hasExisting: boolean;
};

export function LineIntegrationForm({ initial }: { initial: Initial }) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState(initial.mode);
  const [intents, setIntents] = useState<Set<string>>(
    () => new Set(initial.intents),
  );

  function toggleIntent(intent: string) {
    setIntents((prev) => {
      const next = new Set(prev);
      if (next.has(intent)) next.delete(intent);
      else next.add(intent);
      return next;
    });
  }

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveLineIntegrationAction(formData);
      if (result.ok) {
        toast.success("บันทึกการตั้งค่า LINE แล้ว");
      } else {
        toast.error(result.error);
      }
    });
  }

  const showAutoSafePanel = mode === "auto_safe";

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-6"
      autoComplete="off"
    >
      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>
            ค่าที่บันทึกแล้วจะแสดงเป็น mask เพื่อความปลอดภัย —
            ปล่อยช่องว่างถ้าไม่ต้องการเปลี่ยน
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="channel_access_token">Channel Access Token</Label>
            <Input
              id="channel_access_token"
              name="channel_access_token"
              type="password"
              placeholder={
                initial.hasExisting
                  ? `(ปัจจุบัน: ${initial.tokenMasked}) — เว้นว่างถ้าไม่เปลี่ยน`
                  : "วาง Channel Access Token ที่ Issue จาก LINE Developers"
              }
              autoComplete="new-password"
              disabled={pending}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="channel_secret">Channel Secret</Label>
            <Input
              id="channel_secret"
              name="channel_secret"
              type="password"
              placeholder={
                initial.hasExisting
                  ? `(ปัจจุบัน: ${initial.secretMasked}) — เว้นว่างถ้าไม่เปลี่ยน`
                  : "วาง Channel Secret จาก Basic settings"
              }
              autoComplete="new-password"
              disabled={pending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>การทำงาน</CardTitle>
          <CardDescription>
            เปิด/ปิด integration และเลือกโหมด
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="is_enabled"
              defaultChecked={initial.isEnabled}
              disabled={pending}
              className="size-4 accent-primary"
            />
            <span>
              เปิดใช้งาน LINE integration —
              <span className="ml-1 text-muted-foreground">
                webhook จะรับ event และสร้าง draft ใน Inbox
              </span>
            </span>
          </label>

          <div className="grid gap-2">
            <Label htmlFor="auto_reply_mode">โหมดการตอบ</Label>
            <select
              id="auto_reply_mode"
              name="auto_reply_mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              disabled={pending}
              className={selectClass}
            >
              <option value="draft">
                Draft — AI ร่างให้ใน Inbox (คุณกดส่งเอง) ✅ ปลอดภัยที่สุด
              </option>
              <option value="auto_safe">
                Auto-safe — AI ส่งอัตโนมัติเฉพาะ intent ที่คุณเลือก
              </option>
              <option value="off">Off — ปิดการสร้าง draft</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {showAutoSafePanel && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-1 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex flex-col gap-1">
                <CardTitle>Auto-safe — ตั้งค่าด้วยความระมัดระวัง</CardTitle>
                <CardDescription>
                  ในโหมดนี้ AI จะตอบลูกค้าให้เองโดยไม่รอคุณ
                  เลือกเฉพาะประเภทคำถามที่คุณไว้ใจให้ AI ตอบแทนได้
                  <br />
                  ข้อความที่ AI ประเมินว่ามีความเสี่ยง (เคลม, คืนเงิน, ผิดปกติ)
                  จะตกไปยัง Inbox ให้คุณตรวจสอบเสมอ
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                ประเภทข้อความที่อนุญาตให้ AI ตอบเอง
              </p>
              <p className="text-xs text-muted-foreground">
                ถ้าไม่เลือกเลย จะไม่มี auto-reply เกิดขึ้น —
                ตัวเลขข้างชื่อ = จำนวนข้อความใน 30 วันที่ผ่านมา
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {INTENTS.map((intent) => {
                  const safety = INTENT_SAFETY[intent];
                  const checked = intents.has(intent);
                  const count = initial.intentCounts[intent] ?? 0;
                  return (
                    <label
                      key={intent}
                      className="flex items-center gap-2 rounded-lg border bg-background p-2.5 text-sm has-[input:checked]:border-primary has-[input:checked]:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        name="auto_reply_intents"
                        value={intent}
                        checked={checked}
                        onChange={() => toggleIntent(intent)}
                        disabled={pending}
                        className="size-4 accent-primary"
                      />
                      <span className="flex-1">{intent}</span>
                      {count > 0 && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                          {count}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${SAFETY_BADGE[safety]}`}
                      >
                        {SAFETY_LABEL[safety]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </Button>
      </div>
    </form>
  );
}
