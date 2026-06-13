import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, projectFiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/projects/[id]/upload - Upload files
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

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Update project status
    await db
      .update(projects)
      .set({ status: "extracting", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    const uploadedFiles = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      
      let fileType: string = "txt";
      if (["pdf"].includes(ext)) fileType = "pdf";
      else if (["docx"].includes(ext)) fileType = "docx";
      else if (["pptx"].includes(ext)) fileType = "pptx";
      else if (["txt"].includes(ext)) fileType = "txt";
      else if (["md"].includes(ext)) fileType = "markdown";
      else if (["zip"].includes(ext)) fileType = "zip";
      else if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) fileType = "image";
      else if (["sql"].includes(ext)) fileType = "sql";

      // Store file metadata and extract text content
      let extractedContent = "";

      try {
        // Basic text extraction for text-based files
        if (fileType === "txt" || fileType === "markdown") {
          extractedContent = buffer.toString("utf-8");
        } else if (fileType === "sql") {
          extractedContent = buffer.toString("utf-8");
        } else {
          // For binary files, store a note about file type
          extractedContent = `[${ext.toUpperCase()} file: ${file.name} - Content extraction requires specialized processing]`;
        }
      } catch {
        extractedContent = `[Error extracting content from ${file.name}]`;
      }

      const [dbFile] = await db
        .insert(projectFiles)
        .values({
          projectId,
          fileName: file.name,
          fileType: fileType as any,
          fileSize: file.size,
          extractedContent,
          metadata: {
            mimeType: file.type,
            extension: ext,
          },
        })
        .returning();

      uploadedFiles.push(dbFile);
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
