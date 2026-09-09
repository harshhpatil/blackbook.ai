"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Reset token is missing or invalid.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await api.auth.resetPassword(password, token);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to reset password. Token may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-[#222] bg-[#111] max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-white text-center">Password Reset Successful</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6 space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400 mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm text-white/60">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <Button onClick={() => router.push("/signin")} className="w-full mt-4">
            Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#222] bg-[#111] max-w-sm w-full">
      <CardHeader>
        <CardTitle className="text-white text-center">Set New Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-white/80">New Password</Label>
            <Input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/80">Confirm Password</Label>
            <Input
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Reset Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-white/40" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
