import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, projectIntelligence, reportPlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateReportPlan } from "@/lib/ai/intelligence";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [intelligence] = await db
      .select()
      .from(projectIntelligence)
      .where(eq(projectIntelligence.projectId, projectId));

    if (!intelligence) {
      return NextResponse.json(
        { error: "No intelligence found. Run extraction first." },
        { status: 400 }
      );
    }

    const intelData = {
      problemStatement: intelligence.problemStatement || "",
      objectives: (intelligence.objectives as string[]) || [],
      features: (intelligence.features as string[]) || [],
      modules: (intelligence.modules as string[]) || [],
      users: (intelligence.users as string[]) || [],
      workflows: (intelligence.workflows as string[]) || [],
      technologyStack: (intelligence.technologyStack as string[]) || [],
      databaseEntities: (intelligence.databaseEntities as string[]) || [],
      algorithms: (intelligence.algorithms as string[]) || [],
      screens: (intelligence.screens as string[]) || [],
      summary: intelligence.summary || "",
    };

    const plan = await generateReportPlan(projectId, project.name, intelData);

    await db
      .update(projects)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return NextResponse.json({ data: plan });
  } catch (error) {
    console.error("Error generating report plan:", error);
    return NextResponse.json(
      { error: "Failed to generate report plan" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);

    const [plan] = await db
      .select()
      .from(reportPlans)
      .where(eq(reportPlans.projectId, projectId));

    if (!plan) {
      return NextResponse.json(
        { error: "Report plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: plan });
  } catch (error) {
    console.error("Error fetching report plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch report plan" },
      { status: 500 }
    );
  }
}
