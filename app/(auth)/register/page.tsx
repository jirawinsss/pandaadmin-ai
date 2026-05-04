import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-2xl font-semibold">สมัครฟรี</h1>
        <p className="text-sm text-muted-foreground">
          มีบัญชีอยู่แล้ว?{" "}
          <Link
            href="/login"
            className="text-primary underline-offset-4 hover:underline"
          >
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
