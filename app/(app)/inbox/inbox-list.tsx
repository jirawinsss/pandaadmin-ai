"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  EyeOff,
  Send,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { updateInboxMessageAction } from "./actions";

export type InboxRow = {
  id: string;
  platform: string;
  customer_name: string | null;
  external_user_id: string | null;
  message_text: string;
  ai_draft: string;
  intent: string | null;
  risk_level: "low" | "medium" | "high";
  status: string;
  created_at: string;
};

const RISK_BADGE: Record<InboxRow["risk_level"], string> = {
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  high: "bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  needs_human: "ต้องตรวจสอบ",
  copied: "คัดลอกแล้ว",
  sent: "ส่งแล้ว",
  ignored: "ข้าม",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  needs_human: "bg-destructive/10 text-destructive",
  copied: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  sent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  ignored: "bg-muted text-muted-foreground",
};

function formatTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export function InboxList({ rows }: { rows: InboxRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => (
        <InboxCard key={row.id} row={row} />
      ))}
    </div>
  );
}

function InboxCard({ row }: { row: InboxRow }) {
  const [draft, setDraft] = useState(row.ai_draft);
  const [status, setStatus] = useState(row.status);
  const [pending, startTransition] = useTransition();
  const isHandoff = status === "needs_human" || row.risk_level === "high";

  function update(patch: { status?: string; ai_draft?: string }) {
    startTransition(async () => {
      const result = await updateInboxMessageAction({ id: row.id, ...patch });
      if (result.ok) {
        if (patch.status) setStatus(patch.status);
      } else {
        toast.error(result.error);
      }
    });
  }

  async function onCopy() {
    if (!draft.trim()) {
      toast.error("draft ว่าง");
      return;
    }
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("คัดลอกแล้ว");
      // also bump status to copied if it's still draft
      if (status === "draft") update({ status: "copied" });
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  }

  function onMarkSent() {
    update({ status: "sent" });
    toast.success("บันทึกว่าส่งแล้ว");
  }

  function onIgnore() {
    update({ status: "ignored" });
    toast.success("ข้ามแล้ว");
  }

  function onSaveDraft() {
    update({ ai_draft: draft });
    toast.success("บันทึก draft แล้ว");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-muted px-2 py-0.5 font-medium uppercase">
            {row.platform}
          </span>
          {row.intent && (
            <span className="rounded-full bg-muted px-2 py-0.5">
              {row.intent}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${RISK_BADGE[row.risk_level]}`}
          >
            {row.risk_level !== "low" && <TriangleAlert className="size-3" />}
            risk: {row.risk_level}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLOR[status] ?? "bg-muted"}`}
          >
            {STATUS_LABEL[status] ?? status}
          </span>
          <span className="ml-auto text-muted-foreground">
            {formatTime(row.created_at)}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">
            ลูกค้า
            {row.external_user_id ? ` (${row.external_user_id.slice(0, 8)}…)` : ""}
          </p>
          <p className="whitespace-pre-wrap text-sm">{row.message_text}</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isHandoff && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">
                ควรให้แอดมินตรวจสอบก่อนตอบ
              </p>
              <p className="text-xs text-muted-foreground">
                ข้อความนี้อาจเซนซิทีฟ — อย่าใช้ draft ส่งทันที
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            AI draft (แก้ได้ก่อนคัดลอก)
          </p>
          <Textarea
            rows={4}
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onCopy} disabled={pending || !draft.trim()}>
            <Copy />
            คัดลอก
          </Button>
          {draft !== row.ai_draft && (
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={pending}
            >
              บันทึก draft
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onMarkSent}
            disabled={pending || status === "sent"}
          >
            <Send />
            ส่งแล้ว
          </Button>
          <Button
            variant="ghost"
            onClick={onIgnore}
            disabled={pending || status === "ignored"}
          >
            <EyeOff />
            ข้าม
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
