"use client";

import { useState, useTransition } from "react";
import { Copy, Sparkles } from "lucide-react";
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
import { generateReplyAction } from "./actions";

export function ReplyForm({ initialRemaining }: { initialRemaining: number }) {
  const [customerMsg, setCustomerMsg] = useState("");
  const [reply, setReply] = useState("");
  const [remaining, setRemaining] = useState(initialRemaining);
  const [pending, startTransition] = useTransition();

  function onGenerate() {
    if (!customerMsg.trim()) {
      toast.error("กรุณาพิมพ์ข้อความลูกค้า");
      return;
    }
    startTransition(async () => {
      const result = await generateReplyAction(customerMsg);
      if (result.ok) {
        setReply(result.reply);
        setRemaining(result.usageRemaining);
        toast.success("AI ตอบแล้ว — แก้ไขข้อความก่อนส่งให้ลูกค้าได้");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function onCopy() {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      toast.success("คัดลอกแล้ว");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ — กดเลือกข้อความและ copy เอง");
    }
  }

  function onClear() {
    setCustomerMsg("");
    setReply("");
  }

  const outOfQuota = remaining <= 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>ข้อความจากลูกค้า</CardTitle>
          <CardDescription>
            วางข้อความที่ลูกค้าส่งมาในแชต Facebook / LINE / Shopee แล้วกดสร้างคำตอบ
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Label htmlFor="customer-msg" className="sr-only">
            ข้อความจากลูกค้า
          </Label>
          <Textarea
            id="customer-msg"
            rows={5}
            value={customerMsg}
            disabled={pending}
            placeholder="เช่น: สวัสดีค่ะ สนใจ Cleansing oil ค่ะ ส่งฟรีไหมคะ?"
            onChange={(e) => setCustomerMsg(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={onGenerate}
              disabled={pending || outOfQuota || !customerMsg.trim()}
            >
              <Sparkles />
              {pending ? "กำลังคิด..." : "สร้างคำตอบ"}
            </Button>
            {(customerMsg || reply) && (
              <Button
                type="button"
                variant="ghost"
                onClick={onClear}
                disabled={pending}
              >
                เคลียร์
              </Button>
            )}
            {outOfQuota && (
              <p className="text-sm text-destructive">
                ใช้งานครบโควต้าเดือนนี้แล้ว
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {reply && (
        <Card>
          <CardHeader>
            <CardTitle>คำตอบของ AI</CardTitle>
            <CardDescription>
              แก้ไขได้ก่อนคัดลอกไปวางในแชตจริง
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              rows={6}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                เหลืออีก {remaining} ครั้งเดือนนี้
              </p>
              <Button type="button" variant="outline" onClick={onCopy}>
                <Copy />
                คัดลอก
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
