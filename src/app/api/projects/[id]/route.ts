import { connectDB } from "@/db";
import {
  Project,
  ProjectFile,
  ProjectIntelligence,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  ReportPlan,
  Chapter,
} from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/projects/[id] - Get project with all related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const project = await Project.findById(id).lean();
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const [files, intelligence, nodes, edges, plan, chapterList] =
      await Promise.all([
        ProjectFile.find({ projectId: id }).lean(),
        ProjectIntelligence.findOne({ projectId: id }).lean(),
        KnowledgeGraphNode.find({ projectId: id }).lean(),
        KnowledgeGraphEdge.find({ projectId: id }).lean(),
        ReportPlan.findOne({ projectId: id }).lean(),
        Chapter.find({ projectId: id }).sort({ number: 1 }).lean(),
      ]);

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
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const updated = await Project.findByIdAndUpdate(
      id,
      { ...body, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete project (cascading handled by application)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const project = await Project.findByIdAndDelete(id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    // Clean up related documents
    await Promise.all([
      ProjectFile.deleteMany({ projectId: id }),
      ProjectIntelligence.deleteOne({ projectId: id }),
      KnowledgeGraphNode.deleteMany({ projectId: id }),
      KnowledgeGraphEdge.deleteMany({ projectId: id }),
      ReportPlan.deleteOne({ projectId: id }),
      Chapter.deleteMany({ projectId: id }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}