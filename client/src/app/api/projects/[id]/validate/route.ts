import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/db";
import { Project, Chapter, ProjectIntelligence } from "@/db/schema";
import { validateChapter } from "@/lib/ai/intelligence";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const intel = await ProjectIntelligence.findOne({ projectId: id }).lean();

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

    const chapterList = await Chapter.find({ projectId: id })
      .sort({ number: 1 })
      .lean();

    const results = [];
    let allPassed = true;
    let totalScore = 0;

    for (const chapter of chapterList) {
      if (chapter.content) {
        const validation = await validateChapter(chapter.content, intelData);
        results.push({
          chapterId: chapter._id.toString(),
          title: chapter.title,
          ...validation,
        });
        if (!validation.passed) allPassed = false;
        totalScore += validation.score;
      }
    }

    const averageScore = chapterList.length > 0 ? totalScore / chapterList.length : 0;

    await Project.findByIdAndUpdate(id, {
      status: allPassed ? "completed" : "generating",
      updatedAt: new Date(),
    });

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