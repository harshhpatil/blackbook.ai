"use client";

import { useState, useEffect } from "react";
import { History, FileText, CreditCard, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";

export default function HistoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true);
        const [ordersRes, assetsRes] = await Promise.all([
          api.payment.getOrders().catch(() => ({ orders: [] })),
          api.assets.getAssets().catch(() => ({ assets: [] })),
        ]);

        const ordersList = (ordersRes.data?.orders || ordersRes.data || ordersRes.orders || ordersRes || []).map((o: any) => ({
          id: o._id,
          type: "payment",
          title: `Purchase: ${o.purpose || "Credit Package"}`,
          status: o.status,
          date: o.createdAt,
          details: `₹${o.amount}`,
        }));

        const assetsList = (assetsRes.data?.assets || assetsRes.data || assetsRes.assets || assetsRes || []).map((a: any) => ({
          id: a._id,
          type: "asset",
          title: `Document: ${a.originalFilename}`,
          status: a.kind,
          date: a.createdAt,
          details: `${(a.size / 1024).toFixed(1)} KB`,
        }));

        const combined = [...ordersList, ...assetsList].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        setItems(combined);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Activity History</h1>
        <p className="mt-1 text-sm text-white/40">
          Your document generations and payment transactions timeline.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-[#222] rounded-2xl bg-[#111]">
          <History className="h-16 w-16 text-white/10" />
          <h3 className="mt-4 text-lg font-medium text-white/40">No activity yet</h3>
          <p className="mt-1 text-sm text-white/30">
            Your document generations and purchases will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="border-[#222] bg-[#111]">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    {item.type === "payment" ? <CreditCard className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {new Date(item.date).toLocaleString()} • {item.details}
                    </p>
                  </div>
                </div>

                <Badge variant={item.status === "paid" || item.type === "asset" ? "success" : "secondary"}>
                  {item.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
