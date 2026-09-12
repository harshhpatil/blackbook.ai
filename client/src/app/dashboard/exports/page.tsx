"use client";

import { useState, useEffect } from "react";
import { Download, FileText, Trash2, Loader2, RefreshCw, FileCheck, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [activeFilter, setActiveFilter] = useState("all");

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
    if (!confirm("Are you sure you want to delete this asset?")) return;

    try {
      await api.assets.deleteAsset(id);
      setAssets((prev) => prev.filter((a) => a._id !== id));
      toast.success("Asset deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete asset");
    }
  }

  const filteredAssets = assets.filter((asset) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "reports") return asset.kind.startsWith("export");
    if (activeFilter === "templates") return asset.kind === "template";
    if (activeFilter === "sources") return asset.kind === "raw" || asset.kind === "source";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Exports & Deliverables</h1>
          <p className="mt-1 text-sm text-white/40">
            Download or manage your compiled Black Books, Word documents, templates, and datasets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAssets} className="gap-2 border-[#333]">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <Tabs value={activeFilter} onValueChange={setActiveFilter}>
          <TabsList className="bg-[#141414] border border-[#222]">
            <TabsTrigger value="all">All ({assets.length})</TabsTrigger>
            <TabsTrigger value="reports" className="text-emerald-400">
              Compiled Reports ({assets.filter((a) => a.kind.startsWith("export")).length})
            </TabsTrigger>
            <TabsTrigger value="templates">
              Templates ({assets.filter((a) => a.kind === "template").length})
            </TabsTrigger>
            <TabsTrigger value="sources">
              Sources ({assets.filter((a) => a.kind === "raw" || a.kind === "source").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-white/30" />
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-[#222] rounded-2xl bg-[#111]">
          <Download className="h-16 w-16 text-white/10" />
          <h3 className="mt-4 text-lg font-medium text-white/40">
            No files in this category
          </h3>
          <p className="mt-1 text-sm text-white/30 max-w-sm">
            Generate a document from your Projects menu, and your compiled Black Book Word and PDF files will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAssets.map((asset) => {
            const isExport = asset.kind.startsWith("export");
            return (
              <Card
                key={asset._id}
                className={`transition-colors ${
                  isExport
                    ? "border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-[#121614] to-[#111] hover:border-emerald-500/50"
                    : "border-[#222] bg-[#111] hover:border-[#333]"
                }`}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                        isExport
                          ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                          : "bg-blue-500/10 border border-blue-500/20 text-blue-400"
                      }`}
                    >
                      {isExport ? <FileCheck className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">
                          {asset.originalFilename}
                        </p>
                        {isExport && (
                          <Badge variant="success" className="text-[10px] uppercase font-mono">
                            Deliverable
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
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
                    <a
                      href={api.assets.downloadUrl(asset._id)}
                      download={asset.originalFilename}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button
                        size="sm"
                        className={`gap-2 font-medium ${
                          isExport
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                            : ""
                        }`}
                      >
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
            );
          })}
        </div>
      )}
    </div>
  );
}
