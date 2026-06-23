import { connectDB } from "@/db";
import { Template } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const filter: Record<string, unknown> = { isPublic: true };
    if (type) {
      filter.type = type;
    }

    const result = await Template.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { name, description, type, structure, createdBy } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const template = await Template.create({
      name,
      description,
      type: type || "msbte_standard",
      structure: structure || {},
      pages: [],
      createdBy: createdBy || undefined,
    });

    return NextResponse.json({ data: template.toObject() }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}