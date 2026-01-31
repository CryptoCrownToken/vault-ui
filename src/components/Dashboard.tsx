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

export default function Dashboard() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [data, setData] = useState<DashboardData | null>(null);
  const [jitosolUsd, setJitosolUsd] = useState<number>(0);
  const [apy, setApy] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"burn" | "borrow" | "repay">("burn");
  const [escrowPk, setEscrowPk] = useState<string | null>(null);

  // Load escrow from localStorage
  useEffect(() => {
    if (wallet.publicKey) {
      const saved = localStorage.getItem(`escrow_${wallet.publicKey.toBase58()}`);
      if (saved) setEscrowPk(saved);
    }
  }, [wallet.publicKey]);

  // Save escrow to localStorage
  const saveEscrow = useCallback(
    (pk: string) => {
      if (wallet.publicKey) {
        localStorage.setItem(`escrow_${wallet.publicKey.toBase58()}`, pk);
        setEscrowPk(pk);
      }
    },
    [wallet.publicKey]
  );

  const clearEscrow = useCallback(() => {
    if (wallet.publicKey) {
      localStorage.removeItem(`escrow_${wallet.publicKey.toBase58()}`);
      setEscrowPk(null);
    }
  }, [wallet.publicKey]);

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
      // Create a read-only provider if wallet not connected
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
    const iv = setInterval(refresh, 30_000); // refresh every 30s
    return () => clearInterval(iv);
  }, [refresh]);

  const floorUsd = data ? data.floorPriceJitosol * jitosolUsd : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-cyan-400 rounded-lg" />
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
          {/* Card 1: Floor Price in $ (big) + floor in JitoSOL (small) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Floor Price</p>
            <p className="text-xl font-bold">
              {floorUsd > 0 ? `$${floorUsd.toFixed(6)}` : "..."}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {data ? `${data.floorPriceJitosol.toFixed(8)} JitoSOL` : "..."}
            </p>
          </div>

          {/* Card 2: Reserve value in $ (big) + JitoSOL count (small) */}
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

          {/* Card 3: Annual Yield = reserve$ × APY */}
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

          {/* Card 4: Circulating Supply (big) + locked in loans (small) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Circulating Supply</p>
            <p className="text-xl font-bold">
              {data ? formatNum(data.circulatingSupply) : "..."}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {data
                ? `🔒 ${formatNum(data.totalLocked)} locked in loans`
                : "..."}
            </p>
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

        {/* Active loan */}
        {wallet.publicKey && data?.loan && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-6">
            <h3 className="text-purple-300 font-semibold mb-2">{"\u26A1"} Active Loan</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-400">VAULT Locked</p>
                <p className="font-bold">
                  {formatNum(Number(data.loan.vaultLocked) / 10 ** 6)}
                </p>
              </div>
              <div>
                <p className="text-gray-400">JitoSOL Borrowed</p>
                <p className="font-bold">
                  {(Number(data.loan.jitosolBorrowed) / 10 ** 9).toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Due Date</p>
                <p className="font-bold">
                  {new Date(Number(data.loan.dueTime) * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Tabs */}
        {wallet.publicKey ? (
          <>
            <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1">
              {(["burn", "borrow", "repay"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    tab === t
                      ? "bg-gradient-to-r from-purple-600 to-cyan-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {t === "burn" ? "\uD83D\uDD25 Burn" : t === "borrow" ? "\uD83D\uDCB0 Borrow" : "\u2705 Repay"}
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
                onSuccess={(pk) => {
                  saveEscrow(pk);
                  refresh();
                }}
                hasActiveLoan={!!data.loan}
              />
            )}
            {tab === "repay" && data && (
              <RepayPanel
                data={data}
                escrowPk={escrowPk}
                onSuccess={() => {
                  clearEscrow();
                  refresh();
                }}
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
