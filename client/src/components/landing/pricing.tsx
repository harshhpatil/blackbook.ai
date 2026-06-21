"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRICING } from "@/lib/constants";
import Link from "next/link";

export function PricingSection() {
  const plans = [
    {
      ...PRICING.free,
      highlight: false,
      badge: "Starter",
    },
    {
      ...PRICING.pro,
      highlight: true,
      badge: "Most Popular",
    },
    {
      ...PRICING.institute,
      highlight: false,
      badge: "Enterprise",
    },
  ];

  return (
    <section id="pricing" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            Simple, transparent{" "}
            <span className="text-blue-400">pricing</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-white/50"
          >
            Start free, upgrade as you grow. No hidden fees.
          </motion.p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-2xl border p-8 transition-all ${
                plan.highlight
                  ? "border-blue-500/50 bg-gradient-to-b from-blue-500/10 to-[#111] shadow-xl shadow-blue-500/5"
                  : "border-[#222] bg-[#111] hover:border-white/20"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-4 py-1 text-xs font-medium text-white">
                  {plan.badge}
                </div>
              )}

              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <div className="mt-4 flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold text-white">
                  ₹{plan.price}
                  </span>
                  <span className="text-sm text-white/40">
                    /{plan.price === 0 ? "month" : "month"}
                  </span>
                </div>
                {plan.price === 0 && (
                  <p className="mt-1 text-xs text-white/30">1 report/mo</p>
                )}
              </div>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    <span className="text-sm text-white/60">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Link href={plan.price === 0 ? "/signup" : "/signup?plan=pro"}>
                  <Button
                    variant={plan.highlight ? "primary" : "outline"}
                    className="w-full"
                    size="lg"
                  >
                    {plan.price === 0 ? "Get Started Free" : "Subscribe Now"}
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
