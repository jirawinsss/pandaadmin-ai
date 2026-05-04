"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/brain", label: "ข้อมูลร้าน" },
  { href: "/reply", label: "ตอบแชต" },
  { href: "/post", label: "สร้างโพสต์" },
  { href: "/settings", label: "ตั้งค่า" },
];

export function AppNav({
  showAdmin,
  logoutAction,
}: {
  showAdmin: boolean;
  logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const items = showAdmin
    ? [...NAV_ITEMS, { href: "/admin", label: "Admin" }]
    : NAV_ITEMS;

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden items-center gap-1 text-sm md:flex">
        {items.map((item) => (
          <Button asChild key={item.href} variant="ghost" size="sm">
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
        <ThemeToggle />
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            ออกจากระบบ
          </Button>
        </form>
      </nav>

      {/* Mobile hamburger */}
      <div className="flex items-center gap-1 md:hidden">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 top-[57px] z-50 flex flex-col gap-1 border-t bg-background p-4 md:hidden">
          {items.map((item) => (
            <Button
              asChild
              key={item.href}
              variant="ghost"
              className="justify-start"
              onClick={() => setOpen(false)}
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start"
            >
              ออกจากระบบ
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
