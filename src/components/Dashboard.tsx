"use client";

import { useEffect, useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  fetchDashboard,
  getProgram,
  DashboardData,
} from "@/lib/protocol";
import { SOLANA_NETWORK } from "@/lib/constants";
import BurnPanel from "./BurnPanel";
import BorrowPanel from "./BorrowPanel";
import RepayPanel from "./RepayPanel";
import DepositPanel from "./DepositPanel";

export default function Dashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [data, setData] = useState<DashboardData | null>(null);
  const [jitosolUsd, setJitosolUsd] = useState<number>(0);
  const [apy, setApy] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"burn" | "borrow" | "repay" | "deposit">("burn");

  useEffect(() => {
    fetch("/api/price")
      .then((r) => r.json())
      .then((d) => {
        setJitosolUsd(d.jitosolUsd || 0);
        setApy(d.apy || 0);
      })
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const provider = wallet.publicKey && wallet.signTransaction
        ? new AnchorProvider(connection, wallet as any, { commitment: "confirmed" })
        : new AnchorProvider(
            connection,
            {
              publicKey: null as any,
              signTransaction: async (tx: any) => tx,
              signAllTransactions: async (txs: any) => txs,
            } as any,
            { commitment: "confirmed" }
          );

      const program = getProgram(provider);
      const result = await fetchDashboard(connection, program, wallet.publicKey || null);
      setData(result);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30_000);
    return () => clearInterval(iv);
  }, [refresh]);

  const floorUsd = data ? data.floorPriceJitosol * jitosolUsd : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/vault-logo.svg" alt="VAULT" className="w-7 h-7" />
            <span className="text-lg font-semibold tracking-tight">VAULT</span>
            <span className="text-[10px] uppercase tracking-widest text-neutral-500 border border-neutral-800 px-2 py-0.5 rounded-full">
              {SOLANA_NETWORK}
            </span>
          </div>
          <WalletMultiButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6">
        {/* ── Hero ── */}
        <section className="pt-16 pb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            A floor price you can trust.
          </h1>
          <p className="text-neutral-400 text-lg max-w-xl mx-auto leading-relaxed">
            Every VAULT token is backed by JitoSOL reserves. Burn to redeem, borrow at zero interest,
            or arbitrage below the floor.
          </p>
        </section>

        {/* ── Stats ── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden mb-16">
          <StatCard
            label="Floor Price"
            value={floorUsd > 0 ? `$${floorUsd.toFixed(6)}` : "..."}
            sub={data ? `${data.floorPriceJitosol.toFixed(8)} JitoSOL` : ""}
          />
          <StatCard
            label="Reserve"
            value={data && jitosolUsd > 0 ? `$${(data.reserveBalance * jitosolUsd).toFixed(2)}` : "..."}
            sub={data ? `${data.reserveBalance.toFixed(4)} JitoSOL` : ""}
          />
          <StatCard
            label="Annual Yield"
            value={data && jitosolUsd > 0 && apy > 0 ? `$${(data.reserveBalance * jitosolUsd * apy).toFixed(2)}` : "..."}
            sub={apy > 0 ? `APY ${(apy * 100).toFixed(2)}%` : ""}
          />
          <StatCard
            label="Circulating"
            value={data ? formatNum(data.circulatingSupply) : "..."}
            sub={data ? `${formatNum(data.totalLocked)} locked in loans` : ""}
          />
        </section>

        {/* ── How It Works ── */}
        <section className="mb-16">
          <h2 className="text-sm uppercase tracking-widest text-neutral-500 mb-6">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="text-2xl mb-3">01</div>
              <h3 className="text-white font-semibold mb-2">JitoSOL Reserve</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                The protocol holds a shared reserve of JitoSOL. Every VAULT holder
                owns a proportional share. The reserve grows from trading fees and
                JitoSOL staking yield.
              </p>
            </div>
            <div>
              <div className="text-2xl mb-3">02</div>
              <h3 className="text-white font-semibold mb-2">Burn & Arbitrage</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Burn VAULT to redeem JitoSOL at the floor price. If VAULT trades
                below the floor, buy cheap and burn for profit. This
                arbitrage enforces the minimum price.
              </p>
            </div>
            <div>
              <div className="text-2xl mb-3">03</div>
              <h3 className="text-white font-semibold mb-2">Interest-Free Loans</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Lock VAULT to borrow JitoSOL at zero interest. Use the JitoSOL to
                earn yield elsewhere, then repay to get your VAULT back. Your
                collateral always exceeds the loan value.
              </p>
            </div>
          </div>
        </section>

        {/* ── Wallet Section ── */}
        {wallet.publicKey && data && (
          <>
            {/* Balances */}
            <section className="grid grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden mb-8">
              <div className="bg-black p-5 text-center">
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Your Vault Available</p>
                <p className="text-2xl font-bold">{formatNum(data.userVaultBalance)}</p>
                {data.circulatingSupply > 0 && (
                  <p className="text-neutral-600 text-xs mt-1">
                    {((data.userVaultBalance / (data.circulatingSupply + data.totalLocked)) * 100).toFixed(2)}% of supply
                  </p>
                )}
              </div>
              <div className="bg-black p-5 text-center">
                <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Your Vault Floor Value</p>
                <p className="text-2xl font-bold">
                  {floorUsd > 0 ? `$${(data.userVaultBalance * floorUsd).toFixed(2)}` : "..."}
                </p>
                <p className="text-neutral-600 text-xs mt-1">
                  {data.floorPriceJitosol > 0 ? `${(data.userVaultBalance * data.floorPriceJitosol).toFixed(4)} JitoSOL` : ""}
                </p>
              </div>
            </section>

            {/* Active Loans */}
            {data.loans.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm uppercase tracking-widest text-neutral-500 mb-4">Active Loans</h2>
                <div className="space-y-2">
                  {data.loans.map((loanEntry, idx) => (
                    <div key={idx} className="border border-white/10 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <span className="text-neutral-500 text-sm">#{idx + 1}</span>
                        <div>
                          <p className="text-sm">
                            <span className="text-neutral-400">Locked </span>
                            <span className="font-semibold">{formatNum(Number(loanEntry.loan.vaultLocked) / 10 ** 6)} VAULT</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-sm">
                            <span className="text-neutral-400">Borrowed </span>
                            <span className="font-semibold">{(Number(loanEntry.loan.jitosolBorrowed) / 10 ** 9).toFixed(4)} JitoSOL</span>
                          </p>
                        </div>
                      </div>
                      <span className="text-neutral-500 text-xs">
                        Due {new Date(Number(loanEntry.loan.dueTime) * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Action Tabs */}
            <section className="mb-16">
              <div className="grid grid-cols-4 border-b border-white/10 mb-8">
                {(["burn", "borrow", "repay", "deposit"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`py-3 text-sm font-medium transition-all relative ${
                      tab === t
                        ? "text-white"
                        : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    {t === "burn" ? "Burn" : t === "borrow" ? "Borrow" : t === "repay" ? "Repay" : "Deposit"}
                    {tab === t && (
                      <span className="absolute bottom-0 left-0 right-0 h-px bg-white" />
                    )}
                  </button>
                ))}
              </div>

              <div>
                {tab === "burn" && <BurnPanel data={data} jitosolUsd={jitosolUsd} onSuccess={refresh} />}
                {tab === "borrow" && <BorrowPanel data={data} jitosolUsd={jitosolUsd} onSuccess={refresh} />}
                {tab === "repay" && <RepayPanel data={data} onSuccess={refresh} />}
                {tab === "deposit" && <DepositPanel data={data} jitosolUsd={jitosolUsd} onSuccess={refresh} />}
              </div>
            </section>
          </>
        )}

        {/* Connect prompt */}
        {!wallet.publicKey && (
          <section className="text-center py-20 mb-16">
            <p className="text-neutral-500 mb-6">Connect your wallet to get started</p>
            <WalletMultiButton />
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between text-neutral-600 text-xs">
          <span>VAULT Protocol</span>
          <span>{SOLANA_NETWORK}</span>
        </div>
      </footer>
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-black p-5 text-center">
      <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-neutral-600 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(2);
}
