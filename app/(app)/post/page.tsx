import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentContext,
  getStoreProducts,
} from "@/lib/store";
import { planLimits } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PostForm } from "./post-form";
import { PostHistory } from "./post-history";

export default async function PostPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  const limits = planLimits(ctx.profile.plan);
  const remaining = Math.max(0, limits.post - ctx.profile.usage_post);
  const needsStore = !ctx.store.name?.trim();

  const products = await getStoreProducts(ctx.store.id);
  const needsProducts = products.length === 0;

  const supabase = await createClient();
  const { data: history } = await supabase
    .from("post_history")
    .select("id, content, post_type, product_id, created_at")
    .eq("store_id", ctx.store.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // Build product name lookup for history rendering
  const productNameById = new Map(products.map((p) => [p.id, p.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          เหลือ <span className="font-medium text-foreground">{remaining}</span>{" "}
          จาก {limits.post} ครั้ง / เดือน
        </p>
        <h1 className="font-heading text-2xl font-semibold">สร้างโพสต์</h1>
        <p className="text-sm text-muted-foreground">
          เลือกสินค้า + ประเภทโพสต์ → AI สร้างโพสต์ขายในน้ำเสียงร้านให้คัดลอกไปวาง Facebook / IG / LINE
        </p>
      </div>

      {needsStore || needsProducts ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {needsStore ? "ตั้งค่าข้อมูลร้านก่อน" : "ยังไม่มีสินค้าในร้าน"}
            </CardTitle>
            <CardDescription>
              {needsStore
                ? "AI ต้องการชื่อร้านและรายละเอียดเพื่อสร้างโพสต์ได้"
                : "เพิ่มสินค้าอย่างน้อย 1 รายการในหน้า 'ข้อมูลร้าน' ก่อน"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/brain">ไปกรอกข้อมูลร้าน</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PostForm
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          initialRemaining={remaining}
        />
      )}

      <PostHistory items={history ?? []} productNameById={productNameById} />
    </div>
  );
}
