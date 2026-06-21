"use client";

import { motion } from "framer-motion";
import { BookOpen, FileText, FileSpreadsheet, GraduationCap, ClipboardList, ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const templates = [
  {
    name: "Blackbook",
    description: "Complete MSBTE blackbook with all standard chapters",
    icon: BookOpen,
    pages: "60-80 pages",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    name: "Project Report",
    description: "Comprehensive project report with technical details",
    icon: FileText,
    pages: "40-60 pages",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    name: "Journal",
    description: "Academic journal format with research components",
    icon: ScrollText,
    pages: "30-50 pages",
    gradient: "from-green-500 to-green-600",
  },
  {
    name: "Internship Report",
    description: "Professional internship documentation",
    icon: ClipboardList,
    pages: "40-50 pages",
    gradient: "from-orange-500 to-orange-600",
  },
  {
    name: "Seminar Report",
    description: "Seminar presentation documentation",
    icon: GraduationCap,
    pages: "30-40 pages",
    gradient: "from-pink-500 to-pink-600",
  },
  {
    name: "Lab Manual",
    description: "Practical lab documentation with experiments",
    icon: FileSpreadsheet,
    pages: "50-70 pages",
    gradient: "from-cyan-500 to-cyan-600",
  },
];

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Templates</h1>
        <p className="mt-1 text-sm text-white/40">
          Choose a template to start your documentation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template, index) => (
          <motion.div
            key={template.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="h-full transition-all hover:border-white/20 hover:bg-[#161616] cursor-pointer">
              <CardHeader>
                <div
                  className={`inline-flex rounded-xl bg-gradient-to-br ${template.gradient} p-3 text-white w-fit`}
                >
                  <template.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-white mt-2">{template.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/40">{template.description}</p>
                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="secondary">{template.pages}</Badge>
                  <Badge variant="primary">MSBTE Compliant</Badge>
                </div>
                <Button variant="outline" className="w-full mt-4">
                  Use Template
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
