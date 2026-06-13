import {
  pgTable,
  serial,
  text,
  varchar,
  jsonb,
  integer,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", ["user", "admin", "institute_admin"]);
export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "uploading",
  "extracting",
  "analyzing",
  "planning",
  "generating",
  "validating",
  "completed",
  "failed",
]);
export const fileTypeEnum = pgEnum("file_type", [
  "pdf",
  "docx",
  "pptx",
  "txt",
  "markdown",
  "zip",
  "image",
  "sql",
  "github",
]);
export const nodeTypeEnum = pgEnum("node_type", [
  "project",
  "feature",
  "module",
  "database_entity",
  "user_role",
  "screen",
  "technology",
  "workflow",
  "algorithm",
]);
export const chapterStatusEnum = pgEnum("chapter_status", [
  "pending",
  "generating",
  "completed",
  "failed",
]);
export const planTypeEnum = pgEnum("plan_type", ["free", "pro", "institute"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "expired",
  "cancelled",
  "trialing",
]);
export const exportFormatEnum = pgEnum("export_format", ["docx", "pdf"]);
export const exportStatusEnum = pgEnum("export_status", [
  "pending",
  "generating",
  "completed",
  "failed",
]);

// ─── Tables ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).unique().notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  avatar: text("avatar"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull().default("blackbook"),
  branch: varchar("branch", { length: 100 }),
  semester: varchar("semester", { length: 20 }),
  academicYear: varchar("academic_year", { length: 50 }),
  guideName: varchar("guide_name", { length: 255 }),
  collegeName: varchar("college_name", { length: 255 }),
  teamMembers: jsonb("team_members").default([]),
  description: text("description"),
  status: projectStatusEnum("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projectFiles = pgTable("project_files", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: fileTypeEnum("file_type").notNull(),
  fileSize: integer("file_size"),
  storagePath: text("storage_path"),
  extractedContent: text("extracted_content"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projectIntelligence = pgTable("project_intelligence", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  problemStatement: text("problem_statement"),
  objectives: jsonb("objectives").default([]),
  features: jsonb("features").default([]),
  modules: jsonb("modules").default([]),
  users: jsonb("users").default([]),
  workflows: jsonb("workflows").default([]),
  technologyStack: jsonb("technology_stack").default([]),
  databaseEntities: jsonb("database_entities").default([]),
  algorithms: jsonb("algorithms").default([]),
  screens: jsonb("screens").default([]),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const knowledgeGraphNodes = pgTable("knowledge_graph_nodes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  type: nodeTypeEnum("type").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  properties: jsonb("properties").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const knowledgeGraphEdges = pgTable("knowledge_graph_edges", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  sourceNodeId: integer("source_node_id")
    .references(() => knowledgeGraphNodes.id, { onDelete: "cascade" })
    .notNull(),
  targetNodeId: integer("target_node_id")
    .references(() => knowledgeGraphNodes.id, { onDelete: "cascade" })
    .notNull(),
  relationship: varchar("relationship", { length: 255 }).notNull(),
  properties: jsonb("properties").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reportPlans = pgTable("report_plans", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  chapters: jsonb("chapters").default([]),
  totalPages: integer("total_pages").default(0),
  status: varchar("status", { length: 50 }).default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  reportPlanId: integer("report_plan_id")
    .references(() => reportPlans.id, { onDelete: "cascade" })
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  number: integer("number").notNull(),
  content: text("content"),
  wordCount: integer("word_count").default(0),
  status: chapterStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chapterVersions = pgTable("chapter_versions", {
  id: serial("id").primaryKey(),
  chapterId: integer("chapter_id")
    .references(() => chapters.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  wordCount: integer("word_count").default(0),
  version: integer("version").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 100 }).notNull().default("msbte_standard"),
  structure: jsonb("structure").default({}),
  pages: jsonb("pages").default([]),
  isPublic: boolean("is_public").default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const templateVersions = pgTable("template_versions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .references(() => templates.id, { onDelete: "cascade" })
    .notNull(),
  structure: jsonb("structure").default({}),
  version: integer("version").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const exports = pgTable("exports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  format: exportFormatEnum("format").notNull(),
  status: exportStatusEnum("status").default("pending").notNull(),
  filePath: text("file_path"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).default("inr").notNull(),
  status: varchar("status", { length: 50 }).default("pending"),
  stripeId: varchar("stripe_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  plan: planTypeEnum("plan").default("free").notNull(),
  status: subscriptionStatusEnum("status").default("trialing").notNull(),
  startsAt: timestamp("starts_at").defaultNow().notNull(),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  event: varchar("event", { length: 255 }).notNull(),
  properties: jsonb("properties").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const institutes = pgTable("institutes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }).unique(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  rating: integer("rating"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ───────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  exports: many(exports),
  payments: many(payments),
  subscription: many(subscriptions),
  reviews: many(reviews),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  files: many(projectFiles),
  intelligence: one(projectIntelligence),
  graphNodes: many(knowledgeGraphNodes),
  graphEdges: many(knowledgeGraphEdges),
  reportPlan: one(reportPlans),
  chapters: many(chapters),
  exports: many(exports),
}));

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(projects, {
    fields: [projectFiles.projectId],
    references: [projects.id],
  }),
}));

export const knowledgeGraphNodesRelations = relations(
  knowledgeGraphNodes,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [knowledgeGraphNodes.projectId],
      references: [projects.id],
    }),
    outgoingEdges: many(knowledgeGraphEdges, {
      relationName: "source",
    }),
    incomingEdges: many(knowledgeGraphEdges, {
      relationName: "target",
    }),
  })
);

export const knowledgeGraphEdgesRelations = relations(
  knowledgeGraphEdges,
  ({ one }) => ({
    project: one(projects, {
      fields: [knowledgeGraphEdges.projectId],
      references: [projects.id],
    }),
    sourceNode: one(knowledgeGraphNodes, {
      fields: [knowledgeGraphEdges.sourceNodeId],
      references: [knowledgeGraphNodes.id],
      relationName: "source",
    }),
    targetNode: one(knowledgeGraphNodes, {
      fields: [knowledgeGraphEdges.targetNodeId],
      references: [knowledgeGraphNodes.id],
      relationName: "target",
    }),
  })
);

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  project: one(projects, { fields: [chapters.projectId], references: [projects.id] }),
  reportPlan: one(reportPlans, {
    fields: [chapters.reportPlanId],
    references: [reportPlans.id],
  }),
  versions: many(chapterVersions),
}));
