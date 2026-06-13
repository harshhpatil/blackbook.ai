import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, chapters, reportPlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateChapter } from "@/lib/ai/intelligence";

export const dynamic = "force-dynamic";

// POST /api/projects/[id]/chapters - Generate all chapters
export async function POST(
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
        { error: "No report plan found" },
        { status: 400 }
      );
    }

    const chapterDefs = plan.chapters as Array<{
      title: string;
      number: number;
      targetPages: number;
      description: string;
      dependencies: string[];
    }>;

    // Delete existing chapters for this plan
    await db
      .delete(chapters)
      .where(eq(chapters.reportPlanId, plan.id));

    // Generate chapters sequentially (to avoid rate limits)
    const generatedChapters = [];
    for (const ch of chapterDefs) {
      const result = await generateChapter(projectId, plan.id, ch);
      generatedChapters.push({
        title: ch.title,
        number: ch.number,
        wordCount: result.wordCount,
        status: "completed",
      });
    }

    await db
      .update(projects)
      .set({ status: "validating", updatedAt: new Date() })
      .where(eq(projects.id, projectId));

    return NextResponse.json({ data: generatedChapters });
  } catch (error) {
    console.error("Error generating chapters:", error);
    return NextResponse.json(
      { error: "Failed to generate chapters" },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id]/chapters - Get all chapters
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);

    const chapterList = await db
      .select()
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(chapters.number);

    return NextResponse.json({ data: chapterList });
  } catch (error) {
    console.error("Error fetching chapters:", error);
    return NextResponse.json(
      { error: "Failed to fetch chapters" },
      { status: 500 }
    );
  }
}
