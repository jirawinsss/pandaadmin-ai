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
import { POST_TYPES } from "@/lib/post-types";
import { generatePostAction } from "./actions";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

export function PostForm({
  products,
  initialRemaining,
}: {
  products: { id: string; name: string }[];
  initialRemaining: number;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [postType, setPostType] = useState<string>(POST_TYPES[0].value);
  const [note, setNote] = useState("");
  const [post, setPost] = useState("");
  const [remaining, setRemaining] = useState(initialRemaining);
  const [pending, startTransition] = useTransition();

  function onGenerate() {
    if (!productId) {
      toast.error("กรุณาเลือกสินค้า");
      return;
    }
    startTransition(async () => {
      const result = await generatePostAction({
        productId,
        postType,
        note,
      });
      if (result.ok) {
        setPost(result.post);
        setRemaining(result.usageRemaining);
        toast.success("AI สร้างโพสต์แล้ว — แก้ไขก่อนคัดลอกได้");
      } else {
        toast.error(result.error);
      }
    });
  }

  async function onCopy() {
    if (!post) return;
    try {
      await navigator.clipboard.writeText(post);
      toast.success("คัดลอกแล้ว");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ — กดเลือกข้อความและ copy เอง");
    }
  }

  const outOfQuota = remaining <= 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>ตั้งค่าโพสต์</CardTitle>
          <CardDescription>
            เลือกสินค้าและสไตล์โพสต์ที่ต้องการ
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="product">สินค้า</Label>
            <select
              id="product"
              className={selectClass}
              value={productId}
              disabled={pending}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || "(ไม่ได้ตั้งชื่อ)"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="post-type">ประเภทโพสต์</Label>
            <select
              id="post-type"
              className={selectClass}
              value={postType}
              disabled={pending}
              onChange={(e) => setPostType(e.target.value)}
            >
              {POST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note">บันทึกเพิ่มเติม (ไม่บังคับ)</Label>
            <Textarea
              id="note"
              rows={3}
              value={note}
              disabled={pending}
              placeholder="เช่น: เน้นว่าเหมาะกับหน้าฝน, ลด 15% เฉพาะคืนนี้, etc."
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={onGenerate}
              disabled={pending || outOfQuota || !productId}
            >
              <Sparkles />
              {pending ? "กำลังเขียน..." : "สร้างโพสต์"}
            </Button>
            {outOfQuota && (
              <p className="text-sm text-destructive">
                ใช้งานครบโควต้าเดือนนี้แล้ว
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {post && (
        <Card>
          <CardHeader>
            <CardTitle>โพสต์ที่ AI สร้าง</CardTitle>
            <CardDescription>
              แก้ไขได้ก่อนคัดลอกไปวางบน Facebook / IG / LINE
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              rows={12}
              value={post}
              onChange={(e) => setPost(e.target.value)}
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
