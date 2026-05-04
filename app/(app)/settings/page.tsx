import { redirect } from "next/navigation";
import { getCurrentContext } from "@/lib/store";
import { planLabel, planLimits } from "@/lib/plans";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "./change-password-form";

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function nextResetEstimate(usageResetAt: string): string {
  const d = new Date(usageResetAt);
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return next.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function SettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  const limits = planLimits(ctx.profile.plan);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">ตั้งค่า</h1>
        <p className="text-sm text-muted-foreground">
          ข้อมูลบัญชีและเปลี่ยนรหัสผ่าน
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลบัญชี</CardTitle>
          <CardDescription>อ่านอย่างเดียว — ติดต่อผู้ดูแลถ้าจะเปลี่ยน</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">อีเมล</dt>
            <dd>{ctx.user.email}</dd>

            <dt className="text-muted-foreground">แพ็กเกจปัจจุบัน</dt>
            <dd>
              <span className="font-medium">{planLabel(ctx.profile.plan)}</span>
              <span className="ml-2 text-muted-foreground">
                (Reply {limits.reply}, Post {limits.post}, Products {limits.products} / เดือน)
              </span>
            </dd>

            <dt className="text-muted-foreground">ใช้ Reply ไป</dt>
            <dd>
              {ctx.profile.usage_reply} / {limits.reply}
            </dd>

            <dt className="text-muted-foreground">ใช้ Post ไป</dt>
            <dd>
              {ctx.profile.usage_post} / {limits.post}
            </dd>

            <dt className="text-muted-foreground">รีเซ็ตล่าสุด</dt>
            <dd>{formatDate(ctx.profile.usage_reset_at)}</dd>

            <dt className="text-muted-foreground">รีเซ็ตครั้งถัดไป</dt>
            <dd>
              {nextResetEstimate(ctx.profile.usage_reset_at)} (ประมาณ — รีเซ็ตอัตโนมัติเมื่อเข้าใช้ในเดือนใหม่)
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>เปลี่ยนรหัสผ่าน</CardTitle>
          <CardDescription>
            อย่างน้อย 8 ตัวอักษร — ใช้รหัสที่ไม่เหมือนของบริการอื่น
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
