import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminUsersTable, type AdminUserRow } from "./admin-users-table";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, plan, usage_reply, usage_post, usage_reset_at, created_at")
    .order("created_at", { ascending: false });

  const { data: stores } = await admin
    .from("stores")
    .select("owner_id, name");

  const storeNameByOwner = new Map<string, string>(
    (stores ?? []).map((s) => [
      s.owner_id as string,
      ((s.name as string | null) ?? "").trim(),
    ]),
  );

  const rows: AdminUserRow[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    email: (p.email as string | null) ?? "(ไม่มีอีเมล)",
    plan: (p.plan as string) ?? "free",
    usageReply: (p.usage_reply as number) ?? 0,
    usagePost: (p.usage_post as number) ?? 0,
    usageResetAt: (p.usage_reset_at as string) ?? "",
    createdAt: (p.created_at as string) ?? "",
    storeName: storeNameByOwner.get(p.id as string) || "(ยังไม่ตั้งชื่อ)",
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          เห็นเฉพาะ admin — ใส่อีเมลใน <code>ADMIN_EMAILS</code>
        </p>
        <h1 className="font-heading text-2xl font-semibold">
          จัดการผู้ใช้ ({rows.length})
        </h1>
        <p className="text-sm text-muted-foreground">
          เปลี่ยนแพ็กเกจหรือรีเซ็ต usage หลังลูกค้าโอนเงิน
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ผู้ใช้ทั้งหมด</CardTitle>
          <CardDescription>
            เรียงจากใหม่ไปเก่า — กดเปลี่ยนแพ็กเกจหรือรีเซ็ตเลยใน table
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <AdminUsersTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
