import { redirect } from "next/navigation";
import {
  getCurrentContext,
  getStoreFaqs,
  getStoreProducts,
} from "@/lib/store";
import { planLimits, planLabel } from "@/lib/plans";
import { BrainForm } from "./brain-form";

export default async function BrainPage() {
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
