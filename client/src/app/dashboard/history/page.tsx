"use client";

import { History } from "lucide-react";

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">History</h1>
        <p className="mt-1 text-sm text-white/40">
          Your activity and document history.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <History className="h-16 w-16 text-white/10" />
        <h3 className="mt-4 text-lg font-medium text-white/40">
          No history yet
        </h3>
        <p className="mt-1 text-sm text-white/30">
          Your document generation history will appear here.
        </p>
      </div>
    </div>
  );
}
