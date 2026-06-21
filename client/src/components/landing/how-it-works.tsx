"use client";

import { motion } from "framer-motion";
import { Upload, Brain, FileText, Download } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Upload Your Project",
    description:
      "Upload project files, source code, screenshots, PPT, SQL schemas, or connect a GitHub repository. Our ingestion engine processes everything.",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    icon: Brain,
    title: "AI Understands Your Project",
    description:
      "Our Project Intelligence Engine extracts objectives, features, modules, tech stack, and workflows. A knowledge graph is built automatically.",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    icon: FileText,
    title: "Generate Complete Report",
    description:
      "Every MSBTE chapter is generated independently with proper structure, cross-references, and academic formatting. Quality validated before assembly.",
    gradient: "from-green-500 to-green-600",
  },
  {
    icon: Download,
    title: "Export & Submit",
    description:
      "Download professional DOCX or PDF with proper headers, footers, TOC, page numbers, and references. Ready for submission.",
    gradient: "from-orange-500 to-orange-600",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            How it{" "}
            <span className="text-blue-400">works</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-white/50"
          >
            Four simple steps from project files to complete MSBTE documentation.
          </motion.p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute top-8 left-24 hidden h-[2px] w-[calc(100%-6rem)] bg-gradient-to-r from-white/20 to-transparent md:block" />
              )}

              <div className="relative flex flex-col items-center text-center">
                <div
                  className={`inline-flex rounded-2xl bg-gradient-to-br ${step.gradient} p-4 text-white shadow-lg`}
                >
                  <step.icon className="h-7 w-7" />
                </div>
                <div className="mt-4 text-sm font-medium text-blue-400">
                  Step {index + 1}
                </div>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/40">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
