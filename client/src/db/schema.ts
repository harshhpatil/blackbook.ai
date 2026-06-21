import mongoose, { Schema, Document, Model } from "mongoose";

// ─── User ─────────────────────────────────────────────────

export interface IUser extends Document {
  clerkId: string;
  email: string;
  name?: string;
  avatar?: string;
  role: "user" | "admin" | "institute_admin";
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    clerkId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String },
    avatar: { type: String },
    role: {
      type: String,
      enum: ["user", "admin", "institute_admin"],
      default: "user",
    },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);

// ─── Project ───────────────────────────────────────────────

export type ProjectStatus =
  | "draft"
  | "uploading"
  | "extracting"
  | "analyzing"
  | "planning"
  | "generating"
  | "validating"
  | "completed"
  | "failed";

export interface IProject extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  type: string;
  branch?: string;
  semester?: string;
  academicYear?: string;
  guideName?: string;
  collegeName?: string;
  teamMembers: string[];
  description?: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, default: "blackbook" },
    branch: { type: String },
    semester: { type: String },
    academicYear: { type: String },
    guideName: { type: String },
    collegeName: { type: String },
    teamMembers: { type: [String], default: [] },
    description: { type: String },
    status: {
      type: String,
      enum: [
        "draft",
        "uploading",
        "extracting",
        "analyzing",
        "planning",
        "generating",
        "validating",
        "completed",
        "failed",
      ],
      default: "draft",
    },
  },
  { timestamps: true }
);

export const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", projectSchema);

// ─── Project File ──────────────────────────────────────────

export type FileType = "pdf" | "docx" | "pptx" | "txt" | "markdown" | "zip" | "image" | "sql" | "github";

export interface IProjectFile extends Document {
  projectId: mongoose.Types.ObjectId;
  fileName: string;
  fileType: FileType;
  fileSize?: number;
  storagePath?: string;
  extractedContent?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const projectFileSchema = new Schema<IProjectFile>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  fileName: { type: String, required: true },
  fileType: {
    type: String,
    enum: ["pdf", "docx", "pptx", "txt", "markdown", "zip", "image", "sql", "github"],
    required: true,
  },
  fileSize: { type: Number },
  storagePath: { type: String },
  extractedContent: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

export const ProjectFile: Model<IProjectFile> =
  mongoose.models.ProjectFile || mongoose.model<IProjectFile>("ProjectFile", projectFileSchema);

// ─── Project Intelligence ─────────────────────────────────

export interface IProjectIntelligence extends Document {
  projectId: mongoose.Types.ObjectId;
  problemStatement?: string;
  objectives: string[];
  features: string[];
  modules: string[];
  users: string[];
  workflows: string[];
  technologyStack: string[];
  databaseEntities: string[];
  algorithms: string[];
  screens: string[];
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

const projectIntelligenceSchema = new Schema<IProjectIntelligence>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
      index: true,
    },
    problemStatement: { type: String },
    objectives: { type: [String], default: [] },
    features: { type: [String], default: [] },
    modules: { type: [String], default: [] },
    users: { type: [String], default: [] },
    workflows: { type: [String], default: [] },
    technologyStack: { type: [String], default: [] },
    databaseEntities: { type: [String], default: [] },
    algorithms: { type: [String], default: [] },
    screens: { type: [String], default: [] },
    summary: { type: String },
  },
  { timestamps: true }
);

export const ProjectIntelligence: Model<IProjectIntelligence> =
  mongoose.models.ProjectIntelligence ||
  mongoose.model<IProjectIntelligence>("ProjectIntelligence", projectIntelligenceSchema);

// ─── Knowledge Graph Node ─────────────────────────────────

export type NodeType =
  | "project"
  | "feature"
  | "module"
  | "database_entity"
  | "user_role"
  | "screen"
  | "technology"
  | "workflow"
  | "algorithm";

export interface IKnowledgeGraphNode extends Document {
  projectId: mongoose.Types.ObjectId;
  type: NodeType;
  label: string;
  properties: Record<string, unknown>;
  createdAt: Date;
}

const knowledgeGraphNodeSchema = new Schema<IKnowledgeGraphNode>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  type: {
    type: String,
    enum: ["project", "feature", "module", "database_entity", "user_role", "screen", "technology", "workflow", "algorithm"],
    required: true,
  },
  label: { type: String, required: true },
  properties: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

export const KnowledgeGraphNode: Model<IKnowledgeGraphNode> =
  mongoose.models.KnowledgeGraphNode ||
  mongoose.model<IKnowledgeGraphNode>("KnowledgeGraphNode", knowledgeGraphNodeSchema);

// ─── Knowledge Graph Edge ─────────────────────────────────

export interface IKnowledgeGraphEdge extends Document {
  projectId: mongoose.Types.ObjectId;
  sourceNodeId: mongoose.Types.ObjectId;
  targetNodeId: mongoose.Types.ObjectId;
  relationship: string;
  properties: Record<string, unknown>;
  createdAt: Date;
}

const knowledgeGraphEdgeSchema = new Schema<IKnowledgeGraphEdge>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  sourceNodeId: {
    type: Schema.Types.ObjectId,
    ref: "KnowledgeGraphNode",
    required: true,
  },
  targetNodeId: {
    type: Schema.Types.ObjectId,
    ref: "KnowledgeGraphNode",
    required: true,
  },
  relationship: { type: String, required: true },
  properties: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

export const KnowledgeGraphEdge: Model<IKnowledgeGraphEdge> =
  mongoose.models.KnowledgeGraphEdge ||
  mongoose.model<IKnowledgeGraphEdge>("KnowledgeGraphEdge", knowledgeGraphEdgeSchema);

// ─── Report Plan ──────────────────────────────────────────

export interface IReportPlan extends Document {
  projectId: mongoose.Types.ObjectId;
  chapters: Array<{
    title: string;
    number: number;
    targetPages: number;
    description: string;
    dependencies: string[];
  }>;
  totalPages: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const reportPlanSchema = new Schema<IReportPlan>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true,
      index: true,
    },
    chapters: {
      type: [
        {
          title: String,
          number: Number,
          targetPages: Number,
          description: String,
          dependencies: [String],
        },
      ],
      default: [],
    },
    totalPages: { type: Number, default: 0 },
    status: { type: String, default: "draft" },
  },
  { timestamps: true }
);

export const ReportPlan: Model<IReportPlan> =
  mongoose.models.ReportPlan || mongoose.model<IReportPlan>("ReportPlan", reportPlanSchema);

// ─── Chapter ───────────────────────────────────────────────

export type ChapterStatus = "pending" | "generating" | "completed" | "failed";

export interface IChapter extends Document {
  projectId: mongoose.Types.ObjectId;
  reportPlanId: mongoose.Types.ObjectId;
  title: string;
  number: number;
  content?: string;
  wordCount: number;
  status: ChapterStatus;
  createdAt: Date;
  updatedAt: Date;
}

const chapterSchema = new Schema<IChapter>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    reportPlanId: { type: Schema.Types.ObjectId, ref: "ReportPlan", required: true },
    title: { type: String, required: true },
    number: { type: Number, required: true },
    content: { type: String },
    wordCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "generating", "completed", "failed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export const Chapter: Model<IChapter> =
  mongoose.models.Chapter || mongoose.model<IChapter>("Chapter", chapterSchema);

// ─── Chapter Version ───────────────────────────────────────

export interface IChapterVersion extends Document {
  chapterId: mongoose.Types.ObjectId;
  content: string;
  wordCount: number;
  version: number;
  createdAt: Date;
}

const chapterVersionSchema = new Schema<IChapterVersion>({
  chapterId: { type: Schema.Types.ObjectId, ref: "Chapter", required: true, index: true },
  content: { type: String, required: true },
  wordCount: { type: Number, default: 0 },
  version: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const ChapterVersion: Model<IChapterVersion> =
  mongoose.models.ChapterVersion ||
  mongoose.model<IChapterVersion>("ChapterVersion", chapterVersionSchema);

// ─── Template ──────────────────────────────────────────────

export interface ITemplate extends Document {
  name: string;
  description?: string;
  type: string;
  structure: Record<string, unknown>;
  pages: unknown[];
  isPublic: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplate>(
  {
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, default: "msbte_standard" },
    structure: { type: Schema.Types.Mixed, default: {} },
    pages: { type: [], default: [] },
    isPublic: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Template: Model<ITemplate> =
  mongoose.models.Template || mongoose.model<ITemplate>("Template", templateSchema);

// ─── Template Version ──────────────────────────────────────

export interface ITemplateVersion extends Document {
  templateId: mongoose.Types.ObjectId;
  structure: Record<string, unknown>;
  version: number;
  createdAt: Date;
}

const templateVersionSchema = new Schema<ITemplateVersion>({
  templateId: { type: Schema.Types.ObjectId, ref: "Template", required: true, index: true },
  structure: { type: Schema.Types.Mixed, default: {} },
  version: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const TemplateVersion: Model<ITemplateVersion> =
  mongoose.models.TemplateVersion ||
  mongoose.model<ITemplateVersion>("TemplateVersion", templateVersionSchema);

// ─── Export ────────────────────────────────────────────────

export type ExportFormat = "docx" | "pdf";
export type ExportStatus = "pending" | "generating" | "completed" | "failed";

export interface IExport extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  format: ExportFormat;
  status: ExportStatus;
  filePath?: string;
  error?: string;
  createdAt: Date;
}

const exportSchema = new Schema<IExport>({
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  format: { type: String, enum: ["docx", "pdf"], required: true },
  status: {
    type: String,
    enum: ["pending", "generating", "completed", "failed"],
    default: "pending",
  },
  filePath: { type: String },
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const Export: Model<IExport> =
  mongoose.models.Export || mongoose.model<IExport>("Export", exportSchema);

// ─── Payment ───────────────────────────────────────────────

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: string;
  stripeId?: string;
  createdAt: Date;
}

const paymentSchema = new Schema<IPayment>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: "inr" },
  status: { type: String, default: "pending" },
  stripeId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", paymentSchema);

// ─── Subscription ──────────────────────────────────────────

export type PlanType = "free" | "pro" | "institute";
export type SubscriptionStatus = "active" | "expired" | "cancelled" | "trialing";

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  plan: PlanType;
  status: SubscriptionStatus;
  startsAt: Date;
  endsAt?: Date;
  createdAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true,
  },
  plan: { type: String, enum: ["free", "pro", "institute"], default: "free" },
  status: {
    type: String,
    enum: ["active", "expired", "cancelled", "trialing"],
    default: "trialing",
  },
  startsAt: { type: Date, default: Date.now },
  endsAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export const Subscription: Model<ISubscription> =
  mongoose.models.Subscription ||
  mongoose.model<ISubscription>("Subscription", subscriptionSchema);

// ─── Analytics Event ───────────────────────────────────────

export interface IAnalyticsEvent extends Document {
  userId?: mongoose.Types.ObjectId;
  event: string;
  properties: Record<string, unknown>;
  createdAt: Date;
}

const analyticsEventSchema = new Schema<IAnalyticsEvent>({
  userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  event: { type: String, required: true },
  properties: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

export const AnalyticsEvent: Model<IAnalyticsEvent> =
  mongoose.models.AnalyticsEvent ||
  mongoose.model<IAnalyticsEvent>("AnalyticsEvent", analyticsEventSchema);

// ─── Institute ─────────────────────────────────────────────

export interface IInstitute extends Document {
  name: string;
  code?: string;
  address?: string;
  city?: string;
  state?: string;
  createdAt: Date;
}

const instituteSchema = new Schema<IInstitute>({
  name: { type: String, required: true },
  code: { type: String, unique: true, sparse: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const Institute: Model<IInstitute> =
  mongoose.models.Institute || mongoose.model<IInstitute>("Institute", instituteSchema);

// ─── Review ────────────────────────────────────────────────

export interface IReview extends Document {
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  rating?: number;
  comment?: string;
  createdAt: Date;
}

const reviewSchema = new Schema<IReview>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  rating: { type: Number },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const Review: Model<IReview> =
  mongoose.models.Review || mongoose.model<IReview>("Review", reviewSchema);