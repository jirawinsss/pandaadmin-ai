"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text }: { text: string }) {
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("คัดลอกแล้ว");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ — กดเลือกข้อความและ copy เอง");
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={onCopy}>
      <Copy />
      คัดลอก
    </Button>
  );
}
