"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "What is BlackBook AI?",
    answer:
      "BlackBook AI is an AI Documentation Operating System that automatically creates complete MSBTE-compliant Blackbooks, Project Reports, Journals, and other academic documents from raw project inputs. It understands your project before generating reports, ensuring accuracy and relevance.",
  },
  {
    question: "What file types can I upload?",
    answer:
      "You can upload PDF, DOCX, PPTX, TXT, Markdown, ZIP archives, images (PNG, JPG, JPEG, GIF, WebP), SQL files, and even GitHub repository URLs. Our ingestion engine extracts content from all these formats.",
  },
  {
    question: "How does the AI understand my project?",
    answer:
      "The system uses a multi-stage pipeline: Extraction Engine extracts content from files, Project Intelligence Engine identifies objectives and features, Knowledge Graph maps relationships, and only then does chapter generation begin. This ensures deep understanding before any writing.",
  },
  {
    question: "Is it really MSBTE compliant?",
    answer:
      "Yes. All templates follow MSBTE guidelines for structure, formatting, page count, and chapter organization. The quality validation engine checks for compliance before final export.",
  },
  {
    question: "Can I edit the generated content?",
    answer:
      "Absolutely. You can review and edit every chapter before final export. The built-in editor supports rich text, images, tables, and formatting. You can also regenerate specific chapters if needed.",
  },
  {
    question: "What formats can I export to?",
    answer:
      "You can export to both DOCX (editable Word format) and PDF (print-ready) with proper headers, footers, table of contents, page numbers, and references.",
  },
  {
    question: "How long does generation take?",
    answer:
      "Upload processing takes less than 60 seconds, project analysis under 90 seconds, chapter generation under 3 minutes, and export under 30 seconds. Most complete projects are ready in under 5 minutes.",
  },
  {
    question: "Is there a free plan?",
    answer:
      "Yes. The Free plan includes 1 report per month with a watermark. Pro plan at ₹499/month gives unlimited reports, premium templates, and faster generation. Institute plan at ₹4,999/month supports multi-user access and shared templates.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-bold text-white sm:text-4xl"
          >
            Frequently asked{" "}
            <span className="text-blue-400">questions</span>
          </motion.h2>
        </div>

        <div className="mt-12 space-y-2">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.03 }}
              className="rounded-xl border border-[#222] bg-[#111] overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-white/5"
              >
                <span className="text-sm font-medium text-white">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-[#222] px-6 py-4">
                      <p className="text-sm leading-relaxed text-white/50">
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
