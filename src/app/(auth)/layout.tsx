import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between p-4">
        <Logo />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <p className="p-6 text-center text-xs text-muted-foreground">
        By continuing you agree to our{" "}
        <Link href="/" className="underline">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/" className="underline">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
