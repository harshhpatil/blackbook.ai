import { db } from "@/db";
import { templates } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const conditions = [eq(templates.isPublic, true)];

    if (type) {
      conditions.push(eq(templates.type, type) as any);
    }

    const result = await db
      .select()
      .from(templates)
      .where(conditions.length === 1 ? conditions[0] : (conditions as any))
      .orderBy(desc(templates.createdAt));
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
    const body = await request.json();
    const { name, description, type, structure, createdBy } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [template] = await db
      .insert(templates)
      .values({
        name,
        description,
        type: type || "msbte_standard",
        structure: structure || {},
        pages: [],
        createdBy,
      })
      .returning();

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
