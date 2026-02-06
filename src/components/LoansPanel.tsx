"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  fetchAllLoans,
  getProgram,
  getLoanExtensionInfo,
  AllLoansData,
  LoanWithKey,
} from "@/lib/protocol";
import { solscanAccount } from "@/lib/constants";

interface Props {
  jitosolUsd: number;
  loanDuration: number;
  penaltyRate: number;
}

const LOANS_PER_PAGE = 10;

type SortMode = "amount" | "due";

export default function LoansPanel({ jitosolUsd, loanDuration, penaltyRate }: Props) {
  const { connection } = useConnection();
  const [data, setData] = useState<AllLoansData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("amount");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const provider = new AnchorProvider(
        connection,
        {
          publicKey: null as any,
          signTransaction: async (tx: any) => tx,
          signAllTransactions: async (txs: any) => txs,
        } as any,
        { commitment: "processed" }
      );
      const program = getProgram(provider);
      const result = await fetchAllLoans(connection, program);
      setData(result);
    } catch (err) {
      console.error("Fetch loans error:", err);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30_000); // Refresh every 30s
    return () => clearInterval(iv);
  }, [fetchData]);

  // Sort loans based on selected mode
  const sortedLoans = useMemo(() => {
    if (!data) return [];
    const loans = [...data.loans];

    if (sortMode === "amount") {
      // Sort by JitoSOL borrowed (biggest first)
      loans.sort((a, b) => Number(b.loan.jitosolBorrowed) - Number(a.loan.jitosolBorrowed));
    } else {
      // Sort by due time (soonest first, overdue at top)
      loans.sort((a, b) => Number(a.loan.dueTime) - Number(b.loan.dueTime));
    }

    return loans;
  }, [data, sortMode]);

  // Reset page when sort changes
  useEffect(() => {
    setPage(0);
  }, [sortMode]);

  const totalPages = sortedLoans.length > 0 ? Math.ceil(sortedLoans.length / LOANS_PER_PAGE) : 0;
  const startIdx = page * LOANS_PER_PAGE;
  const endIdx = startIdx + LOANS_PER_PAGE;
  const currentLoans = sortedLoans.slice(startIdx, endIdx);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Protocol Loans</h2>
      <p className="text-neutral-500 text-sm mb-6">
        View all active loans in the protocol.
      </p>

      {/* Total Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="border border-white/10 rounded-xl p-4 text-center">
          <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Total Borrowed</p>
          <p className="text-2xl font-bold">
            {data ? `${data.totalJitosolBorrowed.toFixed(4)} JitoSOL` : "..."}
          </p>
          {data && jitosolUsd > 0 && (
            <p className="text-neutral-600 text-xs mt-1">
              ~${(data.totalJitosolBorrowed * jitosolUsd).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <div className="border border-white/10 rounded-xl p-4 text-center">
          <p className="text-neutral-500 text-xs uppercase tracking-wider mb-1">Active Loans</p>
          <p className="text-2xl font-bold">
            {data ? data.loans.length : "..."}
          </p>
          {data && data.totalVaultLocked > 0 && (
            <p className="text-neutral-600 text-xs mt-1">
              {formatNum(data.totalVaultLocked)} VAULT locked
            </p>
          )}
        </div>
      </div>

      {/* Sort Toggle */}
      {data && data.loans.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-neutral-500 text-xs">Sort by:</span>
          <button
            onClick={() => setSortMode("amount")}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              sortMode === "amount"
                ? "bg-white text-black"
                : "border border-white/10 text-neutral-400 hover:text-white hover:border-white/25"
            }`}
          >
            Biggest amount
          </button>
          <button
            onClick={() => setSortMode("due")}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              sortMode === "due"
                ? "bg-white text-black"
                : "border border-white/10 text-neutral-400 hover:text-white hover:border-white/25"
            }`}
          >
            Due soonest
          </button>
        </div>
      )}

      {/* Loans List */}
      {loading && !data ? (
        <div className="text-center py-8 text-neutral-500">Loading loans...</div>
      ) : data && data.loans.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">No active loans</div>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {currentLoans.map((loanEntry, idx) => {
              const extInfo = getLoanExtensionInfo(loanEntry.loan, loanDuration, penaltyRate);
              const dueTime = Number(loanEntry.loan.dueTime);
              const now = Date.now() / 1000;
              const isOverdue = dueTime < now;
              const vaultLocked = Number(loanEntry.loan.vaultLocked) / 10 ** 6;
              const jitosolBorrowed = Number(loanEntry.loan.jitosolBorrowed) / 10 ** 9;
              const borrowerShort = loanEntry.loan.borrower.toBase58().slice(0, 4) + "..." + loanEntry.loan.borrower.toBase58().slice(-4);

              // Calculate time remaining or overdue
              const timeRemaining = dueTime - now;
              const timeText = isOverdue
                ? null
                : formatTimeRemaining(timeRemaining);

              return (
                <a
                  key={loanEntry.loanPDA.toBase58()}
                  href={solscanAccount(loanEntry.loanPDA.toBase58())}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`border rounded-xl p-4 hover:border-white/25 transition-colors cursor-pointer block ${
                    isOverdue ? "border-red-500/30" : "border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-neutral-500 text-sm font-mono">#{startIdx + idx + 1}</span>
                      <div>
                        <p className="text-sm">
                          <span className="font-semibold">{jitosolBorrowed.toFixed(4)} JitoSOL</span>
                          {jitosolUsd > 0 && (
                            <span className="text-neutral-500 ml-2">
                              (${(jitosolBorrowed * jitosolUsd).toFixed(2)})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {formatNum(vaultLocked)} VAULT locked by {borrowerShort}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {isOverdue ? (
                        <span className="text-red-400 text-xs font-medium">OVERDUE</span>
                      ) : (
                        <div>
                          <span className="text-neutral-500 text-xs block">
                            {timeText}
                          </span>
                          <span className="text-neutral-600 text-[10px]">
                            {new Date(dueTime * 1000).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {isOverdue && extInfo.totalBurned > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/5 text-xs text-red-400">
                      Penalty: {extInfo.totalBurned.toFixed(2)} VAULT ({extInfo.extensions} period{extInfo.extensions > 1 ? "s" : ""})
                    </div>
                  )}
                </a>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 text-sm border border-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:border-white/25 transition-colors"
              >
                &larr; Previous
              </button>
              <span className="text-neutral-500 text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-4 py-2 text-sm border border-white/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:border-white/25 transition-colors"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toFixed(2);
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Due now";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m left`;
  }
  if (mins > 0) {
    return `${mins}m left`;
  }
  return `${Math.floor(seconds)}s left`;
}
