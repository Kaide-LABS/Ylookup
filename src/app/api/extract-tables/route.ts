import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const res = await fetch("http://127.0.0.1:8000/extract-tables", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("Proxy extract-tables error:", error);
    return NextResponse.json(
      { error: "Backend unreachable: " + error.message },
      { status: 502 }
    );
  }
}
