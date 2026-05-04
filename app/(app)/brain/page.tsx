import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  getCurrentContext,
  getStoreFaqs,
  getStoreProducts,
} from "@/lib/store";
import { planLimits, planLabel } from "@/lib/plans";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BrainForm } from "./brain-form";

export default async function BrainPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const isWelcome = welcome === "1";

  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  const [products, faqs] = await Promise.all([
    getStoreProducts(ctx.store.id),
    getStoreFaqs(ctx.store.id),
  ]);

  const limits = planLimits(ctx.profile.plan);

  const initial = {
    store: {
      name: ctx.store.name ?? "",
      description: ctx.store.description ?? "",
      brand_voice: ctx.store.brand_voice ?? "",
      voice_examples: ctx.store.voice_examples ?? "",
      shipping_policy: ctx.store.shipping_policy ?? "",
      return_policy: ctx.store.return_policy ?? "",
      payment_methods: ctx.store.payment_methods ?? "",
      current_promotions: ctx.store.current_promotions ?? "",
    },
    products: products.map((p) => ({
      id: p.id,
      name: p.name ?? "",
      price: p.price ?? "",
      description: p.description ?? "",
      key_features: p.key_features ?? "",
      target_customer: p.target_customer ?? "",
    })),
    faqs: faqs.map((f) => ({
      id: f.id,
      question: f.question ?? "",
      answer: f.answer ?? "",
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      {isWelcome && (
        <Card className="border-primary bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              ยินดีต้อนรับสู่แม่ค้า AI! 🎉
            </CardTitle>
            <CardDescription>
              ขั้นแรก กรอกข้อมูลร้านให้ AI รู้จัก ใช้เวลา 5-10 นาที
              ยิ่งละเอียด AI ยิ่งช่วยตอบลูกค้าและทำโพสต์ในแบบของคุณได้แม่น
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="ml-4 list-decimal flex-col gap-1 text-sm">
              <li><strong>ตั้งชื่อร้าน + คำอธิบาย</strong> ที่จำเป็นที่สุด</li>
              <li><strong>วาง 2-3 ประโยค</strong> ที่คุณเคยตอบลูกค้าจริง — ใช้สอน AI เลียนแบบสไตล์</li>
              <li><strong>เพิ่มสินค้า 1-3 ชิ้น</strong> พร้อมรายละเอียด — เพิ่มเพิ่มทีหลังได้</li>
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          แพ็กเกจ {planLabel(ctx.profile.plan)} — สินค้าได้สูงสุด{" "}
          {limits.products} ชิ้น
        </p>
        <h1 className="font-heading text-2xl font-semibold">ข้อมูลร้าน</h1>
        <p className="text-sm text-muted-foreground">
          กรอกให้ครบจะช่วยให้ AI ตอบลูกค้าและสร้างโพสต์ได้แม่นยำขึ้น —
          ปุ่มบันทึกอยู่ล่างสุดของหน้า
        </p>
      </div>

      <BrainForm initial={initial} productLimit={limits.products} />
    </div>
  );
}
