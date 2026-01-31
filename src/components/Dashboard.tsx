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

  // Fetch price
  useEffect(() => {
    fetch("/api/price")
      .then((r) => r.json())
      .then((d) => {
        setJitosolUsd(d.jitosolUsd || 0);
        setApy(d.apy || 0);
      })
      .catch(() => {});
  }, []);

  // Fetch protocol data
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const provider = wallet.publicKey && wallet.signTransaction
        ? new AnchorProvider(connection, wallet as any, {
            commitment: "confirmed",
          })
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
      const result = await fetchDashboard(
        connection,
        program,
        wallet.publicKey || null
      );
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
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/vault-logo.svg" alt="VAULT" className="w-8 h-8 rounded-lg" />
          <h1 className="text-xl font-bold">VAULT Protocol</h1>
          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">
            {SOLANA_NETWORK}
          </span>
        </div>
        <WalletMultiButton />
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Floor Price</p>
            <p className="text-xl font-bold">
              {floorUsd > 0 ? `$${floorUsd.toFixed(6)}` : "..."}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {data ? `${data.floorPriceJitosol.toFixed(8)} JitoSOL` : "..."}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Reserve Value</p>
            <p className="text-xl font-bold">
              {data && jitosolUsd > 0
                ? `$${(data.reserveBalance * jitosolUsd).toFixed(2)}`
                : "..."}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {data ? `${data.reserveBalance.toFixed(4)} JitoSOL` : "..."}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Annual Yield</p>
            <p className="text-xl font-bold">
              {data && jitosolUsd > 0 && apy > 0
                ? `$${(data.reserveBalance * jitosolUsd * apy).toFixed(2)}`
                : "..."}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {apy > 0 ? `APY ${(apy * 100).toFixed(2)}%` : "Loading APY..."}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Circulating Supply</p>
            <p className="text-xl font-bold">
              {data ? formatNum(data.circulatingSupply) : "..."}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {data
                ? `\uD83D\uDD12 ${formatNum(data.totalLocked)} locked in loans`
                : "..."}
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-8 bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              How VAULT Protocol Works
            </span>
          </h2>

          {/* Core mechanics - 3 columns */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {/* Step 1 */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-xl shrink-0">
                  {"\uD83D\uDFE1"}
                </div>
                <h3 className="font-semibold text-white">JitoSOL Reserve</h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                The protocol holds a reserve of <strong className="text-purple-300">JitoSOL</strong> (liquid
                staked SOL). This reserve earns staking yield automatically,
                which means the reserve grows over time &mdash; pushing the
                floor price up forever.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-xl shrink-0">
                  {"\uD83D\uDD25"}
                </div>
                <h3 className="font-semibold text-white">Burn &amp; Arbitrage</h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Any VAULT can be <strong className="text-cyan-300">burned</strong> to
                redeem its share of the reserve at the <strong className="text-cyan-300">floor price</strong>.
                If VAULT trades below the floor on the market, anyone can buy cheap and burn for
                profit &mdash; this arbitrage <strong className="text-cyan-300">enforces the minimum price</strong>.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl shrink-0">
                  {"\uD83D\uDCB0"}
                </div>
                <h3 className="font-semibold text-white">Borrow (Overcollateralized)</h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Lock VAULT to <strong className="text-emerald-300">borrow JitoSOL</strong> at
                floor price. Since VAULT trades at or above the floor,
                your collateral is always worth <strong className="text-emerald-300">more than the loan</strong> &mdash;
                every loan is naturally overcollateralized.
              </p>
            </div>
          </div>

          {/* Economics flywheel */}
          <div className="bg-gray-800/40 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-white mb-3">{"\uD83D\uDD04"} The VAULT Flywheel</h3>
            <div className="grid md:grid-cols-4 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-purple-400 font-bold mt-0.5">1.</span>
                <p className="text-gray-400">JitoSOL reserve earns <strong className="text-purple-300">staking yield</strong> passively, growing the reserve over time</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold mt-0.5">2.</span>
                <p className="text-gray-400">Floor price <strong className="text-cyan-300">rises</strong> as reserve grows and tokens get burned</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold mt-0.5">3.</span>
                <p className="text-gray-400">Late loan penalties <strong className="text-emerald-300">burn VAULT</strong>, reducing supply and boosting floor further</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold mt-0.5">4.</span>
                <p className="text-gray-400">Deposits add to the reserve, <strong className="text-amber-300">permanently increasing</strong> the floor for all holders</p>
              </div>
            </div>
          </div>

          {/* Key points */}
          <div className="pt-5 border-t border-gray-800">
            <div className="grid md:grid-cols-4 gap-4 text-center">
              <div className="bg-gray-800/50 rounded-xl py-3 px-4">
                <p className="text-xs text-gray-400 mb-1">Floor Price</p>
                <p className="text-sm font-semibold text-green-400">{"\u2191"} Can only go up</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl py-3 px-4">
                <p className="text-xs text-gray-400 mb-1">Arbitrage</p>
                <p className="text-sm font-semibold text-purple-400">Enforces min price</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl py-3 px-4">
                <p className="text-xs text-gray-400 mb-1">Loans</p>
                <p className="text-sm font-semibold text-cyan-400">Always overcollateralized</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl py-3 px-4">
                <p className="text-xs text-gray-400 mb-1">Smart Contract</p>
                <p className="text-sm font-semibold text-amber-400">Fully on-chain</p>
              </div>
            </div>
          </div>
        </div>

        {/* User balances */}
        {wallet.publicKey && data && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Your VAULT Balance</p>
              <p className="text-2xl font-bold mt-1">{formatNum(data.userVaultBalance)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Your JitoSOL Balance</p>
              <p className="text-2xl font-bold mt-1">{data.userReserveBalance.toFixed(4)}</p>
            </div>
          </div>
        )}

        {/* Active loans */}
        {wallet.publicKey && data && data.loans.length > 0 && (
          <div className="space-y-3 mb-6">
            {data.loans.map((loanEntry, idx) => (
              <div key={idx} className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                <h3 className="text-purple-300 font-semibold mb-2">
                  {"\u26A1"} Loan #{Number(loanEntry.loan.loanId)}
                </h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">VAULT Locked</p>
                    <p className="font-bold">
                      {formatNum(Number(loanEntry.loan.vaultLocked) / 10 ** 6)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">JitoSOL Borrowed</p>
                    <p className="font-bold">
                      {(Number(loanEntry.loan.jitosolBorrowed) / 10 ** 9).toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Due Date</p>
                    <p className="font-bold">
                      {new Date(Number(loanEntry.loan.dueTime) * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Tabs */}
        {wallet.publicKey ? (
          <>
            <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1">
              {(["burn", "borrow", "repay", "deposit"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    tab === t
                      ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {t === "burn"
                    ? "\uD83D\uDD25 Burn"
                    : t === "borrow"
                    ? "\uD83D\uDCB0 Borrow"
                    : t === "repay"
                    ? "\u2705 Repay"
                    : "\uD83C\uDFE6 Deposit"}
                </button>
              ))}
            </div>

            {tab === "burn" && data && (
              <BurnPanel
                data={data}
                jitosolUsd={jitosolUsd}
                onSuccess={refresh}
              />
            )}
            {tab === "borrow" && data && (
              <BorrowPanel
                data={data}
                jitosolUsd={jitosolUsd}
                onSuccess={refresh}
              />
            )}
            {tab === "repay" && data && (
              <RepayPanel
                data={data}
                onSuccess={refresh}
              />
            )}
            {tab === "deposit" && data && (
              <DepositPanel
                data={data}
                jitosolUsd={jitosolUsd}
                onSuccess={refresh}
              />
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-gray-900 rounded-2xl border border-gray-800">
            <p className="text-gray-400 text-lg mb-4">
              Connect your wallet to interact with VAULT Protocol
            </p>
            <WalletMultiButton />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-4 text-center text-gray-500 text-sm">
        VAULT Protocol v2 &mdash; {SOLANA_NETWORK} &mdash; Floor price guaranteed by JitoSOL reserves
      </footer>
    </div>
  );
}


function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(2);
}
