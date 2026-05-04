"use client";

import { useState, useTransition } from "react";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PLAN_LIMITS } from "@/lib/plans";
import { updateUserPlanAction, resetUserUsageAction } from "./actions";

export type AdminUserRow = {
  id: string;
  email: string;
  plan: string;
  usageReply: number;
  usagePost: number;
  usageResetAt: string;
  createdAt: string;
  storeName: string;
};

const PLAN_OPTIONS = Object.keys(PLAN_LIMITS);

const selectClass =
  "h-7 w-full rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    year: "2-digit",
    month: "short",
    day: "2-digit",
  });
}

export function AdminUsersTable({ rows }: { rows: AdminUserRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">ยังไม่มีผู้ใช้</p>;
  }
  return (
    <table className="w-full min-w-[720px] text-sm">
      <thead className="border-b text-xs text-muted-foreground">
        <tr className="[&>th]:py-2 [&>th]:px-2 [&>th]:text-left [&>th]:font-medium">
          <th>ผู้ใช้</th>
          <th>ร้าน</th>
          <th>แพ็กเกจ</th>
          <th>Reply</th>
          <th>Post</th>
          <th>รีเซ็ตล่าสุด</th>
          <th></th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => (
          <UserRow key={row.id} row={row} />
        ))}
      </tbody>
    </table>
  );
}

function UserRow({ row }: { row: AdminUserRow }) {
  const [plan, setPlan] = useState(row.plan);
  const [pending, startTransition] = useTransition();
  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.free;

  function onPlanChange(newPlan: string) {
    const prev = plan;
    setPlan(newPlan);
    startTransition(async () => {
      const result = await updateUserPlanAction(row.id, newPlan);
      if (result.ok) {
        toast.success(`เปลี่ยนแพ็กเกจของ ${row.email} เป็น ${newPlan}`);
      } else {
        setPlan(prev);
        toast.error(result.error);
      }
    });
  }

  function onReset() {
    if (!confirm(`รีเซ็ต usage ของ ${row.email}?`)) return;
    startTransition(async () => {
      const result = await resetUserUsageAction(row.id);
      if (result.ok) {
        toast.success("รีเซ็ตแล้ว — refresh เพื่อดูค่าใหม่");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <tr className="[&>td]:py-2 [&>td]:px-2 [&>td]:align-middle">
      <td>
        <div className="flex flex-col">
          <span className="font-medium">{row.email}</span>
          <span className="text-xs text-muted-foreground">
            สมัคร {formatDate(row.createdAt)}
          </span>
        </div>
      </td>
      <td className="text-xs">{row.storeName}</td>
      <td>
        <select
          className={selectClass}
          value={plan}
          disabled={pending}
          onChange={(e) => onPlanChange(e.target.value)}
        >
          {PLAN_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td className="text-xs">
        {row.usageReply} / {limits.reply}
      </td>
      <td className="text-xs">
        {row.usagePost} / {limits.post}
      </td>
      <td className="text-xs text-muted-foreground">
        {formatDate(row.usageResetAt)}
      </td>
      <td>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onReset}
          disabled={pending}
          aria-label="รีเซ็ต usage"
        >
          <RotateCw />
        </Button>
      </td>
    </tr>
  );
}
