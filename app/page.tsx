import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Check,
  Clock,
  MessageCircle,
  PenLine,
  Sparkles,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { PLAN_LIMITS } from "@/lib/plans";
import { TryDemo } from "./_components/try-demo";

const PRICING = [
  {
    plan: "free" as const,
    label: "Free",
    price: "0",
    period: "ตลอดชีพ",
    blurb: "ทดลองฟรี ไม่ต้องใช้บัตร",
    cta: "เริ่มใช้ฟรี",
    highlight: false,
  },
  {
    plan: "starter" as const,
    label: "Starter",
    price: "299",
    period: "/ เดือน",
    blurb: "เหมาะสำหรับร้านที่เพิ่งเริ่มขายจริงจัง",
    cta: "เริ่มใช้ Starter",
    highlight: true,
  },
  {
    plan: "pro" as const,
    label: "Pro",
    price: "899",
    period: "/ เดือน",
    blurb: "ร้านใหญ่ที่มีลูกค้าทักทั้งวัน",
    cta: "เริ่มใช้ Pro",
    highlight: false,
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <div className="flex flex-1 flex-col">
      {/* Sticky top bar with backdrop blur */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <span className="font-heading text-lg font-semibold">แม่ค้า AI</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isLoggedIn ? (
              <Button asChild size="sm">
                <Link href="/dashboard">เข้า Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/login">เข้าสู่ระบบ</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">เริ่มใช้ฟรี</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero — gradient background + chat mockup */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="absolute inset-x-0 top-0 -z-10 h-[400px] bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,_var(--color-primary)_0%,_transparent_70%)] opacity-10" />

        <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-28">
          {/* Left: copy */}
          <div className="flex flex-col items-start gap-6 text-left">
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm">
              <Sparkles className="size-3.5 text-primary" />
              ผู้ช่วย AI สำหรับแม่ค้าออนไลน์ไทย
            </div>
            <h1 className="font-heading text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              ตอบแชตเร็วขึ้น{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                10 เท่า
              </span>
              <br />
              ทำโพสต์ขายดี ใน{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                5 วินาที
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              แม่ค้า AI จำข้อมูลร้านคุณได้ทุกอย่าง — สินค้า ราคา นโยบาย น้ำเสียง —
              แล้วช่วยตอบลูกค้าและสร้างโพสต์ในแบบของคุณเอง
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {isLoggedIn ? (
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    เข้า Dashboard <ArrowRight />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/register">
                      เริ่มใช้ฟรี <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="#pricing">ดูแพ็กเกจ</Link>
                  </Button>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="size-3.5 text-primary" />
                ฟรีไม่ต้องใช้บัตรเครดิต
              </span>
              <span className="flex items-center gap-1">
                <Check className="size-3.5 text-primary" />
                ใช้งานใน 2 นาที
              </span>
              <span className="flex items-center gap-1">
                <Check className="size-3.5 text-primary" />
                ภาษาไทย 100%
              </span>
            </div>
          </div>

          {/* Right: chat mockup */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-2xl" />
            <div className="rounded-2xl border bg-card p-5 shadow-xl">
              <div className="flex items-center gap-2 border-b pb-3">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  PS
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Panda Skin</span>
                  <span className="text-xs text-muted-foreground">ลูกค้าทัก</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 py-4">
                {/* Customer message */}
                <div className="flex items-end gap-2">
                  <div className="rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-sm">
                    สนใจ Cleansing Oil ค่ะ ส่งฟรีไหม? 🥺
                  </div>
                </div>

                {/* AI suggestion label */}
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <Sparkles className="size-3" />
                  AI ร่างคำตอบให้
                </div>

                {/* AI reply */}
                <div className="flex items-end gap-2 self-end">
                  <div className="rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    สวัสดีค่ะ! Cleansing Oil 290 บาทค่ะ ส่งฟรีเมื่อสั่งครบ 500 บาท
                    หรือเพิ่มเพียง 30 บาทส่ง Kerry ได้เลยนะคะ 💖
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  สร้างใน 3 วิ
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">
                  น้ำเสียงจาก /brain
                </span>
                <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  <Check className="size-3" />
                  คัดลอก
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">
              ปัญหาที่แม่ค้าทุกร้านเจอ
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
              เคยเจอแบบนี้ไหม?
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <PainCard
              emoji="😩"
              title="ตอบแชตไม่ทัน"
              body="ลูกค้าทัก 10 คน แต่กว่าจะตอบครบ ไป 2 ชั่วโมงแล้ว บางคนรอไม่ไหวก็เลื่อนไปร้านอื่น"
            />
            <PainCard
              emoji="📝"
              title="คิด caption ไม่ออก"
              body="อยากโพสต์วันละ 2-3 โพสต์ แต่นั่งคิดอยู่ครึ่งชั่วโมงก็ออกมาเหมือนเดิม น่าเบื่อ"
            />
            <PainCard
              emoji="🤖"
              title="AI ทั่วไปไม่รู้จักร้าน"
              body="เคยลอง ChatGPT ฟรี แต่มันไม่รู้สินค้า ราคา นโยบายของร้านเรา ตอบมั่ว ลูกค้างง"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">
              ฟีเจอร์
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
              แม่ค้า AI ช่วยคุณยังไง
            </h2>
            <p className="mt-3 text-muted-foreground">
              3 อย่างที่จะเปลี่ยนวิธีขายของออนไลน์ของคุณ
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Brain className="size-6" />}
              accent="from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400"
              title="จำร้านคุณได้ทุกอย่าง"
              body="สินค้า ราคา นโยบายส่ง น้ำเสียง โปรโมชั่น — ใส่ครั้งเดียว AI จำได้ตลอด ไม่ต้องบอกซ้ำ"
            />
            <FeatureCard
              icon={<MessageCircle className="size-6" />}
              accent="from-pink-500/20 to-pink-500/5 text-pink-600 dark:text-pink-400"
              title="ตอบแชตในน้ำเสียงของคุณ"
              body="วางข้อความลูกค้า → AI ร่างคำตอบในสไตล์ที่คุณตั้งไว้ คัดลอกไปวางในแชตได้ทันที"
            />
            <FeatureCard
              icon={<Zap className="size-6" />}
              accent="from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400"
              title="โพสต์ขายของไม่หมดมุก"
              body="เลือกสินค้า + ประเภท (แนะนำ / โปร / เน้นจุดเด่น / กระตุ้นซื้อ) → ได้ caption พร้อมโพสต์"
            />
          </div>
        </div>
      </section>

      {/* Try demo */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">
              ลองเอง
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
              ลองให้ AI ตอบลูกค้าให้ดูเลย
            </h2>
            <p className="mt-3 text-muted-foreground">
              ไม่ต้องสมัคร — ลอง 2 ครั้งก่อนตัดสินใจ
            </p>
          </div>
          <div className="mt-12">
            <TryDemo isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b">
        <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">
              วิธีใช้งาน
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
              เริ่มใช้ใน 3 ขั้น
            </h2>
            <p className="mt-3 text-muted-foreground">ไม่ต้องเก่ง tech</p>
          </div>
          <div className="relative mt-12">
            {/* Vertical connecting line */}
            <div
              aria-hidden="true"
              className="absolute left-[19px] top-3 bottom-3 w-px bg-border sm:left-[27px]"
            />
            <ol className="flex flex-col gap-8">
              <StepCard
                n={1}
                icon={<PenLine className="size-5" />}
                title="กรอกข้อมูลร้าน"
                body="ชื่อร้าน, สินค้า, นโยบาย, ตัวอย่างน้ำเสียง — ใช้เวลา 5-10 นาที"
              />
              <StepCard
                n={2}
                icon={<Sparkles className="size-5" />}
                title="วางข้อความลูกค้า / เลือกสินค้าจะโพสต์"
                body="AI สร้างคำตอบ / โพสต์ในน้ำเสียงร้านคุณภายใน 5-10 วินาที"
              />
              <StepCard
                n={3}
                icon={<MessageCircle className="size-5" />}
                title="แก้นิดหน่อย → คัดลอกไปแชต / โซเชียล"
                body="ทุกอย่างแก้ไขได้ก่อนใช้จริง ไม่มีอะไรส่งอัตโนมัติ คุณคุมเองทั้งหมด"
              />
            </ol>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
          <div className="text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">
              ราคา
            </p>
            <h2 className="mt-2 font-heading text-3xl font-semibold sm:text-4xl">
              ราคาตรงไปตรงมา
            </h2>
            <p className="mt-3 text-muted-foreground">
              เริ่มฟรี อัปเกรดได้ตลอด ยกเลิกเมื่อไหร่ก็ได้
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PRICING.map((tier) => (
              <PricingCard
                key={tier.plan}
                tier={tier}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
          <p className="mt-10 text-center text-xs text-muted-foreground">
            ตอนนี้รับชำระผ่าน PromptPay / โอนธนาคาร — แจ้งสลิปแล้วทีมอัปเกรดให้ใน 24 ชม.
          </p>
        </div>
      </section>

      {/* Final CTA — gradient background */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium shadow-sm">
            <Sparkles className="size-3.5 text-primary" />
            พร้อมเริ่มฟรีเดี๋ยวนี้
          </div>
          <h2 className="font-heading text-3xl font-semibold leading-tight sm:text-5xl">
            พร้อมจะตอบแชตให้ทันลูกค้าหรือยัง?
          </h2>
          <p className="text-lg text-muted-foreground">
            ทดลองฟรี 10 reply + 5 โพสต์ ไม่ต้องใช้บัตรเครดิต
          </p>
          {isLoggedIn ? (
            <Button asChild size="lg">
              <Link href="/dashboard">
                เข้า Dashboard <ArrowRight />
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href="/register">
                เริ่มใช้ฟรี <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-3" />
            </div>
            <span>© {new Date().getFullYear()} แม่ค้า AI · maekhaai.com</span>
          </div>
          <p>Made in Thailand 🇹🇭 · Powered by Claude AI</p>
        </div>
      </footer>
    </div>
  );
}

function PainCard({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
      <div className="text-3xl">{emoji}</div>
      <h3 className="font-heading text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  accent,
  title,
  body,
}: {
  icon: React.ReactNode;
  accent: string;
  title: string;
  body: string;
}) {
  return (
    <div className="group flex flex-col gap-4 rounded-xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg">
      <div
        className={`flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent}`}
      >
        {icon}
      </div>
      <h3 className="font-heading text-lg font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function StepCard({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4 sm:gap-6">
      <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-background font-heading text-base font-semibold sm:size-14 sm:text-lg">
        {n}
      </div>
      <div className="flex flex-col gap-2 pt-1">
        <h3 className="flex items-center gap-2 font-heading text-lg font-medium">
          <span className="text-primary">{icon}</span>
          {title}
        </h3>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

function PricingCard({
  tier,
  isLoggedIn,
}: {
  tier: (typeof PRICING)[number];
  isLoggedIn: boolean;
}) {
  const limits = PLAN_LIMITS[tier.plan];
  return (
    <div
      className={`relative flex flex-col gap-6 rounded-2xl border p-8 transition-shadow ${
        tier.highlight
          ? "border-primary bg-card shadow-xl ring-2 ring-primary/20"
          : "bg-card hover:shadow-md"
      }`}
    >
      {tier.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-md">
            ✨ แนะนำ
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="font-heading text-xl font-semibold">{tier.label}</h3>
        <p className="text-sm text-muted-foreground">{tier.blurb}</p>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="font-heading text-5xl font-semibold">฿{tier.price}</span>
        <span className="ml-1 text-sm text-muted-foreground">{tier.period}</span>
      </div>

      <ul className="flex flex-col gap-3 text-sm">
        <PricingFeature>
          ตอบแชต <strong>{limits.reply.toLocaleString()}</strong> ครั้ง / เดือน
        </PricingFeature>
        <PricingFeature>
          สร้างโพสต์ <strong>{limits.post.toLocaleString()}</strong> ครั้ง / เดือน
        </PricingFeature>
        <PricingFeature>
          เพิ่มสินค้า <strong>{limits.products.toLocaleString()}</strong> ชิ้น
        </PricingFeature>
        <PricingFeature>FAQ ไม่จำกัด</PricingFeature>
        <PricingFeature>ประวัติย้อนหลังครบทุกครั้ง</PricingFeature>
      </ul>

      <Button
        asChild
        variant={tier.highlight ? "default" : "outline"}
        size="lg"
        className="w-full"
      >
        <Link href={isLoggedIn ? "/dashboard" : "/register"}>{tier.cta}</Link>
      </Button>
    </div>
  );
}

function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <div className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Check className="size-3 text-primary" />
      </div>
      <span>{children}</span>
    </li>
  );
}
