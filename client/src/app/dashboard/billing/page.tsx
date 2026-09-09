"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, ShoppingBag, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const creditPacks = [
  {
    purpose: "credits_10",
    name: "10 Generation Credits",
    price: 199,
    credits: 10,
    features: ["10 document generations", "Full AI placeholder parsing", "DOCX export"],
  },
  {
    purpose: "credits_50",
    name: "50 Generation Credits",
    price: 499,
    credits: 50,
    badge: "Best Value",
    features: ["50 document generations", "Priority AI generation queue", "Custom template trainer access"],
  },
];

export default function BillingPage() {
  const { user, credits, refetchCredits } = useAuth();
  const [loadingPurpose, setLoadingPurpose] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    // Load Razorpay Script dynamically
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    fetchOrders();

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  async function fetchOrders() {
    try {
      setLoadingOrders(true);
      const res = await api.payment.getOrders();
      setOrders(res.data?.orders || res.data || res.orders || res || []);
    } catch {
      // Ignore order load failure
    } finally {
      setLoadingOrders(false);
    }
  }

  const handleCheckout = async (purpose: string, amount: number) => {
    setLoadingPurpose(purpose);
    try {
      const pack = creditPacks.find((item) => item.purpose === purpose);
      const checkoutRes = await api.payment.createCheckout({
        purpose,
        amount: Math.round(amount * 100),
        currency: "INR",
        idempotencyKey: crypto.randomUUID(),
        planPurchased: "normal",
      });

      const options = {
        key: checkoutRes.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: checkoutRes.amount,
        currency: checkoutRes.currency || "INR",
        name: "BlackBook AI",
        description: `Purchase ${purpose}`,
        order_id: checkoutRes.razorpayOrderId,
        handler: async function (response: any) {
          try {
            await api.payment.verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Payment successful! Credits added to your account.");
            await refetchCredits();
            await fetchOrders();
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed");
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: {
          color: "#3B82F6",
        },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        toast.error("Razorpay SDK failed to load. Please refresh.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to initialize checkout");
    } finally {
      setLoadingPurpose(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Credits</h1>
        <p className="mt-1 text-sm text-white/40">
          Manage your credit balance and purchase generation packages.
        </p>
      </div>

      {/* Credit balance overview card */}
      <Card className="border-[#222] bg-gradient-to-r from-[#111] via-[#161616] to-[#111] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
              <Zap className="h-6 w-6 fill-amber-400" />
            </div>
            <div>
              <p className="text-xs text-white/40 font-medium">Available Credits</p>
              <p className="text-3xl font-bold text-white">{credits} Credits</p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 px-3 py-1 text-xs">
            1 Credit = 1 AI Document Generation
          </Badge>
        </div>
      </Card>

      {/* Credit packages grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Purchase Credits</h2>

        <div className="grid gap-6 md:grid-cols-2">
          {creditPacks.map((pack) => (
            <Card
              key={pack.purpose}
              className={`relative border-[#222] bg-[#111] ${
                pack.badge ? "border-blue-500/50 bg-gradient-to-b from-blue-500/10 to-[#111]" : ""
              }`}
            >
              {pack.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wider">
                  {pack.badge}
                </div>
              )}
              <CardHeader className="text-center pt-6">
                <CardTitle className="text-white text-lg">{pack.name}</CardTitle>
                <div className="mt-2 flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold text-white">₹{pack.price}</span>
                  <span className="text-xs text-white/40">one-time</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-2.5">
                  {pack.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-white/70">
                      <Check className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleCheckout(pack.purpose, pack.price)}
                  disabled={loadingPurpose === pack.purpose}
                  className="w-full gap-2"
                >
                  {loadingPurpose === pack.purpose ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShoppingBag className="h-4 w-4" />
                  )}
                  Buy {pack.credits} Credits
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment Orders History */}
      <div className="space-y-4 pt-4">
        <h2 className="text-lg font-semibold text-white">Order History</h2>

        <Card className="border-[#222] bg-[#111]">
          <CardContent className="p-0">
            {loadingOrders ? (
              <div className="py-8 flex justify-center text-white/40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="py-12 text-center text-xs text-white/40 flex flex-col items-center gap-2">
                <CreditCard className="h-8 w-8 text-white/20" />
                <p>No previous orders found</p>
              </div>
            ) : (
              <div className="divide-y divide-[#222]">
                {orders.map((order) => (
                  <div key={order._id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{order.purpose || "Credit Package"}</p>
                      <p className="text-xs text-white/40 mt-0.5 font-mono">Order ID: {order._id}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">₹{order.amount}</p>
                      <Badge
                        variant={order.status === "paid" ? "success" : "secondary"}
                        className="mt-1 text-[10px]"
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
