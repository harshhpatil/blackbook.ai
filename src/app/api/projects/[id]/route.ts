import { db } from "@/db";
import {
  projects,
  projectFiles,
  projectIntelligence,
  knowledgeGraphNodes,
  knowledgeGraphEdges,
  reportPlans,
  chapters,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/projects/[id] - Get project with all related data
export async function GET(
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
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const files = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));

    const [intelligence] = await db
      .select()
      .from(projectIntelligence)
      .where(eq(projectIntelligence.projectId, projectId));

    const nodes = await db
      .select()
      .from(knowledgeGraphNodes)
      .where(eq(knowledgeGraphNodes.projectId, projectId));

    const edges = await db
      .select()
      .from(knowledgeGraphEdges)
      .where(eq(knowledgeGraphEdges.projectId, projectId));

    const [plan] = await db
      .select()
      .from(reportPlans)
      .where(eq(reportPlans.projectId, projectId));

    const chapterList = await db
      .select()
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(chapters.number);

    return NextResponse.json({
      data: {
        ...project,
        files,
        intelligence,
        knowledgeGraph: { nodes, edges },
        reportPlan: plan,
        chapters: chapterList,
      },
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id] - Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);
    const body = await request.json();

    const [updated] = await db
      .update(projects)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);

    await db.delete(projects).where(eq(projects.id, projectId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
