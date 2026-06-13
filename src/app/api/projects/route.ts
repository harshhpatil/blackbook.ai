import { connectDB } from "@/db";
import { Project } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/projects - List all projects for a user
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = parseInt(searchParams.get("offset") || "0");

    const filter: Record<string, unknown> = {};
    if (userId) {
      filter.userId = userId;
    }

    const result = await Project.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const {
      userId,
      name,
      type,
      branch,
      semester,
      academicYear,
      guideName,
      collegeName,
      teamMembers,
      description,
    } = body;

    if (!userId || !name) {
      return NextResponse.json(
        { error: "userId and name are required" },
        { status: 400 }
      );
    }

    const project = await Project.create({
      userId,
      name,
      type: type || "blackbook",
      branch,
      semester,
      academicYear,
      guideName,
      collegeName,
      teamMembers: teamMembers || [],
      description,
      status: "draft",
    });

    return NextResponse.json({ data: project.toObject() }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}