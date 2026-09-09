"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Trash2,
  Edit2,
  Check,
  XCircle,
  Clock,
  Sparkles,
  Database,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

interface ProjectDetailData {
  project: {
    _id: string;
    title: string;
    status: "draft" | "pending" | "processing" | "completed" | "failed";
    contentData?: Record<string, any>;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
  };
  assets: Array<{
    _id: string;
    originalFilename: string;
    kind: string;
    contentType: string;
    size: number;
    createdAt: string;
  }>;
  generationJobs: Array<{
    _id: string;
    status: string;
    error?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const router = useRouter();

  const [data, setData] = useState<ProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  useEffect(() => {
    const status = data?.project.status;
    if (status !== "pending" && status !== "processing") return;

    const interval = setInterval(() => {
      fetchProjectDetails(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [data?.project.status, projectId]);

  async function fetchProjectDetails(showLoading = true) {
    try {
      if (showLoading) setLoading(true);
      const res = await api.projects.getProjectDetails(projectId);
      setData(res);
      if (res?.project?.title) {
        setNewTitle(res.project.title);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load project details");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveTitle() {
    if (!newTitle.trim() || !data?.project) return;
    try {
      const res = await api.projects.updateProject(projectId, newTitle.trim());
      setData((prev) =>
        prev
          ? {
              ...prev,
              project: { ...prev.project, title: res.project?.title || newTitle.trim() },
            }
          : null
      );
      setIsEditingTitle(false);
      toast.success("Project title updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update title");
    }
  }

  async function handleDeleteProject() {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await api.projects.deleteProject(projectId);
      toast.success("Project deleted");
      router.push("/dashboard/projects");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete project");
    }
  }

  const statusColor = (status: string) => {
    const colors: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "destructive"> = {
      draft: "secondary",
      completed: "success",
      failed: "destructive",
      processing: "warning",
    };
    return colors[status] || "default";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-white/30" />
      </div>
    );
  }

  if (!data || !data.project) {
    return (
      <div className="text-center py-24 space-y-4">
        <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-lg font-medium text-white">Project not found</h2>
        <Button onClick={() => router.push("/dashboard/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const { project, assets, generationJobs } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/dashboard/projects")}
            className="mb-2 flex items-center gap-1 text-sm text-white/40 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </button>

          {isEditingTitle ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-xl font-bold bg-[#161616]"
              />
              <Button size="sm" onClick={handleSaveTitle}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingTitle(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{project.title}</h1>
              <button
                onClick={() => setIsEditingTitle(true)}
                className="text-white/30 hover:text-white p-1"
                title="Edit title"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <Badge variant={statusColor(project.status)}>{project.status}</Badge>
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Updated {new Date(project.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteProject}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {project.lastError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <p className="font-semibold">Last Error:</p>
          <p className="mt-1 text-xs opacity-90">{project.lastError}</p>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assets">Assets ({assets.length})</TabsTrigger>
          <TabsTrigger value="jobs">Generation Jobs ({generationJobs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  Total Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-white">{assets.length}</p>
              </CardContent>
            </Card>

            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  Generation Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-white">{generationJobs.length}</p>
              </CardContent>
            </Card>

            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  Project Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={statusColor(project.status)} className="capitalize text-sm px-3 py-1">
                  {project.status}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          {assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-[#222] rounded-xl bg-[#111]">
              <Database className="h-12 w-12 text-white/10" />
              <h3 className="mt-4 text-sm font-medium text-white/40">No assets uploaded yet</h3>
            </div>
          ) : (
            <div className="space-y-2">
              {assets.map((asset) => (
                <div
                  key={asset._id}
                  className="flex items-center justify-between rounded-xl border border-[#222] bg-[#111] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{asset.originalFilename}</p>
                      <p className="text-xs text-white/40 capitalize">
                        {asset.kind} • {(asset.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>

                  <a
                    href={api.assets.downloadUrl(asset._id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" /> Download
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          {generationJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-[#222] rounded-xl bg-[#111]">
              <Sparkles className="h-12 w-12 text-white/10" />
              <h3 className="mt-4 text-sm font-medium text-white/40">No generation jobs run yet</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {generationJobs.map((job) => (
                <Card key={job._id} className="border-[#222] bg-[#111]">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-white/40" />
                      <div>
                        <p className="text-xs font-mono text-white/80">Job ID: {job._id}</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {new Date(job.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusColor(job.status)}>{job.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
