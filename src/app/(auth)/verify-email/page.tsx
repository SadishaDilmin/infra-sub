"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageLoader } from "@/components/shared/page-loader";
import { api } from "@/lib/api/client";

function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setState("error");
      return;
    }
    api
      .post("/api/auth/verify-email", { token })
      .then(() => setState("ok"))
      .catch(() => setState("error"));
  }, [token]);

  if (state === "loading") return <PageLoader />;

  return (
    <Card>
      <CardHeader className="items-center text-center">
        {state === "ok" ? (
          <>
            <span className="mb-2 inline-flex rounded-full bg-emerald-500/10 p-3 text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <CardTitle>Email verified</CardTitle>
            <CardDescription>Your account is now active.</CardDescription>
          </>
        ) : (
          <>
            <span className="mb-2 inline-flex rounded-full bg-destructive/10 p-3 text-destructive">
              <XCircle className="h-6 w-6" />
            </span>
            <CardTitle>Verification failed</CardTitle>
            <CardDescription>
              This link is invalid or has expired. Request a new one from the
              login page.
            </CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full">
          <Link href="/login">Continue to login</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <VerifyEmail />
    </Suspense>
  );
}
