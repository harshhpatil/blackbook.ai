"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    async function verify() {
      try {
        const res = await api.auth.verifyEmail(token!);
        setStatus("success");
        setMessage(res.message || "Email verified successfully!");
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Email verification failed or token has expired.");
      }
    }

    verify();
  }, [token]);

  return (
    <Card className="border-[#222] bg-[#111] max-w-sm w-full">
      <CardHeader>
        <CardTitle className="text-white text-center">Email Verification</CardTitle>
      </CardHeader>
      <CardContent className="text-center py-6 space-y-4">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            <p className="text-sm text-white/60">Verifying your email address...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h3 className="text-lg font-semibold text-white">Email Verified!</h3>
            <p className="text-sm text-white/60">{message}</p>
            <Link href="/signin" className="w-full mt-4">
              <Button className="w-full">Sign In to Dashboard</Button>
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <XCircle className="h-12 w-12 text-red-500" />
            <h3 className="text-lg font-semibold text-white">Verification Failed</h3>
            <p className="text-sm text-red-400">{message}</p>
            <Link href="/signin" className="w-full mt-4">
              <Button variant="outline" className="w-full">Back to Sign In</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-white/40" />}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
