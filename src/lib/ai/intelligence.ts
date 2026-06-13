import { generateStructuredJSON } from "./gemini";
import {
  EXTRACT_PROJECT_INTELLIGENCE_SYSTEM,
  GENERATE_KNOWLEDGE_GRAPH_SYSTEM,
  GENERATE_REPORT_PLAN_SYSTEM,
  GENERATE_CHAPTER_SYSTEM,
  VALIDATE_CHAPTER_SYSTEM,
  ANALYZE_SCREENSHOT_SYSTEM,
  ANALYZE_DATABASE_SYSTEM,
  ANALYZE_FLOWCHART_SYSTEM,
} from "./prompts";
import { db } from "@/db";
import {
  projectIntelligence,
  knowledgeGraphNodes,
  knowledgeGraphEdges,
  reportPlans,
  chapters,
  projects,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ProjectIntelligenceData {
  problemStatement: string;
  objectives: string[];
  features: string[];
  modules: string[];
  users: string[];
  workflows: string[];
  technologyStack: string[];
  databaseEntities: string[];
  algorithms: string[];
  screens: string[];
  summary: string;
}

export interface KnowledgeGraphData {
  nodes: Array<{ type: string; label: string; properties?: Record<string, unknown> }>;
  edges: Array<{
    sourceLabel: string;
    targetLabel: string;
    relationship: string;
  }>;
}

export interface ReportPlanData {
  chapters: Array<{
    title: string;
    number: number;
    targetPages: number;
    description: string;
    dependencies: string[];
  }>;
  totalPages: number;
}

// Extract project intelligence from raw content
export async function extractProjectIntelligence(
  projectId: number,
  extractedContent: string
): Promise<ProjectIntelligenceData> {
  const data = await generateStructuredJSON<ProjectIntelligenceData>(
    EXTRACT_PROJECT_INTELLIGENCE_SYSTEM,
    `Project Content:\n\n${extractedContent.substring(0, 50000)}`,
    "flash"
  );

  await db
    .insert(projectIntelligence)
    .values({
      projectId,
      problemStatement: data.problemStatement,
      objectives: data.objectives,
      features: data.features,
      modules: data.modules,
      users: data.users,
      workflows: data.workflows,
      technologyStack: data.technologyStack,
      databaseEntities: data.databaseEntities,
      algorithms: data.algorithms,
      screens: data.screens,
      summary: data.summary,
    })
    .onConflictDoUpdate({
      target: projectIntelligence.projectId,
      set: {
        problemStatement: data.problemStatement,
        objectives: data.objectives,
        features: data.features,
        modules: data.modules,
        users: data.users,
        workflows: data.workflows,
        technologyStack: data.technologyStack,
        databaseEntities: data.databaseEntities,
        algorithms: data.algorithms,
        screens: data.screens,
        summary: data.summary,
        updatedAt: new Date(),
      },
    });

  return data;
}

// Build knowledge graph from intelligence
export async function buildKnowledgeGraph(
  projectId: number,
  projectName: string,
  intelligence: ProjectIntelligenceData
): Promise<void> {
  const intelligenceText = JSON.stringify(intelligence, null, 2);
  const graphData = await generateStructuredJSON<KnowledgeGraphData>(
    GENERATE_KNOWLEDGE_GRAPH_SYSTEM,
    `Project Name: ${projectName}\n\nProject Intelligence:\n${intelligenceText}`,
    "flash"
  );

  // First, create all nodes
  const nodeMap = new Map<string, number>();

  // Add project node
  const [projectNode] = await db
    .insert(knowledgeGraphNodes)
    .values({
      projectId,
      type: "project",
      label: projectName,
      properties: { name: projectName },
    })
    .returning();
  nodeMap.set(projectName, projectNode.id);

  // Add all other nodes
  for (const node of graphData.nodes) {
    const [created] = await db
      .insert(knowledgeGraphNodes)
      .values({
        projectId,
        type: node.type as any,
        label: node.label,
        properties: node.properties || {},
      })
      .returning();
    nodeMap.set(node.label, created.id);
  }

  // Create edges
  for (const edge of graphData.edges) {
    const sourceId = nodeMap.get(edge.sourceLabel);
    const targetId = nodeMap.get(edge.targetLabel);
    if (sourceId && targetId) {
      await db.insert(knowledgeGraphEdges).values({
        projectId,
        sourceNodeId: sourceId,
        targetNodeId: targetId,
        relationship: edge.relationship,
      });
    }
  }
}

// Generate report plan
export async function generateReportPlan(
  projectId: number,
  projectName: string,
  intelligence: ProjectIntelligenceData
): Promise<ReportPlanData> {
  const intelligenceText = JSON.stringify(intelligence, null, 2);
  const planData = await generateStructuredJSON<ReportPlanData>(
    GENERATE_REPORT_PLAN_SYSTEM,
    `Project Name: ${projectName}\n\nProject Intelligence:\n${intelligenceText}`,
    "pro"
  );

  await db
    .insert(reportPlans)
    .values({
      projectId,
      chapters: planData.chapters,
      totalPages: planData.totalPages,
      status: "planned",
    })
    .onConflictDoUpdate({
      target: reportPlans.projectId,
      set: {
        chapters: planData.chapters,
        totalPages: planData.totalPages,
        status: "planned",
        updatedAt: new Date(),
      },
    });

  return planData;
}

// Generate a single chapter
export async function generateChapter(
  projectId: number,
  reportPlanId: number,
  chapterData: { title: string; number: number; targetPages: number }
): Promise<{ content: string; wordCount: number }> {
  // Get project context
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));

  const [intel] = await db
    .select()
    .from(projectIntelligence)
    .where(eq(projectIntelligence.projectId, projectId));

  const context = JSON.stringify(
    {
      projectName: project?.name,
      description: project?.description,
      intelligence: intel,
    },
    null,
    2
  );

  const systemPrompt = GENERATE_CHAPTER_SYSTEM(chapterData.title, context);
  const content = await generateWithSimplePrompt(systemPrompt, "pro");

  const wordCount = content.split(/\s+/).length;

  // Insert chapter
  await db.insert(chapters).values({
    projectId,
    reportPlanId,
    title: chapterData.title,
    number: chapterData.number,
    content,
    wordCount,
    status: "completed",
  });

  return { content, wordCount };
}

// Validate a chapter
export async function validateChapter(
  chapterContent: string,
  projectIntelligenceData: ProjectIntelligenceData
): Promise<{
  score: number;
  issues: Array<{
    type: string;
    severity: string;
    description: string;
    suggestion: string;
  }>;
  passed: boolean;
  overallFeedback: string;
}> {
  const data = await generateStructuredJSON<{
    score: number;
    issues: Array<{
      type: string;
      severity: string;
      description: string;
      suggestion: string;
    }>;
    passed: boolean;
    overallFeedback: string;
  }>(
    VALIDATE_CHAPTER_SYSTEM,
    `Chapter Content:\n\n${chapterContent}\n\nProject Intelligence:\n${JSON.stringify(projectIntelligenceData)}`,
    "flash"
  );

  return data;
}

// Analyze screenshot
export async function analyzeScreenshot(
  description: string
): Promise<{
  interfaceType: string;
  keyElements: string[];
  suggestedCaption: string;
  suggestedChapter: string;
  description: string;
}> {
  return generateStructuredJSON(ANALYZE_SCREENSHOT_SYSTEM, description, "flash");
}

// Analyze database
export async function analyzeDatabase(
  sqlContent: string
): Promise<{
  tables: Array<{
    name: string;
    description: string;
    fields: string[];
    primaryKey: string;
    foreignKeys: string[];
  }>;
  relationships: Array<{
    from: string;
    to: string;
    type: string;
    description: string;
  }>;
  summary: string;
}> {
  return generateStructuredJSON(
    ANALYZE_DATABASE_SYSTEM,
    `SQL Content:\n\n${sqlContent}`,
    "flash"
  );
}

// Analyze flowchart
export async function analyzeFlowchart(
  description: string
): Promise<{
  processName: string;
  steps: string[];
  explanation: string;
  suggestedChapter: string;
  suggestedSection: string;
}> {
  return generateStructuredJSON(ANALYZE_FLOWCHART_SYSTEM, description, "flash");
}

async function generateWithSimplePrompt(
  prompt: string,
  model: "flash" | "pro" = "pro"
): Promise<string> {
  const { getModel } = await import("./gemini");
  const genModel = getModel(model);
  const result = await genModel.generateContent(prompt);
  return result.response.text();
}
