import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/db";
import { Project, ProjectIntelligence, ReportPlan } from "@/db/schema";
import { generateReportPlan } from "@/lib/ai/intelligence";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const project = await Project.findById(id).lean();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const intelligence = await ProjectIntelligence.findOne({ projectId: id }).lean();

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

    const plan = await generateReportPlan(id, project.name, intelData);

    await Project.findByIdAndUpdate(id, {
      status: "generating",
      updatedAt: new Date(),
    });

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
    await connectDB();
    const { id } = await params;

    const plan = await ReportPlan.findOne({ projectId: id }).lean();

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