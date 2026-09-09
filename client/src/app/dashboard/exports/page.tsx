"use client";

import { useState, useEffect } from "react";
import { Download, FileText, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

interface AssetItem {
  _id: string;
  originalFilename: string;
  kind: string;
  contentType: string;
  size: number;
  createdAt: string;
}

export default function ExportsPage() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    try {
      setLoading(true);
      const res = await api.assets.getAssets();
      setAssets(res.assets || res || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load exports");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAsset(id: string) {
    if (!confirm("Are you sure you want to delete this export asset?")) return;

    try {
      await api.assets.deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a._id !== id));
      toast.success("Asset deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete asset");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Exports & Files</h1>
          <p className="mt-1 text-sm text-white/40">
            Download or manage all your generated reports and uploaded assets.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAssets} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-[#222] rounded-2xl bg-[#111]">
          <Download className="h-16 w-16 text-white/10" />
          <h3 className="mt-4 text-lg font-medium text-white/40">
            No exports or files yet
          </h3>
          <p className="mt-1 text-sm text-white/30 max-w-sm">
            Generate a document from the Projects menu, and your output files will appear here for download.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => (
            <Card key={asset._id} className="border-[#222] bg-[#111] hover:border-[#333] transition-colors">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{asset.originalFilename}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {asset.kind}
                      </Badge>
                      <span className="text-xs text-white/40">
                        {(asset.size / 1024).toFixed(1)} KB • {new Date(asset.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a href={api.assets.downloadUrl(asset._id)} target="_blank" rel="noreferrer">
                    <Button size="sm" className="gap-2">
                      <Download className="h-4 w-4" /> Download
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAsset(asset._id)}
                    className="text-white/30 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
