import "server-only";
import type { StoreRow, ProductRow, FaqRow } from "@/lib/store";
import type { PostType } from "@/lib/post-types";
import type { ReplyGoal } from "@/app/(app)/reply/types";

const BULK_REPLY_GOAL_INSTRUCTIONS: Record<ReplyGoal, string> = {
  info: "เน้นการให้ข้อมูลตรงคำถามอย่างชัดเจน ไม่ต้องเร่งปิดการขาย",
  close:
    "เน้นการปิดการขายอย่างนุ่มนวล ไม่กดดัน ชวนให้ตัดสินใจซื้อในรอบนี้",
  recommend:
    "แนะนำสินค้าที่เหมาะกับลูกค้าจากบริบทของร้าน ใส่เหตุผลที่เลือก",
  objection:
    "รับมือข้อโต้แย้ง (เช่น ราคาแพง ลังเล กลัวผิดหวัง) ด้วยความเข้าใจ ไม่กดดัน",
  "follow-up":
    "ติดตามลูกค้าที่อาจหายไป กระตุ้นเบาๆ ไม่เร่ง ไม่ขอแบบรบกวน",
  polite:
    "ตอบสุภาพ มืออาชีพ เหมาะกับการตอบทั่วไปที่ไม่จำเป็นต้องเร่งปิดการขาย",
};

const POST_TYPE_INSTRUCTIONS: Record<PostType, string> = {
  intro:
    "แนะนำสินค้านี้ให้ลูกค้าใหม่รู้จัก เน้นว่าใครควรใช้ ใช้แล้วได้อะไร และทำไมต้องลอง",
  promotion:
    "เน้นว่าตอนนี้เป็นช่วงโปรโมชั่น/ลดราคา ใช้ข้อมูลโปรโมชั่นปัจจุบันของร้านเป็นหลัก ใส่ความเร่งด่วนนิดๆ",
  feature:
    "เน้นจุดเด่นและคุณสมบัติพิเศษของสินค้า ทำไมดีกว่าสินค้าในตลาด",
  urgency:
    "สร้างความเร่งด่วนในการตัดสินใจ เช่น 'จำนวนจำกัด' 'ใกล้หมดสต็อก' กระตุ้นให้ลูกค้ารีบสั่ง (ห้ามแต่งจำนวนสต็อกถ้าร้านไม่ระบุ)",
};

/**
 * Build the system prompt that primes the AI with the store's identity,
 * voice, policies, products, and FAQs. Designed as a stable cache prefix —
 * the only thing that changes per request is the customer message in the
 * user turn, so prompt caching can hit on every reply after the first.
 */
export function buildStoreSystemPrompt(opts: {
  store: StoreRow;
  products: ProductRow[];
  faqs: FaqRow[];
}): string {
  const { store, products, faqs } = opts;
  const lines: string[] = [];

  lines.push(
    "คุณคือผู้ช่วย AI ของร้านค้าออนไลน์ในประเทศไทย ทำหน้าที่ตอบลูกค้าในนามของร้าน",
  );
  lines.push(
    "ตอบเป็นภาษาไทยเสมอ ยกเว้นลูกค้าทักด้วยภาษาอื่น ให้ตอบภาษาเดียวกับลูกค้า",
  );
  lines.push("");

  // Section: store identity
  lines.push("# ข้อมูลร้าน");
  lines.push(`ชื่อร้าน: ${store.name?.trim() || "(ไม่ได้ตั้งชื่อ)"}`);
  if (store.description?.trim()) {
    lines.push(`รายละเอียด: ${store.description.trim()}`);
  }

  // Section: voice
  if (store.brand_voice?.trim() || store.voice_examples?.trim()) {
    lines.push("");
    lines.push("# น้ำเสียงและสไตล์การพูด");
    if (store.brand_voice?.trim()) {
      lines.push(store.brand_voice.trim());
    }
    if (store.voice_examples?.trim()) {
      lines.push("");
      lines.push("ตัวอย่างประโยคของร้าน (เลียนแบบสไตล์นี้):");
      lines.push(store.voice_examples.trim());
    }
  }

  // Section: policies
  const policies: string[] = [];
  if (store.shipping_policy?.trim())
    policies.push(`การจัดส่ง: ${store.shipping_policy.trim()}`);
  if (store.return_policy?.trim())
    policies.push(`การคืน/เปลี่ยนสินค้า: ${store.return_policy.trim()}`);
  if (store.payment_methods?.trim())
    policies.push(`ช่องทางชำระเงิน: ${store.payment_methods.trim()}`);
  if (store.current_promotions?.trim())
    policies.push(`โปรโมชั่นปัจจุบัน: ${store.current_promotions.trim()}`);

  if (policies.length > 0) {
    lines.push("");
    lines.push("# นโยบายและรายละเอียด");
    for (const p of policies) lines.push(p);
  }

  // Section: products
  if (products.length > 0) {
    lines.push("");
    lines.push("# สินค้า");
    for (const p of products) {
      const head = p.price ? `${p.name} (${p.price})` : p.name;
      lines.push(`- ${head}`);
      if (p.description?.trim())
        lines.push(`  รายละเอียด: ${p.description.trim()}`);
      if (p.key_features?.trim())
        lines.push(`  จุดเด่น: ${p.key_features.trim()}`);
      if (p.target_customer?.trim())
        lines.push(`  ลูกค้าที่เหมาะ: ${p.target_customer.trim()}`);
    }
  }

  // Section: FAQs
  if (faqs.length > 0) {
    lines.push("");
    lines.push("# คำถามที่พบบ่อย");
    for (const f of faqs) {
      lines.push(`Q: ${f.question}`);
      lines.push(`A: ${f.answer}`);
    }
  }

  // Section: rules — keep at the end so the cache prefix above stays stable
  // even if rules are tweaked separately later
  lines.push("");
  lines.push("# กติกาในการตอบ");
  lines.push(
    "- ตอบเฉพาะข้อความที่จะส่งให้ลูกค้าเท่านั้น ห้ามมีคำขึ้นต้นเช่น 'นี่คือคำตอบ:' หรือ 'ตามที่ขอ:'",
  );
  lines.push(
    "- ใช้น้ำเสียงและสำนวนตามที่ร้านระบุไว้ข้างต้นอย่างเคร่งครัด",
  );
  lines.push(
    "- ห้ามแต่งข้อมูลที่ไม่มีในบริบท เช่น ราคาที่ไม่ระบุ สินค้าที่ไม่มีในรายการ หรือนโยบายที่ไม่ได้บอก",
  );
  lines.push(
    "- ถ้าไม่รู้คำตอบ ให้บอกลูกค้าตรงๆ ว่าจะตรวจสอบและกลับมาตอบ ห้ามเดา",
  );
  lines.push("- ตอบสั้นกระชับ ปกติ 1-4 ประโยคก็พอ");

  return lines.join("\n");
}

/**
 * System prompt for the Bulk Reply Workspace.
 * Reuses buildStoreSystemPrompt as the stable cache prefix, then appends:
 *   - sales-coach role instructions
 *   - the goal nudge for this batch
 *   - JSON output rules (the schema is also enforced via output_config.format,
 *     but the model still benefits from clear instructions on each field)
 */
export function buildBulkReplySystemPrompt(opts: {
  store: StoreRow;
  products: ProductRow[];
  faqs: FaqRow[];
  goal: ReplyGoal;
  goalLabel: string;
}): string {
  const { store, products, faqs, goal, goalLabel } = opts;

  const storeBlock = buildStoreSystemPrompt({ store, products, faqs });

  const lines: string[] = [storeBlock];

  lines.push("");
  lines.push("# งานของคุณในรอบนี้");
  lines.push(
    "แม่ค้าวางข้อความลูกค้าหลายรายเข้ามาพร้อมกัน ให้คุณวิเคราะห์ทีละราย และร่างคำตอบ 3 แบบให้แม่ค้าเลือกใช้",
  );

  lines.push("");
  lines.push(`# เป้าหมายการตอบรอบนี้: ${goalLabel}`);
  lines.push(BULK_REPLY_GOAL_INSTRUCTIONS[goal]);

  lines.push("");
  lines.push("# กฎการตอบ");
  lines.push("- ใช้น้ำเสียงและสำนวนตามที่ร้านระบุไว้ข้างต้นอย่างเคร่งครัด");
  lines.push("- เป็นธรรมชาติ ไม่แข็งเหมือนบอท ไม่เว่อร์เกินจริง");
  lines.push(
    "- ห้ามแต่งราคา ส่วนลด นโยบาย หรือคุณสมบัติสินค้าที่ไม่มีในบริบท",
  );
  lines.push(
    "- ถ้าไม่รู้คำตอบจริง ให้บอกลูกค้าตรงๆ ว่าจะตรวจสอบและกลับมาตอบ ห้ามเดา",
  );
  lines.push("- ห้ามรับปากแทนร้าน เช่น 'ลดให้ได้แน่นอน' ถ้าโปรโมชั่นไม่มี");
  lines.push(
    "- ทุกคำตอบต้องเป็นข้อความที่แม่ค้าคัดลอกไปวางในแชตได้ทันที (ห้ามมีคำขึ้นต้นเช่น 'นี่คือคำตอบ:')",
  );

  lines.push("");
  lines.push("# คำอธิบายแต่ละ field ใน output");
  lines.push("- customer_message: ข้อความลูกค้าเดิม (copy ตรงตัว)");
  lines.push(
    "- intent: เลือก 1 อย่างที่ตรงที่สุด — ถามราคา / ขอโปร / ลังเล / พร้อมซื้อ / ขอวิธีใช้ / เปรียบเทียบ / กังวลความน่าเชื่อถือ / อื่นๆ",
  );
  lines.push(
    "- sales_note: 1-2 ประโยค บอกแม่ค้าว่าควรระวังอะไร โอกาสปิดเป็นยังไง (ภายในแม่ค้าอ่าน ไม่ใช่ส่งให้ลูกค้า)",
  );
  lines.push("- short_reply: 1-2 ประโยค กระชับ สำหรับตอบเร็ว");
  lines.push(
    "- polite_reply: 2-3 ประโยค สุภาพมืออาชีพ เหมาะกับลูกค้าใหม่หรือเรื่องสำคัญ",
  );
  lines.push(
    "- closing_reply: 2-4 ประโยค กระตุ้นการตัดสินใจซื้ออย่างนุ่มนวล ไม่กดดัน",
  );
  lines.push(
    "- risk_level: high สำหรับเคลม คืนเงิน คำด่า โอนผิด ปัญหาสุขภาพ/กฎหมาย; medium สำหรับเรื่องเซนซิทีฟ; low สำหรับคำถามทั่วไป",
  );
  lines.push(
    "- should_handoff: true ถ้าเป็นเรื่องที่ไม่ควรให้ AI ตอบเอง (risk_level=high หรือเรื่องที่ต้องตัดสินใจเฉพาะกิจ)",
  );

  lines.push("");
  lines.push(
    "ส่งกลับเป็น JSON object ที่มี key 'items' เป็น array ของ object ตามลำดับลูกค้าเดิม (ลูกค้า #1 -> items[0])",
  );

  return lines.join("\n");
}

/**
 * System prompt for generating a selling post about a specific product.
 * Reuses the store identity / voice / policies block from the reply prompt
 * so its prefix matches and prompt caching can hit across both flows.
 */
export function buildPostSystemPrompt(opts: {
  store: StoreRow;
  faqs: FaqRow[];
  product: ProductRow;
  postType: PostType;
}): string {
  const { store, faqs, product, postType } = opts;

  // Reuse the same store + voice + policies block as the reply prompt,
  // pass an empty products list — the focused product is included separately
  // below so prompts for different products share more cache.
  const storeBlock = buildStoreSystemPrompt({
    store,
    products: [],
    faqs,
  });

  const lines: string[] = [storeBlock];

  lines.push("");
  lines.push("# สินค้าที่จะโพสต์");
  lines.push(
    `ชื่อ: ${product.name}${product.price ? ` (${product.price})` : ""}`,
  );
  if (product.description?.trim())
    lines.push(`รายละเอียด: ${product.description.trim()}`);
  if (product.key_features?.trim())
    lines.push(`จุดเด่น: ${product.key_features.trim()}`);
  if (product.target_customer?.trim())
    lines.push(`ลูกค้าที่เหมาะ: ${product.target_customer.trim()}`);

  lines.push("");
  lines.push("# ประเภทโพสต์");
  lines.push(POST_TYPE_INSTRUCTIONS[postType]);

  lines.push("");
  lines.push("# กติกาในการเขียนโพสต์");
  lines.push("- ตอบเฉพาะเนื้อหาโพสต์เท่านั้น ห้ามมีคำขึ้นต้นเช่น 'นี่คือโพสต์:'");
  lines.push("- ใช้ภาษาไทยและน้ำเสียงตามที่ร้านระบุ");
  lines.push("- เปิดด้วย hook ที่ดึงความสนใจในบรรทัดแรก");
  lines.push("- จบด้วย call to action ชัดๆ (ทักแชต/สั่งซื้อ/inbox)");
  lines.push(
    "- ห้ามใช้ markdown (เช่น ** หรือ #) เพราะโพสต์จะวางตรงไปบน Facebook/IG/LINE",
  );
  lines.push("- ใช้ emoji ได้ 1-3 อันเพื่อแบ่งสายตา ไม่เกินนั้น");
  lines.push("- ความยาวเหมาะสม 100-300 คำสำหรับโพสต์ขายของ");
  lines.push(
    "- ห้ามแต่งข้อมูลที่ไม่มีในบริบท เช่น ส่วนลดที่ไม่ระบุ หรือคุณสมบัติที่สินค้าไม่มี",
  );

  return lines.join("\n");
}
