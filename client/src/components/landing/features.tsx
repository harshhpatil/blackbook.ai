"use client";

import { motion } from "framer-motion";
import {
  Brain,
  FileText,
  GitBranch,
  Database,
  Shield,
  Zap,
  Image,
  Network,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "Project Intelligence Engine",
    description:
      "Our AI deeply analyzes your project files to understand architecture, features, and workflows before generating documentation.",
    gradient: "from-blue-400 to-blue-600",
  },
  {
    icon: Network,
    title: "Knowledge Graph System",
    description:
      "Every project entity is mapped with relationships. No generation happens without graph context ensuring factual accuracy.",
    gradient: "from-purple-400 to-purple-600",
  },
  {
    icon: FileText,
    title: "Smart Document Generation",
    description:
      "Generates complete MSBTE-compliant chapters with proper formatting, citations, and academic structure automatically.",
    gradient: "from-green-400 to-green-600",
  },
  {
    icon: GitBranch,
    title: "GitHub Integration",
    description:
      "Connect any GitHub repository. We analyze code structure, dependencies, and architecture for comprehensive documentation.",
    gradient: "from-orange-400 to-orange-600",
  },
  {
    icon: Database,
    title: "Database Analyzer",
    description:
      "Parse SQL schemas and automatically generate detailed database design chapters with entity relationships.",
    gradient: "from-pink-400 to-pink-600",
  },
  {
    icon: Image,
    title: "Screenshot Analysis",
    description:
      "Upload screenshots and our AI generates accurate captions, descriptions, and placement recommendations for figures.",
    gradient: "from-cyan-400 to-cyan-600",
  },
  {
    icon: Shield,
    title: "Quality Validation",
    description:
      "Every chapter is validated for hallucinations, contradictions, and formatting issues before assembly.",
    gradient: "from-red-400 to-red-600",
  },
  {
    icon: Zap,
    title: "One-Click Export",
    description:
      "Export professional DOCX and PDF files with proper headers, footers, TOC, page numbers, and references.",
    gradient: "from-yellow-400 to-yellow-600",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            Everything you need for
            <br />
            <span className="text-blue-400">perfect documentation</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-white/50"
          >
            From code analysis to final export. BlackBook AI handles every step
            of the documentation pipeline.
          </motion.p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="group rounded-2xl border border-[#222] bg-[#111] p-6 transition-all hover:border-white/20 hover:bg-[#161616]"
            >
              <div
                className={`inline-flex rounded-xl bg-gradient-to-br ${feature.gradient} p-3 text-white`}
              >
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/40">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
