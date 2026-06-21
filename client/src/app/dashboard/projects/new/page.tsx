"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  Brain,
  FileText,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PROJECT_TYPES, BRANCHES, SEMESTERS, FILE_ACCEPT, MAX_FILE_SIZE } from "@/lib/constants";
import { formatBytes } from "@/lib/utils";

const steps = [
  { number: 1, title: "Project Details" },
  { number: 2, title: "Upload Files" },
  { number: 3, title: "Extraction" },
  { number: 4, title: "Review Intelligence" },
  { number: 5, title: "Report Plan" },
  { number: 6, title: "Generate" },
  { number: 7, title: "Review" },
  { number: 8, title: "Export" },
];

interface FormData {
  name: string;
  type: string;
  branch: string;
  semester: string;
  academicYear: string;
  guideName: string;
  collegeName: string;
  description: string;
  teamMembers: string[];
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    type: "blackbook",
    branch: "",
    semester: "",
    academicYear: new Date().getFullYear().toString(),
    guideName: "",
    collegeName: "",
    description: "",
    teamMembers: [""],
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const updateForm = (field: keyof FormData, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Step 1: Create project
  async function handleCreateProject() {
    if (!formData.name) {
      toast.error("Project name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: 1, // Will use auth later
          ...formData,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setProjectId(json.data.id);
      setCurrentStep(1);
      toast.success("Project created!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Upload files
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !projectId) return;

    setLoading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });

      const res = await fetch(`/api/projects/${projectId}/upload`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setUploadedFiles((prev) => [
        ...prev,
        ...Array.from(files).map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
        })),
      ]);
      toast.success(`${files.length} file(s) uploaded!`);
      setCurrentStep(2);
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Extract intelligence
  async function handleExtract() {
    if (!projectId) return;
    setLoading(true);
    setCurrentStep(2);

    // Animate progress
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 8, 90));
    }, 500);

    try {
      const res = await fetch(`/api/projects/${projectId}/intelligence`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      clearInterval(interval);
      setProgress(100);
      setTimeout(() => {
        setCurrentStep(3);
        setProgress(0);
      }, 500);
      toast.success("Project intelligence extracted!");
    } catch (error: any) {
      clearInterval(interval);
      setProgress(0);
      toast.error(error.message || "Extraction failed");
    } finally {
      setLoading(false);
    }
  }

  // Step 4: Generate report plan
  async function handleGeneratePlan() {
    if (!projectId) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/report-plan`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setCurrentStep(4);
      toast.success("Report plan generated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  }

  // Step 5: Generate chapters
  async function handleGenerateChapters() {
    if (!projectId) return;
    setLoading(true);
    setCurrentStep(5);

    const interval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 5, 85));
    }, 1000);

    try {
      const res = await fetch(`/api/projects/${projectId}/chapters`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      clearInterval(interval);
      setProgress(100);
      setTimeout(() => {
        setCurrentStep(6);
        setProgress(0);
      }, 500);
      toast.success("Chapters generated!");
    } catch (error: any) {
      clearInterval(interval);
      setProgress(0);
      toast.error(error.message || "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  // Navigate to project detail
  function handleViewProject() {
    if (projectId) {
      router.push(`/dashboard/projects/${projectId}`);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Back button */}
      <button
        onClick={() => {
          if (currentStep > 0) setCurrentStep(currentStep - 1);
          else router.push("/dashboard/projects");
        }}
        className="mb-6 flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {currentStep > 0 ? "Back" : "Back to Projects"}
      </button>

      <h1 className="text-2xl font-bold text-white">Create New Project</h1>
      <p className="mt-1 text-sm text-white/40">
        Generate complete MSBTE documentation in minutes.
      </p>

      {/* Steps indicator */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all ${
                    index < currentStep
                      ? "bg-blue-500 text-white"
                      : index === currentStep
                      ? "border-2 border-blue-500 bg-blue-500/20 text-blue-400"
                      : "border border-[#222] bg-transparent text-white/30"
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`mt-1 text-[10px] font-medium hidden sm:block ${
                    index <= currentStep ? "text-white/60" : "text-white/20"
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-2 h-[1px] w-6 sm:w-12 ${
                    index < currentStep ? "bg-blue-500" : "bg-[#222]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="mt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step 0: Project Details */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Project Name *</Label>
                    <Input
                      placeholder="e.g., Library Management System"
                      value={formData.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Project Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) => updateForm("type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Select
                      value={formData.branch}
                      onValueChange={(v) => updateForm("branch", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRANCHES.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Semester</Label>
                    <Select
                      value={formData.semester}
                      onValueChange={(v) => updateForm("semester", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select semester" />
                      </SelectTrigger>
                      <SelectContent>
                        {SEMESTERS.map((s) => (
                          <SelectItem key={s} value={s}>
                            Semester {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Academic Year</Label>
                    <Input
                      value={formData.academicYear}
                      onChange={(e) =>
                        updateForm("academicYear", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Guide Name</Label>
                    <Input
                      placeholder="Guide's full name"
                      value={formData.guideName}
                      onChange={(e) => updateForm("guideName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>College Name</Label>
                    <Input
                      placeholder="Your college name"
                      value={formData.collegeName}
                      onChange={(e) => updateForm("collegeName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Briefly describe your project..."
                      value={formData.description}
                      onChange={(e) => updateForm("description", e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleCreateProject}
                    disabled={loading || !formData.name}
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Next Step <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: Upload Files */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <Card className="border-dashed border-white/20">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Upload className="h-12 w-12 text-white/20" />
                    <h3 className="mt-4 text-lg font-medium text-white">
                      Upload Project Files
                    </h3>
                    <p className="mt-1 text-sm text-white/40 text-center max-w-md">
                      Upload PDF, DOCX, PPTX, images, source code, or provide a
                      GitHub repository URL. Max file size:{" "}
                      {formatBytes(MAX_FILE_SIZE)}.
                    </p>
                    <label className="mt-6 cursor-pointer">
                      <Button
                        variant="outline"
                        className="pointer-events-none"
                        asChild
                      >
                        <span>Choose Files</span>
                      </Button>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept=".pdf,.docx,.pptx,.txt,.md,.zip,.png,.jpg,.jpeg,.gif,.webp,.sql"
                        onChange={handleFileUpload}
                        disabled={loading}
                      />
                    </label>
                  </CardContent>
                </Card>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white/60">
                      Uploaded Files ({uploadedFiles.length})
                    </h4>
                    {uploadedFiles.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg border border-[#222] bg-[#111] px-4 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm text-white">{file.name}</p>
                            <p className="text-xs text-white/40">
                              {formatBytes(file.size)}
                            </p>
                          </div>
                        </div>
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => setCurrentStep(0)}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleExtract}
                    disabled={loading || uploadedFiles.length === 0}
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Extract & Analyze <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Extraction Progress */}
            {currentStep === 2 && (
              <div className="space-y-8 py-12">
                <div className="text-center">
                  <div className="inline-flex rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 p-4 text-white">
                    <Brain className="h-8 w-8" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-white">
                    Analyzing Your Project
                  </h3>
                  <p className="mt-2 text-sm text-white/40">
                    Our AI is extracting intelligence from your files...
                  </p>
                </div>
                <div className="mx-auto max-w-md">
                  <Progress value={progress} className="h-2" />
                  <p className="mt-2 text-center text-xs text-white/30">
                    {progress < 30
                      ? "Extracting content from files..."
                      : progress < 60
                      ? "Building project intelligence..."
                      : progress < 90
                      ? "Creating knowledge graph..."
                      : "Finalizing analysis..."}
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Review Intelligence */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Project Intelligence Review
                  </h3>
                  <p className="text-sm text-white/40">
                    Review the extracted project intelligence. You can edit
                    any section before proceeding.
                  </p>
                </div>

                <Button
                  onClick={handleGeneratePlan}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Generate Report Plan <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Step 4: Report Plan */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Report Plan
                  </h3>
                  <p className="text-sm text-white/40">
                    The report structure has been planned based on your project.
                  </p>
                </div>

                <Button
                  onClick={handleGenerateChapters}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Generate All Chapters <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Step 5: Generating */}
            {currentStep === 5 && (
              <div className="space-y-8 py-12">
                <div className="text-center">
                  <div className="inline-flex rounded-2xl bg-gradient-to-br from-green-500 to-blue-600 p-4 text-white">
                    <FileText className="h-8 w-8" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-white">
                    Generating Chapters
                  </h3>
                  <p className="mt-2 text-sm text-white/40">
                    Each chapter is being generated independently...
                  </p>
                </div>
                <div className="mx-auto max-w-md">
                  <Progress value={progress} className="h-2" />
                  <p className="mt-2 text-center text-xs text-white/30">
                    Generating chapters with AI...
                  </p>
                </div>
              </div>
            )}

            {/* Step 6: Review */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Report Generated!
                  </h3>
                  <p className="text-sm text-white/40">
                    All chapters have been generated. Review and export.
                  </p>
                </div>

                <Button onClick={handleViewProject} className="gap-2">
                  View Full Report <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
