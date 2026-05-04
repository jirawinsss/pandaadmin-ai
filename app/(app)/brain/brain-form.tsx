"use client";

import { useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { brainSchema, type BrainInput } from "./schema";
import { saveBrainAction } from "./actions";

export function BrainForm({
  initial,
  productLimit,
}: {
  initial: BrainInput;
  productLimit: number;
}) {
  const [pending, startTransition] = useTransition();

  const form = useForm<BrainInput>({
    resolver: zodResolver(brainSchema),
    defaultValues: initial,
    mode: "onSubmit",
  });

  const products = useFieldArray({
    control: form.control,
    name: "products",
  });
  const faqs = useFieldArray({
    control: form.control,
    name: "faqs",
  });

  function onSubmit(values: BrainInput) {
    startTransition(async () => {
      const result = await saveBrainAction(values);
      if (result.ok) {
        toast.success("บันทึกข้อมูลร้านแล้ว");
      } else {
        toast.error(result.error);
      }
    });
  }

  const productCount = products.fields.length;
  const productLimitReached = productCount >= productLimit;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        {/* Section 1: ข้อมูลร้าน */}
        <Card>
          <CardHeader>
            <CardTitle>1. ข้อมูลร้าน</CardTitle>
            <CardDescription>
              ใช้เป็นบริบทพื้นฐานให้ AI รู้ว่าร้านคุณขายอะไร
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="store.name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อร้าน *</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น Panda Skin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="store.description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รายละเอียดร้าน</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="ขายอะไร ใครคือลูกค้า จุดขายของร้านคืออะไร"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section 2: น้ำเสียง */}
        <Card>
          <CardHeader>
            <CardTitle>2. น้ำเสียงและสไตล์การพูด</CardTitle>
            <CardDescription>
              ตัวอย่างที่กรอกจะทำให้ AI เลียนแบบสำนวนคุณได้แม่น
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="store.brand_voice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>โทนการพูด</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="เช่น สุภาพ เป็นกันเอง ใช้คำว่า 'ค่ะ' ลงท้าย ไม่ใช้คำหยาบ"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="store.voice_examples"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ตัวอย่างข้อความที่คุณเคยพิมพ์</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="วาง 2–3 ประโยคที่คุณเคยตอบลูกค้าจริง"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section 3: นโยบาย */}
        <Card>
          <CardHeader>
            <CardTitle>3. นโยบายและรายละเอียด</CardTitle>
            <CardDescription>
              ลูกค้าถามบ่อย — กรอกไว้ครั้งเดียว AI ตอบได้ทุกครั้ง
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="store.shipping_policy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>การจัดส่ง</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="ส่ง Kerry/Flash 1–2 วัน, ส่งฟรีเมื่อซื้อครบ 500 บาท"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="store.return_policy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>การคืน/เปลี่ยนสินค้า</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="store.payment_methods"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ช่องทางชำระเงิน</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="PromptPay, โอน SCB, ปลายทาง"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="store.current_promotions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>โปรโมชั่นปัจจุบัน</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="ลด 10% เมื่อซื้อ 2 ชิ้น (หมดเขต 31 พ.ค.)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Section 4: สินค้า */}
        <Card>
          <CardHeader>
            <CardTitle>
              4. สินค้า{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({productCount} / {productLimit})
              </span>
            </CardTitle>
            <CardDescription>
              เพิ่มสินค้าหลักของร้าน — ยิ่งละเอียด AI ยิ่งช่วยขายได้ดี
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {products.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีสินค้า — กดปุ่มด้านล่างเพื่อเพิ่ม
              </p>
            )}

            {products.fields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">สินค้า #{index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => products.remove(index)}
                    aria-label="ลบสินค้า"
                  >
                    <Trash2 />
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name={`products.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ชื่อสินค้า *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`products.${index}.price`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ราคา</FormLabel>
                      <FormControl>
                        <Input placeholder="เช่น 290 บาท" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`products.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รายละเอียด</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`products.${index}.key_features`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>จุดเด่น</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="ส่วนผสมพิเศษ, ใช้งานง่าย, ฯลฯ"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`products.${index}.target_customer`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ลูกค้าที่เหมาะ</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="เช่น ผู้หญิงวัย 25–35 ผิวแห้ง"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              disabled={productLimitReached}
              onClick={() =>
                products.append({
                  name: "",
                  price: "",
                  description: "",
                  key_features: "",
                  target_customer: "",
                })
              }
            >
              <Plus />
              {productLimitReached
                ? `ครบ ${productLimit} ชิ้นแล้ว`
                : "เพิ่มสินค้า"}
            </Button>
          </CardContent>
        </Card>

        {/* Section 5: FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>
              5. FAQ{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({faqs.fields.length})
              </span>
            </CardTitle>
            <CardDescription>
              คำถาม-คำตอบที่ลูกค้ามักถามซ้ำๆ
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {faqs.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                ยังไม่มี FAQ — กดปุ่มด้านล่างเพื่อเพิ่ม
              </p>
            )}

            {faqs.fields.map((field, index) => (
              <div
                key={field.id}
                className="flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">FAQ #{index + 1}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => faqs.remove(index)}
                    aria-label="ลบ FAQ"
                  >
                    <Trash2 />
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name={`faqs.${index}.question`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>คำถาม *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`faqs.${index}.answer`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>คำตอบ *</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={() => faqs.append({ question: "", answer: "" })}
            >
              <Plus />
              เพิ่ม FAQ
            </Button>
          </CardContent>
        </Card>

        {/* Save bar */}
        <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-4 backdrop-blur sm:rounded-lg">
          <Button type="submit" disabled={pending} size="lg" className="w-full sm:w-auto">
            {pending ? "กำลังบันทึก..." : "บันทึกข้อมูลร้าน"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
