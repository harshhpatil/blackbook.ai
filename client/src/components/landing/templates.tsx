"use client";

import { motion } from "framer-motion";
import { FileText, BookOpen, FileSpreadsheet, GraduationCap, ClipboardList, ScrollText } from "lucide-react";

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

export function TemplatesSection() {
  return (
    <section id="templates" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            Documentation{" "}
            <span className="text-blue-400">templates</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-white/50"
          >
            Choose from professionally crafted templates that match MSBTE standards.
          </motion.p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template, index) => (
            <motion.div
              key={template.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group cursor-pointer rounded-2xl border border-[#222] bg-[#111] p-6 transition-all hover:border-white/20 hover:bg-[#161616]"
            >
              <div
                className={`inline-flex rounded-xl bg-gradient-to-br ${template.gradient} p-3 text-white`}
              >
                <template.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {template.name}
              </h3>
              <p className="mt-1 text-sm text-white/40">
                {template.description}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-white/30">
                <span className="rounded-full border border-[#222] px-2 py-0.5">
                  {template.pages}
                </span>
                <span className="rounded-full border border-[#222] px-2 py-0.5">
                  MSBTE Compliant
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
