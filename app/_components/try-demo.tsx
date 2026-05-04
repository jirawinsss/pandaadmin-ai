"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tryDemoAction } from "@/app/_actions/demo";

const SAMPLES = [
  "สนใจ Cleansing Oil ค่ะ ส่งฟรีไหม?",
  "Snail Cream ใช้แล้วเห็นผลเร็วไหมคะ?",
  "วิตามินซีเซรั่ม สั่ง 2 ขวดได้ลดเท่าไหร่คะ?",
];

export function TryDemo({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [customerMsg, setCustomerMsg] = useState("");
  const [reply, setReply] = useState("");
  const [quotaReached, setQuotaReached] = useState(false);
  const [pending, startTransition] = useTransition();

  function onTry() {
    if (!customerMsg.trim()) {
      toast.error("พิมพ์ข้อความสมมุติว่าลูกค้าทักมา");
      return;
    }
    startTransition(async () => {
      const result = await tryDemoAction(customerMsg);
      if (result.ok) {
        setReply(result.reply);
        if (result.remaining === 0) setQuotaReached(true);
      } else {
        if (result.quotaReached) setQuotaReached(true);
        toast.error(result.error);
      }
    });
  }

  function pickSample(text: string) {
    setCustomerMsg(text);
    setReply("");
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
          <Sparkles className="size-3.5" />
          ทดลองใช้งานจริง — ร้านสมมุติ "Panda Skin"
        </div>
        <h3 className="font-heading text-xl font-semibold sm:text-2xl">
          ลองพิมพ์ข้อความที่ลูกค้าจะทักมา
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          AI จะตอบโดยใช้ข้อมูลร้านสมมุติ — ทดลองได้ 2 ครั้งฟรี
        </p>

        {/* Sample chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pickSample(s)}
              disabled={pending || quotaReached}
              className="rounded-full border bg-background px-3 py-1 text-xs transition-colors hover:bg-muted disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="mt-4 flex flex-col gap-3">
          <Textarea
            rows={3}
            value={customerMsg}
            disabled={pending || quotaReached}
            onChange={(e) => setCustomerMsg(e.target.value)}
            placeholder="ลูกค้าทักว่า..."
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={onTry}
              disabled={pending || quotaReached || !customerMsg.trim()}
            >
              <Sparkles />
              {pending ? "AI กำลังคิด..." : "สร้างคำตอบ"}
            </Button>
            {reply && !pending && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setReply("");
                  setCustomerMsg("");
                }}
              >
                <RotateCw />
                เคลียร์
              </Button>
            )}
          </div>
        </div>

        {/* Reply */}
        {reply && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl bg-muted/50 p-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="size-3" />
              AI ตอบให้ในน้ำเสียงร้าน Panda Skin
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {reply}
            </p>
          </div>
        )}

        {/* Quota CTA */}
        {quotaReached && (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-primary bg-primary/5 p-5 text-center">
            <p className="text-sm">
              ✨ <strong>ใช่ไหม? สมัครฟรีเพื่อใช้กับ <em>ข้อมูลร้านคุณเอง</em></strong>
              <br />
              <span className="text-muted-foreground">
                AI จะเก่งกว่านี้มากเพราะรู้สินค้า ราคา น้ำเสียงของคุณจริงๆ
              </span>
            </p>
            <Button asChild size="lg">
              <Link href={isLoggedIn ? "/dashboard" : "/register"}>
                {isLoggedIn ? "เข้า Dashboard" : "เริ่มใช้ฟรี"} <ArrowRight />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
