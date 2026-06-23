import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/db";
import { Project, ProjectFile } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/projects/[id]/upload - Upload files
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

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Update project status
    await Project.findByIdAndUpdate(id, {
      status: "extracting",
      updatedAt: new Date(),
    });

    const uploadedFiles = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop()?.toLowerCase() || "";

      const fileType: "pdf" | "docx" | "pptx" | "txt" | "markdown" | "zip" | "image" | "sql" | "github" =
        ["pdf"].includes(ext) ? "pdf" :
        ["docx"].includes(ext) ? "docx" :
        ["pptx"].includes(ext) ? "pptx" :
        ["txt"].includes(ext) ? "txt" :
        ["md"].includes(ext) ? "markdown" :
        ["zip"].includes(ext) ? "zip" :
        ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ? "image" :
        ["sql"].includes(ext) ? "sql" :
        "txt";

      // Store file metadata and extract text content
      let extractedContent = "";

      try {
        // Basic text extraction for text-based files
        if (fileType === "txt" || fileType === "markdown" || fileType === "sql") {
          extractedContent = buffer.toString("utf-8");
        } else {
          // For binary files, store a note about file type
          extractedContent = `[${ext.toUpperCase()} file: ${file.name} - Content extraction requires specialized processing]`;
        }
      } catch {
        extractedContent = `[Error extracting content from ${file.name}]`;
      }

      const dbFile = await ProjectFile.create({
        projectId: id,
        fileName: file.name,
        fileType,
        fileSize: file.size,
        extractedContent,
        metadata: {
          mimeType: file.type,
          extension: ext,
        },
      });

      uploadedFiles.push(dbFile.toObject());
    }

    return NextResponse.json({ data: uploadedFiles }, { status: 201 });
  } catch (error) {
    console.error("Error uploading files:", error);
    return NextResponse.json(
      { error: "Failed to upload files" },
      { status: 500 }
    );
  }
}