import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8000";

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const res = await fetch(`${BACKEND_URL}/status/${params.jobId}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("Proxy status error:", error);
    return NextResponse.json(
      { error: "Backend unreachable: " + error.message },
      { status: 502 }
    );
  }
}
