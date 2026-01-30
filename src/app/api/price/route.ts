import { NextResponse } from "next/server";

// Cache: store price + apy + timestamp
let cached: { jitosolUsd: number; apy: number; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  // Return cached if fresh
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({
      jitosolUsd: cached.jitosolUsd,
      apy: cached.apy,
      cached: true,
      cachedAt: new Date(cached.timestamp).toISOString(),
    });
  }

  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ jitosolUsd: 0, apy: 0, error: "No API key" }, { status: 500 });
  }

  try {
    // Fetch JitoSOL price + Jito APY in parallel
    const [cmcRes, jitoRes] = await Promise.all([
      // JitoSOL CMC ID = 22533 (Jito Staked SOL)
      fetch(
        "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=22533",
        {
          headers: {
            "X-CMC_PRO_API_KEY": apiKey,
            Accept: "application/json",
          },
        }
      ),
      // Jito stake pool stats for APY
      fetch("https://kobe.mainnet.jito.network/api/v1/stake_pool_stats", {
        method: "GET",
        headers: { Accept: "application/json" },
      }).catch(() => null),
    ]);

    if (!cmcRes.ok) {
      throw new Error(`CMC API returned ${cmcRes.status}`);
    }

    const cmcData = await cmcRes.json();
    const jitosolUsd = cmcData?.data?.["22533"]?.quote?.USD?.price || 0;

    // Parse Jito APY
    // API returns { apy: [{data: 0.0608, date: "..."}, ...], ... }
    let apy = 0;
    if (jitoRes && jitoRes.ok) {
      try {
        const jitoData = await jitoRes.json();
        if (jitoData.apy && Array.isArray(jitoData.apy) && jitoData.apy.length > 0) {
          // Get latest APY entry (already a decimal like 0.0608 = 6.08%)
          const latest = jitoData.apy[jitoData.apy.length - 1];
          apy = latest.data || 0;
        }
      } catch {
        apy = 0;
      }
    }

    // Update cache
    cached = { jitosolUsd, apy, timestamp: Date.now() };

    return NextResponse.json({
      jitosolUsd,
      apy,
      cached: false,
      cachedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("API error:", err.message);

    // Return stale cache if available
    if (cached) {
      return NextResponse.json({
        jitosolUsd: cached.jitosolUsd,
        apy: cached.apy,
        cached: true,
        stale: true,
        cachedAt: new Date(cached.timestamp).toISOString(),
      });
    }

    return NextResponse.json({ jitosolUsd: 0, apy: 0, error: err.message }, { status: 500 });
  }
}
