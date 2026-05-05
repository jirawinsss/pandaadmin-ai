import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/store";
import { maskSecret } from "@/lib/line";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LineIntegrationForm } from "./line-form";

export default async function LineIntegrationPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  // Build the absolute webhook URL — use header host so it works in dev too
  // (Next 16 cookies/headers are async)
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("line_integrations")
    .select(
      "channel_access_token, channel_secret, is_enabled, auto_reply_mode, auto_reply_intents, updated_at",
    )
    .eq("store_id", ctx.store.id)
    .maybeSingle();

  const initial = {
    tokenMasked: maskSecret(existing?.channel_access_token as string | null),
    secretMasked: maskSecret(existing?.channel_secret as string | null),
    isEnabled: Boolean(existing?.is_enabled),
    mode: (existing?.auto_reply_mode as string | null) ?? "draft",
    intents: ((existing?.auto_reply_intents as string[] | null) ?? []),
    hasExisting: Boolean(existing),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">เชื่อมต่อช่องทางลูกค้า</p>
        <h1 className="font-heading text-2xl font-semibold">LINE OA</h1>
        <p className="text-sm text-muted-foreground">
          ลูกค้าทักผ่าน LINE OA → AI ร่างคำตอบให้ใน Inbox —
          เลือกได้ว่าจะให้ AI ตอบเองอัตโนมัติหรือคัดลอกส่งเอง
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>วิธีเชื่อมต่อ</CardTitle>
          <CardDescription>ทำตามขั้นตอน 4 ข้อ</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="ml-5 list-decimal flex-col gap-2 text-sm">
            <li>
              ไปที่{" "}
              <a
                href="https://developers.line.biz/console/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                LINE Developers Console
              </a>{" "}
              → เลือก/สร้าง <strong>Provider</strong> → สร้าง{" "}
              <strong>Messaging API channel</strong>
            </li>
            <li>
              ในแท็บ <strong>Messaging API</strong>:
              <ul className="ml-5 mt-1 list-disc space-y-1 text-muted-foreground">
                <li>
                  ตั้ง <strong>Webhook URL</strong> เป็น URL ด้านล่าง → กด{" "}
                  <em>Verify</em> ต้องขึ้น Success
                </li>
                <li>เปิด <strong>Use webhook</strong></li>
                <li>
                  ปิด <strong>Auto-reply messages</strong> และ{" "}
                  <strong>Greeting messages</strong> ที่ LINE Official Account Manager
                  (เพื่อไม่ให้ตอบซ้ำกับ AI)
                </li>
                <li>
                  กด <strong>Issue</strong> สำหรับ <strong>Channel access token (long-lived)</strong>{" "}
                  → copy
                </li>
              </ul>
            </li>
            <li>
              ในแท็บ <strong>Basic settings</strong> → copy <strong>Channel secret</strong>
            </li>
            <li>
              นำค่าทั้ง 2 มาวางในฟอร์มข้างล่าง → กด <strong>บันทึก</strong> →
              เปิด toggle และ mode = <strong>draft</strong>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
          <CardDescription>
            paste ลงในช่อง Webhook URL ที่ LINE Developers Console
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookUrl />
        </CardContent>
      </Card>

      <LineIntegrationForm initial={initial} />
    </div>
  );
}

import { headers } from "next/headers";
import { CopyButton } from "./copy-button";

async function WebhookUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "maekhaai.com";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/api/webhooks/line`;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="flex-1 break-all rounded-md border bg-muted px-3 py-2 text-sm">
        {url}
      </code>
      <CopyButton text={url} />
    </div>
  );
}
