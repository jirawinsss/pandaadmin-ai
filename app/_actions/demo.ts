"use server";

import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, REPLY_MODEL } from "@/lib/anthropic";

const COOKIE_NAME = "demo_count";
const MAX_DEMOS_PER_BROWSER = 2;

// Hardcoded sample shop — same shape as buildStoreSystemPrompt would produce
// but baked at module load so prompt caching kicks in across all visitors.
const SAMPLE_SYSTEM_PROMPT = `คุณคือผู้ช่วย AI ของร้าน "Panda Skin" ทำหน้าที่ตอบลูกค้าในนามของร้าน
ตอบเป็นภาษาไทยเสมอ ยกเว้นลูกค้าทักด้วยภาษาอื่น

# ข้อมูลร้าน
ชื่อร้าน: Panda Skin
รายละเอียด: ขายสกินแคร์เกาหลีนำเข้าของแท้ 100% เน้นสูตรอ่อนโยน ใช้ได้ทุกสภาพผิว

# น้ำเสียงและสไตล์การพูด
สุภาพ เป็นกันเอง ใช้คำว่า "ค่ะ" ลงท้าย ไม่ใช้คำหยาบ ใส่ emoji 1-2 อันต่อข้อความเพื่อความเป็นมิตร

ตัวอย่างประโยคของร้าน:
- "สวัสดีค่ะ! ขอบคุณที่สนใจสินค้าของเรานะคะ 💖"
- "ส่งฟรีเลยนะคะคุณลูกค้า เดี๋ยวแอดเก็บออเดอร์ให้เลยค่ะ ☺️"

# นโยบายและรายละเอียด
การจัดส่ง: Kerry Express / Flash 1-2 วันถึง ส่งฟรีเมื่อสั่งครบ 500 บาท ไม่ครบเสริม 30 บาท
การคืน/เปลี่ยน: เปลี่ยนได้ภายใน 7 วันถ้าสินค้ามีปัญหา ไม่รับคืนถ้าใช้แล้ว
ช่องทางชำระเงิน: PromptPay (089-xxx-xxxx) / โอน SCB / เก็บเงินปลายทาง
โปรโมชั่นปัจจุบัน: ลด 10% เมื่อซื้อครบ 2 ชิ้น (หมดเขตสิ้นเดือน)

# สินค้า
- Cleansing Oil (290 บาท)
  รายละเอียด: ออยล์ล้างเครื่องสำอาง ใช้แล้วล้างน้ำออกหมดจด ไม่ทิ้งคราบมัน
  จุดเด่น: สูตรอ่อนโยน ไม่แสบตา ใช้ได้ทุกวัน
  ลูกค้าที่เหมาะ: ผู้หญิงวัย 18-35 ที่แต่งหน้าเป็นประจำ

- Vitamin C Serum (590 บาท)
  รายละเอียด: เซรั่มวิตามินซี 15% ลดจุดด่างดำ ผิวกระจ่างใส
  จุดเด่น: เห็นผลใน 2 สัปดาห์ ขวดสีชาป้องกันแสง
  ลูกค้าที่เหมาะ: คนที่มีปัญหาฝ้า กระ จุดด่างดำจากสิว

- Snail Cream (490 บาท)
  รายละเอียด: ครีมเมือกหอยทาก สูตรเข้มข้น ฟื้นฟูผิว
  จุดเด่น: ลดรอยสิว ทำให้ผิวเรียบเนียน
  ลูกค้าที่เหมาะ: คนที่มีปัญหารอยสิว ผิวแห้ง

# กติกาในการตอบ
- ตอบเฉพาะข้อความที่จะส่งให้ลูกค้าเท่านั้น ห้ามมีคำขึ้นต้นเช่น "นี่คือคำตอบ:"
- ใช้น้ำเสียงตามตัวอย่างข้างบน
- ห้ามแต่งข้อมูลที่ไม่มีในบริบท เช่น สินค้าที่ไม่มีในรายการ
- ถ้าไม่รู้คำตอบ ให้บอกลูกค้าตรงๆ ว่าจะตรวจสอบและกลับมาตอบ
- ตอบสั้นกระชับ 1-3 ประโยคก็พอ`;

export type DemoResult =
  | { ok: true; reply: string; remaining: number }
  | { ok: false; error: string; quotaReached?: boolean };

export async function tryDemoAction(
  customerMsg: string,
): Promise<DemoResult> {
  const message = customerMsg.trim();
  if (!message) return { ok: false, error: "กรุณาพิมพ์ข้อความลูกค้า" };
  if (message.length > 500)
    return { ok: false, error: "ข้อความยาวเกินไป (เกิน 500 ตัวอักษร)" };

  const cookieStore = await cookies();
  const used = parseInt(cookieStore.get(COOKIE_NAME)?.value ?? "0", 10) || 0;

  if (used >= MAX_DEMOS_PER_BROWSER) {
    return {
      ok: false,
      error: "ทดลองครบโควต้าแล้ว — สมัครฟรีเพื่อใช้กับข้อมูลร้านของคุณเอง",
      quotaReached: true,
    };
  }

  let aiReply = "";
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: REPLY_MODEL,
      max_tokens: 512,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: [
        {
          type: "text",
          text: SAMPLE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: message }],
    });

    for (const block of response.content) {
      if (block.type === "text") aiReply += block.text;
    }
    aiReply = aiReply.trim();

    if (!aiReply) {
      return { ok: false, error: "AI ไม่ได้สร้างคำตอบ ลองใหม่อีกครั้ง" };
    }
  } catch (err) {
    console.error("[demo] anthropic error:", err);
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "ระบบกำลังโดนใช้หนัก ลองใหม่อีก 1 นาที" };
    }
    return { ok: false, error: "เรียก AI ไม่สำเร็จ — ลองใหม่อีกครั้ง" };
  }

  const newCount = used + 1;
  cookieStore.set(COOKIE_NAME, String(newCount), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return {
    ok: true,
    reply: aiReply,
    remaining: MAX_DEMOS_PER_BROWSER - newCount,
  };
}
