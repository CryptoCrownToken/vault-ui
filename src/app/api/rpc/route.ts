import { NextRequest, NextResponse } from "next/server";

const HELIUS_RPC = `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const resp = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "RPC proxy error" },
      { status: 500 }
    );
  }
}
