// Plain data — safe to import from both server and client components.
// Don't add "server-only" here.

export const POST_TYPES = [
  { value: "intro", label: "แนะนำสินค้า" },
  { value: "promotion", label: "โปรโมชั่น / ลดราคา" },
  { value: "feature", label: "เน้นจุดเด่น" },
  { value: "urgency", label: "กระตุ้นซื้อ (จำนวนจำกัด)" },
] as const;

export type PostType = (typeof POST_TYPES)[number]["value"];
