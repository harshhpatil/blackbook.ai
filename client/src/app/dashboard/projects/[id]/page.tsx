"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  RefreshCw,
  Copy,
  CheckCheck,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileCheck,
  AlertCircle,
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
    downloads?: {
      docxUrl?: string;
      pdfUrl?: string;
    };
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
    result?: {
      docxUrl?: string;
      pdfUrl?: string;
    };
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
  const [regenerating, setRegenerating] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({
    "preliminaries": true,
    "ch1": true,
  });

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

  async function handleRegenerate() {
    if (!data) return;
    const templateAsset = data.assets.find((a) => a.kind === "template");
    const rawAsset = data.assets.find((a) => a.kind === "raw" || a.kind === "source");

    if (!templateAsset || !rawAsset) {
      toast.error("Need both template and source data assets to regenerate");
      return;
    }

    try {
      setRegenerating(true);
      toast.info("Triggering new document generation job...");
      await api.templateEngine.generate(projectId, templateAsset._id, rawAsset._id);
      toast.success("Document generation started!");
      fetchProjectDetails(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to regenerate document");
    } finally {
      setRegenerating(false);
    }
  }

  function handleCopy(text: string, key: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Section copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function toggleChapter(chapterKey: string) {
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterKey]: !prev[chapterKey],
    }));
  }

  const statusColor = (status: string) => {
    const colors: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "destructive"> = {
      draft: "secondary",
      completed: "success",
      failed: "destructive",
      processing: "warning",
      pending: "warning",
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
  const content = project.contentData || {};
  const contentKeys = Object.keys(content);

  // Asset categorizations
  const compiledDocxAsset = assets.find((a) => a.kind === "export-docx");
  const compiledPdfAsset = assets.find((a) => a.kind === "export-pdf");
  const templateAsset = assets.find((a) => a.kind === "template");
  const rawAsset = assets.find((a) => a.kind === "raw" || a.kind === "source");

  // Determine direct download URLs
  const docxDownloadUrl = compiledDocxAsset
    ? api.assets.downloadUrl(compiledDocxAsset._id)
    : project.downloads?.docxUrl || null;

  const pdfDownloadUrl = compiledPdfAsset
    ? api.assets.downloadUrl(compiledPdfAsset._id)
    : project.downloads?.pdfUrl || null;

  const isCompleted = project.status === "completed" || !!docxDownloadUrl;

  // Chapter structure mapping for academic report
  const chapterSections = [
    {
      id: "preliminaries",
      title: "Preliminaries & Metadata",
      badge: "Front Matter",
      fields: [
        { key: "project_title", label: "Project Title" },
        { key: "academic_year", label: "Academic Year" },
        { key: "department", label: "Department / Branch" },
        { key: "supervisor_name", label: "Project Guide / Supervisor" },
        { key: "student1_name", label: "Candidate 1" },
        { key: "abstract", label: "Abstract" },
        { key: "acknowledgement", label: "Acknowledgement" },
      ],
    },
    {
      id: "ch1",
      title: "Chapter 1: Introduction & Problem Definition",
      badge: "Chapter 1",
      fields: [
        { key: "ch1_1_background", label: "1.1 Background & Motivation" },
        { key: "ch1_2_problem_statement", label: "1.2 Problem Statement" },
      ],
    },
    {
      id: "ch2",
      title: "Chapter 2: Literature Survey",
      badge: "Chapter 2",
      fields: [
        { key: "ch2_1_existing_systems", label: "2.1 Review of Existing Systems" },
        { key: "ch2_2_limitations", label: "2.2 Limitations of Existing Approaches" },
        { key: "ch2_3_need_for_proposed", label: "2.3 Need for Proposed System" },
      ],
    },
    {
      id: "ch3",
      title: "Chapter 3: System Objectives & Scope",
      badge: "Chapter 3",
      fields: [
        { key: "ch3_1_objectives", label: "3.1 Project Objectives" },
        { key: "ch3_2_functional_scope", label: "3.2 Functional Scope & Boundaries" },
      ],
    },
    {
      id: "ch4",
      title: "Chapter 4: Methodology & Workflow",
      badge: "Chapter 4",
      fields: [
        { key: "ch4_1_data_collection", label: "4.1 Data Collection & Input Processing" },
        { key: "ch4_2_face_encoding", label: "4.2 Feature Extraction / Encoding" },
        { key: "ch4_3_detection_recognition", label: "4.3 Core Algorithms & Model Execution" },
        { key: "ch4_4_attendance_marking", label: "4.4 Business Logic & Automation Flow" },
        { key: "ch4_5_report_generation", label: "4.5 Output Generation & Telemetry" },
      ],
    },
    {
      id: "ch5",
      title: "Chapter 5: System Architecture & Technical Design",
      badge: "Chapter 5",
      fields: [
        { key: "ch5_1_architecture", label: "5.1 Overall System Architecture" },
        { key: "ch5_2_working", label: "5.2 System Working & Execution Pipeline" },
        { key: "ch5_3_modules", label: "5.3 Module Breakdown & Specifications" },
        { key: "ch5_4_tech_stack", label: "5.4 Technology Stack & Frameworks" },
      ],
    },
    {
      id: "ch6",
      title: "Chapter 6: Results & Practical Applications",
      badge: "Chapter 6",
      fields: [
        { key: "ch6_1_results", label: "6.1 Experimental Results & Performance" },
        { key: "ch6_2_applications", label: "6.2 Real-World Applications" },
      ],
    },
    {
      id: "ch7",
      title: "Chapter 7: Limitations & Future Enhancements",
      badge: "Chapter 7",
      fields: [
        { key: "ch7_1_limitations", label: "7.1 System Limitations" },
        { key: "ch7_2_future_scope", label: "7.2 Future Scope & Research Directions" },
      ],
    },
    {
      id: "ch8",
      title: "Chapter 8: Conclusion & Summary",
      badge: "Chapter 8",
      fields: [{ key: "ch8_conclusion", label: "8.1 Concluding Remarks" }],
    },
    {
      id: "ch9",
      title: "Chapter 9: Academic References & Bibliography",
      badge: "Chapter 9",
      fields: [{ key: "ch9_references", label: "9.1 Academic & Technical Citations" }],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/dashboard/projects")}
            className="mb-2 flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors"
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
            <Badge variant={statusColor(project.status)} className="capitalize">
              {project.status}
            </Badge>
            <span className="text-xs text-white/40 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Updated {new Date(project.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {templateAsset && rawAsset && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || project.status === "processing"}
              className="gap-2 border-[#333] hover:border-white/30"
            >
              {regenerating || project.status === "processing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Regenerate
            </Button>
          )}

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

      {/* Hero Banner: Compiled Document Outputs */}
      {isCompleted && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-[#121814] to-[#111] p-6 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <FileCheck className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  Academic Black Book Compiled & Ready
                </h2>
                <Badge variant="success" className="text-[11px]">
                  Ready for Download
                </Badge>
              </div>
              <p className="text-sm text-white/70 max-w-2xl">
                Your report has been filled with AI-synthesized chapters, embedded technical diagrams, and formatted to academic submission standards.
              </p>
              {compiledDocxAsset && (
                <p className="text-xs text-emerald-400/80 font-mono">
                  Artifact: {compiledDocxAsset.originalFilename} • {(compiledDocxAsset.size / 1024).toFixed(1)} KB
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {docxDownloadUrl && (
                <a
                  href={docxDownloadUrl}
                  download={`${project.title || "blackbook"}.docx`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-900/30">
                    <Download className="h-4 w-4" />
                    Download Word DOCX
                  </Button>
                </a>
              )}

              {pdfDownloadUrl ? (
                <a
                  href={pdfDownloadUrl}
                  download={`${project.title || "blackbook"}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" className="gap-2 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10">
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </a>
              ) : (
                <span className="text-xs text-white/40 italic bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                  PDF format enabled via Docker
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Processing Status Banner */}
      {(project.status === "processing" || project.status === "pending") && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-200 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-amber-400 shrink-0" />
          <div>
            <p className="font-semibold text-amber-300">
              Generating Black Book & Technical Diagrams...
            </p>
            <p className="text-xs text-amber-200/70 mt-0.5">
              Gemini AI is parsing your source documents, synthesizing IEEE-standard chapters, and rendering diagrams. This page updates automatically.
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {project.lastError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Last Error</p>
            <p className="mt-1 text-xs opacity-90">{project.lastError}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#141414] border border-[#222]">
          <TabsTrigger value="overview" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-1.5">
            <Database className="h-4 w-4" /> Assets ({assets.length})
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-1.5">
            <Sparkles className="h-4 w-4" /> Generation Jobs ({generationJobs.length})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 pt-2">
          {/* Key Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  Compiled Deliverables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-emerald-400">
                    {compiledDocxAsset ? "DOCX Ready" : isCompleted ? "Compiled" : "Pending"}
                  </p>
                </div>
                <p className="text-xs text-white/40 mt-1">
                  {compiledDocxAsset ? `${(compiledDocxAsset.size / 1024).toFixed(1)} KB formatted` : "Awaiting run"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  Academic Sections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-white">
                  {contentKeys.length > 0 ? contentKeys.length : "0"}
                </p>
                <p className="text-xs text-white/40 mt-1">
                  Synthesized AI fields
                </p>
              </CardContent>
            </Card>

            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  Total Project Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-white">{assets.length}</p>
                <p className="text-xs text-white/40 mt-1">
                  Templates, raw data & exports
                </p>
              </CardContent>
            </Card>

            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-white/40">
                  Execution Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={statusColor(project.status)} className="capitalize text-sm px-3 py-0.5">
                  {project.status}
                </Badge>
                <p className="text-xs text-white/40 mt-1.5">
                  Updated {new Date(project.updatedAt).toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Academic Content Chapters Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-400" />
                  Generated Academic Chapters & Content Preview
                </h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Review and copy any chapter text or metadata generated by the AI engine.
                </p>
              </div>

              {contentKeys.length > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 border-[#333]"
                    onClick={() => {
                      const allOpen = Object.fromEntries(
                        chapterSections.map((c) => [c.id, true])
                      );
                      setExpandedChapters(allOpen);
                    }}
                  >
                    Expand All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 border-[#333]"
                    onClick={() => setExpandedChapters({})}
                  >
                    Collapse All
                  </Button>
                </div>
              )}
            </div>

            {contentKeys.length === 0 ? (
              <Card className="border-[#222] bg-[#111] text-center p-8">
                <p className="text-sm text-white/40">
                  No generated chapter content yet. Trigger a generation job to populate academic chapters.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {chapterSections.map((chapter) => {
                  const populatedFields = chapter.fields.filter(
                    (f) => content[f.key] && String(content[f.key]).trim()
                  );

                  if (populatedFields.length === 0) return null;
                  const isExpanded = !!expandedChapters[chapter.id];

                  return (
                    <Card
                      key={chapter.id}
                      className="border-[#222] bg-[#111] overflow-hidden transition-colors"
                    >
                      <div
                        onClick={() => toggleChapter(chapter.id)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] select-none"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {chapter.badge}
                          </Badge>
                          <h4 className="text-sm font-semibold text-white">
                            {chapter.title}
                          </h4>
                          <span className="text-xs text-white/30">
                            ({populatedFields.length} {populatedFields.length === 1 ? "section" : "sections"})
                          </span>
                        </div>

                        <div className="text-white/40">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="border-t border-[#1c1c1c] bg-[#0c0c0c] p-4 space-y-4"
                          >
                            {populatedFields.map((field) => {
                              const text = String(content[field.key] || "").trim();
                              return (
                                <div
                                  key={field.key}
                                  className="rounded-xl border border-[#222] bg-[#141414] p-3.5 space-y-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-blue-400">
                                      {field.label}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs gap-1 text-white/40 hover:text-white"
                                      onClick={() => handleCopy(text, field.key)}
                                    >
                                      {copiedKey === field.key ? (
                                        <>
                                          <CheckCheck className="h-3.5 w-3.5 text-green-400" />
                                          <span className="text-green-400">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3.5 w-3.5" />
                                          Copy
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                  <p className="text-xs leading-relaxed text-white/80 whitespace-pre-line font-sans">
                                    {text}
                                  </p>
                                </div>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets" className="space-y-4 pt-2">
          {assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-[#222] rounded-xl bg-[#111]">
              <Database className="h-12 w-12 text-white/10" />
              <h3 className="mt-4 text-sm font-medium text-white/40">
                No assets uploaded yet
              </h3>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Compiled Outputs Group */}
              {assets.some((a) => a.kind.startsWith("export")) && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                    Compiled Documents & Outputs
                  </h4>
                  {assets
                    .filter((a) => a.kind.startsWith("export"))
                    .map((asset) => (
                      <div
                        key={asset._id}
                        className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 to-[#111] px-4 py-3.5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <FileCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {asset.originalFilename}
                            </p>
                            <p className="text-xs text-white/40">
                              <span className="text-emerald-400 font-medium capitalize">
                                {asset.kind.replace("export-", "").toUpperCase()}
                              </span>{" "}
                              • {(asset.size / 1024).toFixed(1)} KB •{" "}
                              {new Date(asset.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <a
                          href={api.assets.downloadUrl(asset._id)}
                          download={asset.originalFilename}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button
                            size="sm"
                            className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                          >
                            <Download className="h-4 w-4" /> Download
                          </Button>
                        </a>
                      </div>
                    ))}
                </div>
              )}

              {/* Source & Template Inputs Group */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                  Source & Template Files
                </h4>
                {assets
                  .filter((a) => !a.kind.startsWith("export"))
                  .map((asset) => (
                    <div
                      key={asset._id}
                      className="flex items-center justify-between rounded-xl border border-[#222] bg-[#111] px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {asset.originalFilename}
                          </p>
                          <p className="text-xs text-white/40 capitalize">
                            {asset.kind} • {(asset.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>

                      <a
                        href={api.assets.downloadUrl(asset._id)}
                        download={asset.originalFilename}
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
            </div>
          )}
        </TabsContent>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-4 pt-2">
          {generationJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-[#222] rounded-xl bg-[#111]">
              <Sparkles className="h-12 w-12 text-white/10" />
              <h3 className="mt-4 text-sm font-medium text-white/40">
                No generation jobs run yet
              </h3>
            </div>
          ) : (
            <div className="space-y-3">
              {generationJobs.map((job) => (
                <Card key={job._id} className="border-[#222] bg-[#111]">
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-white/40" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-mono text-white/80">
                            Job ID: {job._id}
                          </p>
                          <Badge variant={statusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-white/40 mt-1">
                          Executed on {new Date(job.createdAt).toLocaleString()}
                        </p>
                        {job.error && (
                          <p className="text-xs text-red-400 mt-1">
                            Error: {job.error}
                          </p>
                        )}
                      </div>
                    </div>

                    {job.result?.docxUrl && (
                      <div className="flex items-center gap-2">
                        <a
                          href={job.result.docxUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                            <Download className="h-3.5 w-3.5 text-emerald-400" />
                            Download Result (.docx)
                          </Button>
                        </a>
                        {job.result.pdfUrl && (
                          <a
                            href={job.result.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                              <Download className="h-3.5 w-3.5 text-blue-400" />
                              Download Result (.pdf)
                            </Button>
                          </a>
                        )}
                      </div>
                    )}
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
