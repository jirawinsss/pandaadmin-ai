import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-2xl font-semibold">เข้าสู่ระบบ</h1>
        <p className="text-sm text-muted-foreground">
          ยังไม่มีบัญชี?{" "}
          <Link
            href="/register"
            className="text-primary underline-offset-4 hover:underline"
          >
            สมัครฟรี
          </Link>
        </p>
      </div>

      {notice && (
        <p className="rounded-md bg-muted p-3 text-center text-sm">
          {notice}
        </p>
      )}

      <LoginForm />
    </div>
  );
}
