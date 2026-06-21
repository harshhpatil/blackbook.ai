import { connectDB } from "@/db";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    const dbState = mongoose.connection.readyState === 1 ? true : false;
    return Response.json({ ok: dbState, timestamp: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}