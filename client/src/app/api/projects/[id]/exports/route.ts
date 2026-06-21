import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/db";
import { Project, Chapter, Export } from "@/db/schema";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// GET /api/projects/[id]/exports - Get exports for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const exportList = await Export.find({ projectId: id })
      .sort({ createdAt: -1 })
      .lean();

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
    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { userId, format } = body;

    if (!userId || !format) {
      return NextResponse.json(
        { error: "userId and format are required" },
        { status: 400 }
      );
    }

    const existingExport = await Export.create({
      projectId: id,
      userId,
      format,
      status: "generating",
    });

    // In production, queue the export generation job
    // For now, mark as completed
    await Export.findByIdAndUpdate(existingExport._id, {
      status: "completed",
      filePath: `/api/exports/${existingExport._id}/download`,
    });

    return NextResponse.json({
      data: { ...existingExport.toObject(), status: "completed" },
    });
  } catch (error) {
    console.error("Error creating export:", error);
    return NextResponse.json(
      { error: "Failed to create export" },
      { status: 500 }
    );
  }
}