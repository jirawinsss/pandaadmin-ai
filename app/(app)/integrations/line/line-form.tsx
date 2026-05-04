"use client";

import { useTransition } from "react";
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

import { saveLineIntegrationAction } from "./actions";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

type Initial = {
  tokenMasked: string;
  secretMasked: string;
  isEnabled: boolean;
  mode: string;
  hasExisting: boolean;
};

export function LineIntegrationForm({ initial }: { initial: Initial }) {
  const [pending, startTransition] = useTransition();

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
              defaultValue={initial.mode}
              disabled={pending}
              className={selectClass}
            >
              <option value="draft">
                Draft — AI ร่างให้ใน Inbox (คุณกดส่งเอง) ✅ แนะนำ
              </option>
              <option value="auto_safe" disabled>
                Auto-safe — ส่งอัตโนมัติเฉพาะคำถามปลอดภัย (เร็วๆ นี้)
              </option>
              <option value="off">Off — ปิดการสร้าง draft</option>
            </select>
            <p className="text-xs text-muted-foreground">
              v1 รองรับเฉพาะ draft mode เพื่อความปลอดภัย — auto-send จะมาในเวอร์ชันถัดไป
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </Button>
      </div>
    </form>
  );
}
