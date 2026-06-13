import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, projectFiles, projectIntelligence } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractProjectIntelligence, buildKnowledgeGraph } from "@/lib/ai/intelligence";

export const dynamic = "force-dynamic";

// POST /api/projects/[id]/intelligence - Extract project intelligence
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

    // Update status
    await db
      .update(projects)
      .set({ status: "analyzing", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    // Collect all extracted content from files
    const files = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));

    const allContent = files
      .map((f) => `--- ${f.fileName} ---\n${f.extractedContent || ""}`)
      .join("\n\n");

    if (!allContent.trim()) {
      return NextResponse.json(
        { error: "No extracted content found. Upload files first." },
        { status: 400 }
      );
    }

    // Extract intelligence
    const intelligence = await extractProjectIntelligence(projectId, allContent);

    // Build knowledge graph
    await buildKnowledgeGraph(projectId, project.name, intelligence);

    // Update project status
    await db
      .update(projects)
      .set({ status: "planning", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return NextResponse.json({ data: intelligence });
  } catch (error) {
    console.error("Error extracting intelligence:", error);
    return NextResponse.json(
      { error: "Failed to extract project intelligence" },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id]/intelligence - Get project intelligence
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);

    const [intelligence] = await db
      .select()
      .from(projectIntelligence)
      .where(eq(projectIntelligence.projectId, projectId));

    if (!intelligence) {
      return NextResponse.json(
        { error: "Intelligence not found. Run extraction first." },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: intelligence });
  } catch (error) {
    console.error("Error fetching intelligence:", error);
    return NextResponse.json(
      { error: "Failed to fetch intelligence" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[id]/intelligence - Update intelligence manually
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);
    const body = await request.json();

    const [updated] = await db
      .update(projectIntelligence)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(projectIntelligence.projectId, projectId))
      .returning();

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating intelligence:", error);
    return NextResponse.json(
      { error: "Failed to update intelligence" },
      { status: 500 }
    );
  }
}
