"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
              <span className="text-sm font-bold text-black">B</span>
            </div>
            <span className="text-lg font-semibold text-white">BlackBook AI</span>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-white text-center">Create Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input placeholder="your@email.com" type="email" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input placeholder="••••••••" type="password" />
            </div>
            <Button className="w-full">Create Account</Button>
            <p className="text-center text-sm text-white/40">
              Already have an account?{" "}
              <Link href="/signin" className="text-blue-400 hover:text-blue-300">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
