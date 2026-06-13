import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/db";
import { Project, Chapter, ReportPlan } from "@/db/schema";
import { generateChapter } from "@/lib/ai/intelligence";

export const dynamic = "force-dynamic";

// POST /api/projects/[id]/chapters - Generate all chapters
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const plan = await ReportPlan.findOne({ projectId: id }).lean();
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
    await Chapter.deleteMany({ reportPlanId: plan._id });

    // Generate chapters sequentially (to avoid rate limits)
    const generatedChapters = [];
    for (const ch of chapterDefs) {
      const result = await generateChapter(id, plan._id.toString(), ch);
      generatedChapters.push({
        title: ch.title,
        number: ch.number,
        wordCount: result.wordCount,
        status: "completed",
      });
    }

    await Project.findByIdAndUpdate(id, {
      status: "validating",
      updatedAt: new Date(),
    });

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
    await connectDB();
    const { id } = await params;

    const chapterList = await Chapter.find({ projectId: id })
      .sort({ number: 1 })
      .lean();

    return NextResponse.json({ data: chapterList });
  } catch (error) {
    console.error("Error fetching chapters:", error);
    return NextResponse.json(
      { error: "Failed to fetch chapters" },
      { status: 500 }
    );
  }
}