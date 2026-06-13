export const APP_NAME = "BlackBook AI";
export const APP_TAGLINE = "Upload Your Project. Download Your Blackbook.";
export const APP_DESCRIPTION =
  "Upload project files and generate complete MSBTE-compliant documentation in minutes. BlackBook AI is an AI Documentation Operating System that understands your project before generating reports.";

export const BRAND = {
  name: APP_NAME,
  tagline: APP_TAGLINE,
  description: APP_DESCRIPTION,
  primary: "#FFFFFF",
  accent: "#3B82F6",
  background: "#0A0A0A",
  surface: "#111111",
  border: "#222222",
} as const;

export const PROJECT_TYPES = [
  { value: "blackbook", label: "Blackbook" },
  { value: "project_report", label: "Project Report" },
  { value: "journal", label: "Journal" },
  { value: "internship_report", label: "Internship Report" },
  { value: "seminar_report", label: "Seminar Report" },
  { value: "lab_manual", label: "Lab Manual" },
  { value: "technical_doc", label: "Technical Documentation" },
] as const;

export const BRANCHES = [
  "Computer Engineering",
  "Information Technology",
  "Electronics & Telecommunication",
  "Mechanical Engineering",
  "Civil Engineering",
  "Electrical Engineering",
  "Automobile Engineering",
  "Chemical Engineering",
  "AIDS",
  "AIML",
] as const;

export const SEMESTERS = ["1", "2", "3", "4", "5", "6"] as const;

export const DEFAULT_CHAPTERS = [
  { title: "Cover Page", pages: 1, required: true },
  { title: "Certificate", pages: 1, required: true },
  { title: "Declaration", pages: 1, required: true },
  { title: "Acknowledgement", pages: 1, required: true },
  { title: "Abstract", pages: 1, required: true },
  { title: "Table of Contents", pages: 2, required: true },
  { title: "List of Figures", pages: 1, required: false },
  { title: "List of Tables", pages: 1, required: false },
  { title: "Introduction", pages: 6, required: true },
  { title: "Literature Survey", pages: 8, required: true },
  { title: "Requirement Analysis", pages: 6, required: true },
  { title: "System Design", pages: 8, required: true },
  { title: "Database Design", pages: 6, required: true },
  { title: "Implementation", pages: 12, required: true },
  { title: "Testing", pages: 8, required: true },
  { title: "Results and Discussion", pages: 6, required: true },
  { title: "Future Scope", pages: 2, required: true },
  { title: "Conclusion", pages: 2, required: true },
  { title: "References", pages: 3, required: true },
  { title: "Appendix", pages: 2, required: false },
  { title: "Glossary", pages: 2, required: false },
] as const;

export const PRICING = {
  free: {
    name: "Free",
    price: 0,
    reports: 1,
    watermark: true,
    features: [
      "1 report per month",
      "Basic templates",
      "PDF export",
      "Watermark included",
    ],
  },
  pro: {
    name: "Pro",
    price: 499,
    reports: "Unlimited",
    watermark: false,
    features: [
      "Unlimited reports",
      "Premium templates",
      "DOCX + PDF export",
      "No watermark",
      "Faster generation",
      "Priority support",
    ],
  },
  institute: {
    name: "Institute",
    price: 4999,
    reports: "Unlimited",
    watermark: false,
    features: [
      "Multi-user access",
      "Shared templates",
      "Teacher review dashboard",
      "Bulk generation",
      "Custom branding",
      "Dedicated support",
      "Analytics dashboard",
    ],
  },
} as const;

export const FILE_ACCEPT = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    ".pptx",
  ],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
  "application/zip": [".zip"],
  "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
  "application/sql": [".sql"],
};

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
