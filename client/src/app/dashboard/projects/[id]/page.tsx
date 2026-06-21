"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  FileText,
  Brain,
  GitBranch,
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface ProjectData {
  id: number;
  name: string;
  type: string;
  status: string;
  branch: string | null;
  semester: string | null;
  guideName: string | null;
  collegeName: string | null;
  description: string | null;
  files: any[];
  intelligence: any;
  knowledgeGraph: { nodes: any[]; edges: any[] };
  reportPlan: any;
  chapters: any[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchProject();
  }, [params.id]);

  async function fetchProject() {
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProject(json.data);
    } catch (error: any) {
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  }

  const statusColor = (status: string) => {
    const colors: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "destructive"> = {
      draft: "secondary",
      completed: "success",
      failed: "destructive",
      generating: "warning",
      analyzing: "primary",
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

  if (!project) {
    return (
      <div className="text-center py-24">
        <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="mt-4 text-lg font-medium text-white">Project not found</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/dashboard/projects")}
            className="mb-2 flex items-center gap-1 text-sm text-white/40 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </button>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <Badge variant={statusColor(project.status)}>{project.status}</Badge>
            <span className="text-sm text-white/40 capitalize">{project.type}</span>
            {project.branch && (
              <span className="text-sm text-white/40">{project.branch}</span>
            )}
            {project.semester && (
              <span className="text-sm text-white/40">
                Semester {project.semester}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="knowledge-graph">Knowledge Graph</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {project.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-white">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/60">{project.description}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white">
                  {project.guideName || "Not set"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  College
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white">
                  {project.collegeName || "Not set"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  Files Uploaded
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white">{project.files?.length || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  Chapters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white">
                  {project.chapters?.length || 0} generated
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="intelligence" className="space-y-6">
          {project.intelligence ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-white">Problem Statement</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white/60">
                    {project.intelligence.problemStatement || "Not extracted"}
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-white">Objectives</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {(project.intelligence.objectives as string[] || []).map(
                        (obj: string, i: number) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-white/60"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                            {obj}
                          </li>
                        )
                      )}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-white">Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {(project.intelligence.features as string[] || []).map(
                        (feat: string, i: number) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-white/60"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                            {feat}
                          </li>
                        )
                      )}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-white">Tech Stack</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {(project.intelligence.technologyStack as string[] || []).map(
                        (tech: string, i: number) => (
                          <Badge key={i} variant="primary">
                            {tech}
                          </Badge>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-white">Modules</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {(project.intelligence.modules as string[] || []).map(
                        (mod: string, i: number) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-white/60"
                          >
                            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-purple-500" />
                            {mod}
                          </li>
                        )
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Brain className="h-12 w-12 text-white/10" />
              <h3 className="mt-4 text-sm font-medium text-white/40">
                No intelligence extracted
              </h3>
              <p className="mt-1 text-xs text-white/30">
                Run the extraction process to analyze your project.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="chapters" className="space-y-4">
          {project.chapters && project.chapters.length > 0 ? (
            <div className="space-y-3">
              {project.chapters.map((chapter: any, index: number) => (
                <motion.div
                  key={chapter.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Card className="hover:border-white/20 transition-colors cursor-pointer">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-sm font-medium text-blue-400">
                          {chapter.number}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {chapter.title}
                          </p>
                          <p className="text-xs text-white/40">
                            {chapter.wordCount
                              ? `${chapter.wordCount} words`
                              : "Not generated"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          chapter.status === "completed" ? "success" : "warning"
                        }
                      >
                        {chapter.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-white/10" />
              <h3 className="mt-4 text-sm font-medium text-white/40">
                No chapters generated
              </h3>
              <p className="mt-1 text-xs text-white/30">
                Generate a report plan first.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="knowledge-graph" className="space-y-6">
          {project.knowledgeGraph &&
          project.knowledgeGraph.nodes.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-white text-sm">Nodes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-white">
                    {project.knowledgeGraph.nodes.length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-white text-sm">Edges</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-white">
                    {project.knowledgeGraph.edges.length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-white text-sm">
                    Node Types
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ...new Set(
                        project.knowledgeGraph.nodes.map((n: any) => n.type)
                      ),
                    ].map((type: any) => (
                      <Badge key={type} variant="primary">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GitBranch className="h-12 w-12 text-white/10" />
              <h3 className="mt-4 text-sm font-medium text-white/40">
                No knowledge graph
              </h3>
              <p className="mt-1 text-xs text-white/30">
                Extract intelligence first.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          {project.files && project.files.length > 0 ? (
            <div className="space-y-2">
              {project.files.map((file: any) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-lg border border-[#222] bg-[#111] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-white">{file.fileName}</p>
                      <p className="text-xs text-white/40 capitalize">
                        {file.fileType}
                        {file.fileSize &&
                          ` • ${(file.fileSize / 1024).toFixed(1)} KB`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{file.fileType}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Database className="h-12 w-12 text-white/10" />
              <h3 className="mt-4 text-sm font-medium text-white/40">
                No files uploaded
              </h3>
              <p className="mt-1 text-xs text-white/30">
                Upload project files to begin.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
