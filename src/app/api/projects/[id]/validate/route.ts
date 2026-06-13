import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, chapters, projectIntelligence } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateChapter } from "@/lib/ai/intelligence";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const projectId = parseInt(id);

    const [intel] = await db
      .select()
      .from(projectIntelligence)
      .where(eq(projectIntelligence.projectId, projectId));

    if (!intel) {
      return NextResponse.json({ error: "No intelligence found" }, { status: 400 });
    }

    const intelData = {
      problemStatement: intel.problemStatement || "",
      objectives: (intel.objectives as string[]) || [],
      features: (intel.features as string[]) || [],
      modules: (intel.modules as string[]) || [],
      users: (intel.users as string[]) || [],
      workflows: (intel.workflows as string[]) || [],
      technologyStack: (intel.technologyStack as string[]) || [],
      databaseEntities: (intel.databaseEntities as string[]) || [],
      algorithms: (intel.algorithms as string[]) || [],
      screens: (intel.screens as string[]) || [],
      summary: intel.summary || "",
    };

    const chapterList = await db
      .select()
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(chapters.number);

    const results = [];
    let allPassed = true;
    let totalScore = 0;

    for (const chapter of chapterList) {
      if (chapter.content) {
        const validation = await validateChapter(chapter.content, intelData);
        results.push({
          chapterId: chapter.id,
          title: chapter.title,
          ...validation,
        });
        if (!validation.passed) allPassed = false;
        totalScore += validation.score;
      }
    }

    const averageScore = chapterList.length > 0 ? totalScore / chapterList.length : 0;

    await db
      .update(projects)
      .set({
        status: allPassed ? "completed" : "generating",
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    return NextResponse.json({
      data: {
        results,
        averageScore,
        allPassed,
        totalChapters: chapterList.length,
      },
    });
  } catch (error) {
    console.error("Error validating chapters:", error);
    return NextResponse.json(
      { error: "Failed to validate chapters" },
      { status: 500 }
    );
  }
}
