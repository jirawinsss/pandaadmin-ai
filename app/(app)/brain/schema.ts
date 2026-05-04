import { z } from "zod";

const optionalText = z
  .string()
  .max(5000, "ยาวเกินไป")
  .optional()
  .or(z.literal(""));

export const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "ใส่ชื่อสินค้า").max(200),
  price: optionalText,
  description: optionalText,
  key_features: optionalText,
  target_customer: optionalText,
});

export const faqSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(1, "ใส่คำถาม").max(500),
  answer: z.string().trim().min(1, "ใส่คำตอบ").max(2000),
});

export const brainSchema = z.object({
  store: z.object({
    name: z.string().trim().min(1, "ใส่ชื่อร้าน").max(120),
    description: optionalText,
    brand_voice: optionalText,
    voice_examples: optionalText,
    shipping_policy: optionalText,
    return_policy: optionalText,
    payment_methods: optionalText,
    current_promotions: optionalText,
  }),
  products: z.array(productSchema),
  faqs: z.array(faqSchema),
});

export type BrainInput = z.infer<typeof brainSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type FaqInput = z.infer<typeof faqSchema>;
