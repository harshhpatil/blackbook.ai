"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  FileText,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

const steps = [
  { number: 1, title: "Create Workspace" },
  { number: 2, title: "Upload Source Data" },
  { number: 3, title: "Select Template" },
  { number: 4, title: "Generate Document" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  // Upload state
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateAssetId, setTemplateAssetId] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);

  // Step 1: Create Project
  async function handleCreateProject() {
    if (!title.trim()) {
      toast.error("Project title is required");
      return;
    }

    setLoading(true);
    try {
      const res = await api.projects.createProject(title.trim());
      const newProjectId = res.project?._id || res._id;
      setProjectId(newProjectId);
      setCurrentStep(1);
      toast.success("Project workspace created!");
    } catch (error: any) {
      toast.error(error.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Upload Source Data
  async function handleUploadSource(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setSourceFile(file);
    setLoading(true);

    try {
      const res = await api.templateEngine.uploadRawData(projectId, file);
      setSourceAssetId(res.assetId);
      toast.success("Source document uploaded successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload source file");
      setSourceFile(null);
    } finally {
      setLoading(false);
    }
  }

  // Step 3: Upload Template DOCX
  async function handleUploadTemplate(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    if (!file.name.endsWith(".docx")) {
      toast.error("Template must be a .docx file");
      return;
    }

    setTemplateFile(file);
    setLoading(true);

    try {
      const res = await api.templateEngine.uploadTemplate(projectId, file);
      setTemplateAssetId(res.assetId);
      if (res.fields) {
        setExtractedFields(res.fields);
      }
      toast.success(res.message || "Template uploaded successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload template");
      setTemplateFile(null);
    } finally {
      setLoading(false);
    }
  }

  // Step 4: Trigger AI Generation
  async function handleGenerate() {
    if (!projectId || !templateAssetId || !sourceAssetId) {
      toast.error("Missing template or source data file");
      return;
    }

    setLoading(true);

    try {
      const res = await api.templateEngine.generate(projectId, templateAssetId, sourceAssetId);
      setJobId(res.generationJobId);
      toast.success("Document generation job queued!");
      setCurrentStep(3);
    } catch (error: any) {
      toast.error(error.message || "Failed to queue document generation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back button */}
      <button
        onClick={() => {
          if (currentStep > 0 && currentStep < 3) setCurrentStep(currentStep - 1);
          else router.push("/dashboard/projects");
        }}
        className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {currentStep > 0 && currentStep < 3 ? "Back" : "Back to Projects"}
      </button>

      <div>
        <h1 className="text-2xl font-bold text-white">Create New Project</h1>
        <p className="mt-1 text-sm text-white/40">
          Upload raw source data and a DOCX template to generate your document with AI.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="py-4">
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
                  {index < currentStep ? <Check className="h-4 w-4" /> : step.number}
                </div>
                <span
                  className={`mt-1.5 text-[11px] font-medium hidden sm:block ${
                    index <= currentStep ? "text-white/80" : "text-white/20"
                  }`}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-3 h-[1px] w-8 sm:w-16 ${
                    index < currentStep ? "bg-blue-500" : "bg-[#222]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {/* Step 0: Create Project */}
            {currentStep === 0 && (
              <Card className="border-[#222] bg-[#111]">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label className="text-white/80 font-medium">Project Title *</Label>
                    <Input
                      placeholder="e.g., Library Management System Report"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-[#161616]"
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleCreateProject}
                      disabled={loading || !title.trim()}
                      className="gap-2"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Next: Upload Source Data <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Upload Source Data */}
            {currentStep === 1 && (
              <Card className="border-[#222] bg-[#111]">
                <CardContent className="p-6 space-y-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-white">Upload Source Data</h3>
                    <p className="text-sm text-white/40 max-w-md mx-auto">
                      Upload your project draft, raw text, PDF, or DOCX containing your research or code notes.
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-[#222] hover:border-blue-500/50 rounded-2xl p-8 text-center transition-colors">
                    {sourceFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="h-8 w-8 text-blue-400" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-white">{sourceFile.name}</p>
                          <p className="text-xs text-white/40">{(sourceFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-green-500 ml-2" />
                      </div>
                    ) : (
                      <label className="cursor-pointer space-y-3 flex flex-col items-center">
                        <Upload className="h-10 w-10 text-white/30" />
                        <div>
                          <p className="text-sm font-medium text-white">Click to upload source document</p>
                          <p className="text-xs text-white/40 mt-1">Supports .pdf, .docx, .txt</p>
                        </div>
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt"
                          onChange={handleUploadSource}
                          className="hidden"
                          disabled={loading}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => setCurrentStep(0)}>
                      Back
                    </Button>
                    <Button
                      onClick={() => setCurrentStep(2)}
                      disabled={loading || !sourceAssetId}
                      className="gap-2"
                    >
                      Next: Upload Template <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Upload Template */}
            {currentStep === 2 && (
              <Card className="border-[#222] bg-[#111]">
                <CardContent className="p-6 space-y-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold text-white">Upload DOCX Template</h3>
                    <p className="text-sm text-white/40 max-w-md mx-auto">
                      Upload a Word (.docx) template containing {"{{placeholders}}"} (e.g. {"{{ABSTRACT}}"}, {"{{INTRODUCTION}}"}).
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-[#222] hover:border-blue-500/50 rounded-2xl p-8 text-center transition-colors">
                    {templateFile ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-3">
                          <FileText className="h-8 w-8 text-blue-400" />
                          <div className="text-left">
                            <p className="text-sm font-medium text-white">{templateFile.name}</p>
                            <p className="text-xs text-white/40">{(templateFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <CheckCircle2 className="h-5 w-5 text-green-500 ml-2" />
                        </div>

                        {extractedFields.length > 0 && (
                          <div className="rounded-xl bg-[#161616] p-4 text-left border border-[#222]">
                            <p className="text-xs font-semibold text-white/60 mb-2">
                              Extracted Placeholders ({extractedFields.length}):
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {extractedFields.map((field, i) => (
                                <span
                                  key={i}
                                  className="text-[11px] rounded bg-blue-500/10 text-blue-400 px-2 py-0.5 border border-blue-500/20 font-mono"
                                >
                                  {"{{"}
                                  {field}
                                  {"}}"}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <label className="cursor-pointer space-y-3 flex flex-col items-center">
                        <Upload className="h-10 w-10 text-white/30" />
                        <div>
                          <p className="text-sm font-medium text-white">Click to upload .docx template</p>
                          <p className="text-xs text-white/40 mt-1">Requires Microsoft Word (.docx) format</p>
                        </div>
                        <input
                          type="file"
                          accept=".docx"
                          onChange={handleUploadTemplate}
                          className="hidden"
                          disabled={loading}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                      Back
                    </Button>
                    <Button
                      onClick={handleGenerate}
                      disabled={loading || !templateAssetId}
                      className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Generate Document with AI
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Generation Queued */}
            {currentStep === 3 && (
              <Card className="border-[#222] bg-[#111] text-center p-8 space-y-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white mx-auto shadow-lg">
                  <Sparkles className="h-8 w-8 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Document Generation Queued!</h3>
                  <p className="text-sm text-white/40 mt-2 max-w-md mx-auto">
                    Gemini AI is parsing your source documents and filling your DOCX template. You can track progress in your project dashboard.
                  </p>
                </div>
                <div className="pt-4 flex justify-center gap-4">
                  <Button
                    onClick={() => router.push(`/dashboard/projects/${projectId}`)}
                    className="gap-2"
                  >
                    Go to Project Dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
