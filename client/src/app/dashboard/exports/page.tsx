"use client";

import { Download, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ExportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Exports</h1>
        <p className="mt-1 text-sm text-white/40">
          Download your generated documents.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Download className="h-16 w-16 text-white/10" />
        <h3 className="mt-4 text-lg font-medium text-white/40">
          No exports yet
        </h3>
        <p className="mt-1 text-sm text-white/30">
          Generate a report first, then export it from here.
        </p>
      </div>
    </div>
  );
}
