"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  repay,
  getProgram,
  getLoanExtensionInfo,
  canLiquidate,
  DashboardData,
  LoanWithKey,
} from "@/lib/protocol";
import { solscanTx } from "@/lib/constants";

interface Props {
  data: DashboardData;
  onSuccess: () => void;
}

export default function RepayPanel({ data, onSuccess }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txSig, setTxSig] = useState("");
  const [error, setError] = useState("");
  const [repayingLoanId, setRepayingLoanId] = useState<number | null>(null);
  const [partialAmounts, setPartialAmounts] = useState<Record<number, string>>({});
  const [repayMode, setRepayMode] = useState<Record<number, "full" | "partial">>({});

  const handleRepay = async (loanEntry: LoanWithKey, partialAmount?: number) => {
    if (!wallet.publicKey || !wallet.signTransaction) return;
    if (!loanEntry.escrowPk) {
      setError("Escrow account not found for this loan.");
      setStatus("error");
      return;
    }
    try {
      setStatus("pending");
      setError("");
      setRepayingLoanId(Number(loanEntry.loan.loanId));
      const provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: "processed", commitment: "processed" });
      const program = getProgram(provider);
      const sig = await repay(program, wallet.publicKey, loanEntry.loanPDA, loanEntry.escrowPk, partialAmount);
      setTxSig(sig);
      setStatus("success");
      setRepayingLoanId(null);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Transaction failed");
      setStatus("error");
      setRepayingLoanId(null);
    }
  };

  if (data.loans.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-1">Repay</h2>
        <p className="text-neutral-500 text-sm">No active loans to repay.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Repay Loans</h2>
      <p className="text-neutral-500 text-sm mb-4">
        Repay JitoSOL to unlock your VAULT. Supports partial repayment.
      </p>

      {/* Extension explanation */}
      <div className="border border-white/5 rounded-xl p-4 mb-6 bg-white/[0.02]">
        <p className="text-neutral-400 text-xs leading-relaxed">
          Loans have a {formatDuration(data.loanDuration)} term. If not repaid by the due date, the loan
          extends and {(data.penaltyRate / 100).toFixed(1)}% of your locked VAULT is burned as penalty.
          At 100% penalty, anyone can liquidate the loan.
        </p>
      </div>

      {/* Loans list */}
      <div className="space-y-3">
        {data.loans.map((loanEntry, idx) => {
          const jitosolBorrowed = Number(loanEntry.loan.jitosolBorrowed) / 10 ** 9;
          const vaultLocked = Number(loanEntry.loan.vaultLocked) / 10 ** 6;
          const dueDate = new Date(Number(loanEntry.loan.dueTime) * 1000);
          const isOverdue = dueDate < new Date();
          const loanId = Number(loanEntry.loan.loanId);
          const extInfo = getLoanExtensionInfo(loanEntry.loan, data.loanDuration, data.penaltyRate);
          const isLiquidatable = canLiquidate(loanEntry.loan, data.loanDuration, data.penaltyRate);

          const mode = repayMode[loanId] || "full";
          const partialInput = partialAmounts[loanId] || "";
          const partialValue = parseFloat(partialInput) || 0;

          const repayAmount = mode === "partial" && partialValue > 0 ? partialValue : jitosolBorrowed;
          const insufficientBalance = data.userReserveBalance < repayAmount;

          // Calculate what user gets back for partial repay
          const repayRatio = repayAmount / jitosolBorrowed;
          const vaultPortion = vaultLocked * repayRatio;
          const penaltyPortion = extInfo.totalBurned * repayRatio;
          const vaultToReceive = Math.max(0, vaultPortion - penaltyPortion);

          return (
            <div key={idx} className={`border rounded-xl p-4 ${isLiquidatable ? "border-red-500/50" : isOverdue ? "border-red-500/30" : "border-white/10"}`}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium">
                  Loan #{idx + 1}
                  {isLiquidatable && <span className="text-red-500 text-xs ml-2 font-bold">LIQUIDATABLE</span>}
                  {!isLiquidatable && isOverdue && <span className="text-red-400 text-xs ml-2">OVERDUE</span>}
                </span>
                <span className="text-neutral-500 text-xs">Due {dueDate.toLocaleDateString()} {dueDate.toLocaleTimeString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-neutral-500 text-xs">VAULT Locked</p>
                  <p className="font-semibold">{vaultLocked.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-neutral-500 text-xs">JitoSOL Borrowed</p>
                  <p className="font-semibold">{jitosolBorrowed.toFixed(6)}</p>
                </div>
              </div>

              {extInfo.extensions > 0 && (
                <div className="grid grid-cols-3 gap-4 text-sm mb-4 pt-3 border-t border-white/5">
                  <div>
                    <p className="text-neutral-500 text-xs">Periods Overdue</p>
                    <p className="font-semibold text-red-400">{extInfo.extensions}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500 text-xs">Total Penalty</p>
                    <p className="font-semibold text-red-400">-{extInfo.totalBurned.toFixed(2)} VAULT</p>
                  </div>
                  <div>
                    <p className="text-neutral-500 text-xs">Recoverable</p>
                    <p className="font-semibold text-white">{Math.max(0, vaultLocked - extInfo.totalBurned).toFixed(2)} VAULT</p>
                  </div>
                </div>
              )}

              {isLiquidatable ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
                  <p className="text-red-400 text-xs">
                    This loan has reached 100% penalty and can be liquidated by anyone.
                    All VAULT will be burned. Repay now to close the loan yourself.
                  </p>
                </div>
              ) : (
                <>
                  {/* Repay mode toggle */}
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setRepayMode({ ...repayMode, [loanId]: "full" })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        mode === "full" ? "bg-white text-black" : "bg-white/10 text-neutral-400 hover:bg-white/20"
                      }`}
                    >
                      Full Repay
                    </button>
                    <button
                      onClick={() => setRepayMode({ ...repayMode, [loanId]: "partial" })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        mode === "partial" ? "bg-white text-black" : "bg-white/10 text-neutral-400 hover:bg-white/20"
                      }`}
                    >
                      Partial Repay
                    </button>
                  </div>

                  {mode === "partial" && (
                    <div className="mb-3">
                      <label className="text-neutral-500 text-xs mb-1 block">JitoSOL to Repay</label>
                      <input
                        type="number"
                        value={partialInput}
                        onChange={(e) => setPartialAmounts({ ...partialAmounts, [loanId]: e.target.value })}
                        placeholder={`Max: ${jitosolBorrowed.toFixed(6)}`}
                        max={jitosolBorrowed}
                        min={0}
                        step="0.000001"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30"
                      />
                      {partialValue > 0 && partialValue < jitosolBorrowed && (
                        <p className="text-neutral-400 text-xs mt-2">
                          You will receive ~{vaultToReceive.toFixed(2)} VAULT back
                          {penaltyPortion > 0 && <span className="text-red-400"> ({penaltyPortion.toFixed(2)} burned as penalty)</span>}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              {insufficientBalance && (
                <p className="text-red-400 text-xs mb-3">
                  Insufficient JitoSOL. Need {repayAmount.toFixed(6)}, have {data.userReserveBalance.toFixed(6)}.
                </p>
              )}

              <button
                onClick={() => handleRepay(loanEntry, mode === "partial" && partialValue > 0 ? partialValue : undefined)}
                disabled={status === "pending" || insufficientBalance || !loanEntry.escrowPk || (mode === "partial" && partialValue <= 0)}
                className="w-full py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-neutral-200"
              >
                {status === "pending" && repayingLoanId === loanId
                  ? "Repaying..."
                  : `Repay ${repayAmount.toFixed(6)} JitoSOL`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Status */}
      {status === "success" && (
        <div className="mt-4 border border-white/10 rounded-xl p-3">
          <p className="text-white text-sm font-medium">Repayment successful!</p>
          <a href={solscanTx(txSig)} target="_blank" rel="noopener noreferrer" className="text-neutral-400 text-xs underline hover:text-white">
            View on Solscan
          </a>
        </div>
      )}
      {status === "error" && (
        <div className="mt-4 border border-red-500/20 rounded-xl p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds >= 86400) {
    const days = Math.round(seconds / 86400);
    return `${days} day${days > 1 ? "s" : ""}`;
  }
  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
  if (seconds >= 60) {
    const mins = Math.round(seconds / 60);
    return `${mins} minute${mins > 1 ? "s" : ""}`;
  }
  return `${seconds} second${seconds > 1 ? "s" : ""}`;
}
