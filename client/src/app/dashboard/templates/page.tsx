"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  FileText,
  ScrollText,
  ClipboardList,
  GraduationCap,
  FileSpreadsheet,
  Upload,
  Brain,
  Sparkles,
  Loader2,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

const defaultTemplates = [
  {
    name: "MSBTE Blackbook",
    description: "Complete MSBTE blackbook with standard diploma project structure",
    icon: BookOpen,
    pages: "60-80 pages",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    name: "Project Report",
    description: "Comprehensive engineering project report format",
    icon: FileText,
    pages: "40-60 pages",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    name: "Research Journal",
    description: "Academic research paper & IEEE journal template",
    icon: ScrollText,
    pages: "30-50 pages",
    gradient: "from-green-500 to-green-600",
  },
  {
    name: "Internship Report",
    description: "Professional industrial training documentation",
    icon: ClipboardList,
    pages: "40-50 pages",
    gradient: "from-orange-500 to-orange-600",
  },
  {
    name: "Seminar Presentation",
    description: "Technical seminar report and abstract",
    icon: GraduationCap,
    pages: "30-40 pages",
    gradient: "from-pink-500 to-pink-600",
  },
  {
    name: "Lab Practical Manual",
    description: "Lab manual format with experiments & code listings",
    icon: FileSpreadsheet,
    pages: "50-70 pages",
    gradient: "from-cyan-500 to-cyan-600",
  },
];

export default function TemplatesPage() {
  const [openTrainer, setOpenTrainer] = useState(false);
  const [projects, setProjects] = useState<Array<{ _id: string; title: string }>>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [templateName, setTemplateName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sourceAssetId, setSourceAssetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "mapping" | "success">("upload");

  // Editable mappings: record of fieldName -> originalText
  const [mappings, setMappings] = useState<Array<{ fieldName: string; originalText: string }>>([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await api.projects.getProjects();
      const list = res.projects || [];
      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId(list[0]._id);
      }
    } catch {
      // Ignore project fetch errors
    }
  }

  async function handleAnalyzeFile() {
    if (!selectedProjectId) {
      toast.error("Please select a project workspace first");
      return;
    }
    if (!file) {
      toast.error("Please choose a filled DOCX file");
      return;
    }

    setLoading(true);
    try {
      const res = await api.templateEngine.trainAnalyze(selectedProjectId, file);
      setSourceAssetId(res.assetId);

      const rawSuggestions = res.suggestions || [];
      if (Array.isArray(rawSuggestions)) {
        setMappings(
          rawSuggestions.map((s: any) => ({
            fieldName: s.fieldName || s.field || "VARIABLE",
            originalText: s.originalText || s.value || "",
          }))
        );
      } else if (typeof rawSuggestions === "object") {
        setMappings(
          Object.entries(rawSuggestions).map(([fieldName, originalText]) => ({
            fieldName,
            originalText: String(originalText),
          }))
        );
      }

      setStep("mapping");
      toast.success(res.message || "Document analyzed!");
    } catch (error: any) {
      toast.error(error.message || "Failed to analyze document");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmTraining() {
    if (!selectedProjectId || !sourceAssetId) return;

    const approvedMapping: Record<string, string> = {};
    mappings.forEach((m) => {
      if (m.fieldName.trim() && m.originalText.trim()) {
        approvedMapping[m.fieldName.trim()] = m.originalText.trim();
      }
    });

    if (Object.keys(approvedMapping).length === 0) {
      toast.error("At least one valid field mapping is required");
      return;
    }

    setLoading(true);
    try {
      const res = await api.templateEngine.trainConfirm({
        projectId: selectedProjectId,
        sourceAssetId,
        approvedMapping,
        templateName: templateName || `Trained Template ${Date.now()}`,
      });

      setStep("success");
      toast.success(res.message || "Template trained and saved!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save trained template");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Templates</h1>
          <p className="mt-1 text-sm text-white/40">
            Choose a standard template format or train your own AI template.
          </p>
        </div>

        <Dialog open={openTrainer} onOpenChange={setOpenTrainer}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500">
              <Sparkles className="h-4 w-4" /> AI Template Trainer
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[#222] bg-[#111] text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" /> Train Custom Template
              </DialogTitle>
            </DialogHeader>

            {step === "upload" && (
              <div className="space-y-4 py-2">
                <p className="text-xs text-white/60">
                  Upload a completed sample document (.docx). Gemini AI will detect fixed text and convert variable sections into reusable placeholders.
                </p>

                <div className="space-y-2">
                  <Label>Select Project Workspace</Label>
                  {projects.length === 0 ? (
                    <p className="text-xs text-amber-400">Please create a project first</p>
                  ) : (
                    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger className="bg-[#161616]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Template Name (Optional)</Label>
                  <Input
                    placeholder="e.g. Computer Dept MSBTE Template"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="bg-[#161616]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sample Filled Document (.docx)</Label>
                  <Input
                    type="file"
                    accept=".docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="bg-[#161616] cursor-pointer"
                  />
                </div>

                <Button
                  onClick={handleAnalyzeFile}
                  disabled={loading || !file || !selectedProjectId}
                  className="w-full gap-2 mt-4"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  Analyze with AI
                </Button>
              </div>
            )}

            {step === "mapping" && (
              <div className="space-y-4 py-2">
                <p className="text-xs text-white/60">
                  Review the detected variables below. Customize placeholder names before saving your template.
                </p>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {mappings.map((m, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        value={m.fieldName}
                        onChange={(e) => {
                          const updated = [...mappings];
                          updated[i].fieldName = e.target.value;
                          setMappings(updated);
                        }}
                        placeholder="PLACEHOLDER_NAME"
                        className="bg-[#161616] text-xs font-mono w-1/2"
                      />
                      <Input
                        value={m.originalText}
                        onChange={(e) => {
                          const updated = [...mappings];
                          updated[i].originalText = e.target.value;
                          setMappings(updated);
                        }}
                        placeholder="Sample text"
                        className="bg-[#161616] text-xs w-1/2 text-white/60"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setStep("upload")} className="w-1/2">
                    Back
                  </Button>
                  <Button onClick={handleConfirmTraining} disabled={loading} className="w-1/2 gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Save Template
                  </Button>
                </div>
              </div>
            )}

            {step === "success" && (
              <div className="py-6 text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <h3 className="text-lg font-semibold text-white">Template Created & Saved!</h3>
                <p className="text-xs text-white/60">
                  Your custom DOCX template is now available for document generation jobs.
                </p>
                <Button onClick={() => setOpenTrainer(false)} className="w-full">
                  Done
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid of default templates */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {defaultTemplates.map((template, index) => (
          <motion.div
            key={template.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="h-full transition-all hover:border-white/20 hover:bg-[#161616] border-[#222] bg-[#111]">
              <CardHeader>
                <div
                  className={`inline-flex rounded-xl bg-gradient-to-br ${template.gradient} p-3 text-white w-fit`}
                >
                  <template.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-white mt-2">{template.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-white/40">{template.description}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{template.pages}</Badge>
                  <Badge variant="primary">AI Compatible</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
