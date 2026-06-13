import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, chapters, exports } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET /api/projects/[id]/exports - Get exports for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);

    const exportList = await db
      .select()
      .from(exports)
      .where(eq(exports.projectId, projectId))
      .orderBy(exports.createdAt);

    return NextResponse.json({ data: exportList });
  } catch (error) {
    console.error("Error fetching exports:", error);
    return NextResponse.json(
      { error: "Failed to fetch exports" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/exports - Create export
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);
    const body = await request.json();
    const { userId, format } = body;

    if (!userId || !format) {
      return NextResponse.json(
        { error: "userId and format are required" },
        { status: 400 }
      );
    }

    const [existingExport] = await db
      .insert(exports)
      .values({
        projectId,
        userId,
        format,
        status: "generating",
      })
      .returning();

    // In production, queue the export generation job
    // For now, mark as completed
    await db
      .update(exports)
      .set({
        status: "completed",
        filePath: `/api/exports/${existingExport.id}/download`,
      })
      .where(eq(exports.id, existingExport.id));

    return NextResponse.json({ data: { ...existingExport, status: "completed" } });
  } catch (error) {
    console.error("Error creating export:", error);
    return NextResponse.json(
      { error: "Failed to create export" },
      { status: 500 }
    );
  }
}
