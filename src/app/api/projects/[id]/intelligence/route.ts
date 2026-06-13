import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/db";
import { Project, ProjectFile, ProjectIntelligence } from "@/db/schema";
import { extractProjectIntelligence, buildKnowledgeGraph } from "@/lib/ai/intelligence";

export const dynamic = "force-dynamic";

// POST /api/projects/[id]/intelligence - Extract project intelligence
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const project = await Project.findById(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Update status
    await Project.findByIdAndUpdate(id, {
      status: "analyzing",
      updatedAt: new Date(),
    });

    // Collect all extracted content from files
    const files = await ProjectFile.find({ projectId: id }).lean();

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
    const intelligence = await extractProjectIntelligence(id, allContent);

    // Build knowledge graph
    await buildKnowledgeGraph(id, project.name, intelligence);

    // Update project status
    await Project.findByIdAndUpdate(id, {
      status: "planning",
      updatedAt: new Date(),
    });

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
    await connectDB();
    const { id } = await params;

    const intelligence = await ProjectIntelligence.findOne({ projectId: id }).lean();

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
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const updated = await ProjectIntelligence.findOneAndUpdate(
      { projectId: id },
      { ...body, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { error: "Intelligence not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating intelligence:", error);
    return NextResponse.json(
      { error: "Failed to update intelligence" },
      { status: 500 }
    );
  }
}