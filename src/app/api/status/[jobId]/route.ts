import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const res = await fetch(`http://127.0.0.1:8000/status/${params.jobId}`);
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
