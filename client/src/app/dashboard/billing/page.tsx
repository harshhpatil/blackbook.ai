"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: "₹0",
    period: "month",
    badge: "Current",
    features: ["1 report/month", "Basic templates", "PDF export", "Watermark"],
  },
  {
    name: "Pro",
    price: "₹499",
    period: "month",
    badge: "Popular",
    features: [
      "Unlimited reports",
      "Premium templates",
      "DOCX + PDF export",
      "No watermark",
      "Faster generation",
      "Priority support",
    ],
  },
  {
    name: "Institute",
    price: "₹4,999",
    period: "month",
    badge: "Enterprise",
    features: [
      "Multi-user access",
      "Shared templates",
      "Teacher review dashboard",
      "Custom branding",
      "Dedicated support",
    ],
  },
];

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="mt-1 text-sm text-white/40">
          Manage your subscription and billing.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative ${
              plan.badge === "Popular"
                ? "border-blue-500/50 bg-gradient-to-b from-blue-500/10 to-[#111]"
                : ""
            }`}
          >
            {plan.badge === "Popular" && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-4 py-1 text-xs font-medium text-white">
                {plan.badge}
              </div>
            )}
            <CardHeader className="text-center">
              <CardTitle className="text-white">{plan.name}</CardTitle>
              <div className="mt-4">
                <span className="text-3xl font-bold text-white">
                  {plan.price}
                </span>
                <span className="text-sm text-white/40">/{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    <span className="text-white/60">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-6 block">
                <Button
                  variant={plan.badge === "Popular" ? "primary" : "outline"}
                  className="w-full"
                >
                  {plan.badge === "Current" ? "Current Plan" : "Upgrade"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
