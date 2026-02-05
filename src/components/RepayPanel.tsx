"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  repay,
  getProgram,
  getLoanExtensionInfo,
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

  const handleRepay = async (loanEntry: LoanWithKey) => {
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
      const sig = await repay(program, wallet.publicKey, loanEntry.loanPDA, loanEntry.escrowPk);
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
        Repay JitoSOL to unlock your VAULT from escrow.
      </p>

      {/* Extension explanation */}
      <div className="border border-white/5 rounded-xl p-4 mb-6 bg-white/[0.02]">
        <p className="text-neutral-400 text-xs leading-relaxed">
          Loans have a {formatDuration(data.loanDuration)} term. If not repaid by the due date, the loan automatically
          extends for another {formatDuration(data.loanDuration)} and {(data.penaltyRate / 100).toFixed(1)}% of your locked VAULT is burned as a penalty.
          This can repeat indefinitely. Repay early to avoid any burn.
        </p>
      </div>

      {/* Loans list */}
      <div className="space-y-3">
        {data.loans.map((loanEntry, idx) => {
          const jitosolToRepay = Number(loanEntry.loan.jitosolBorrowed) / 10 ** 9;
          const vaultLocked = Number(loanEntry.loan.vaultLocked) / 10 ** 6;
          const dueDate = new Date(Number(loanEntry.loan.dueTime) * 1000);
          const isOverdue = dueDate < new Date();
          const loanId = Number(loanEntry.loan.loanId);
          const insufficientBalance = data.userReserveBalance < jitosolToRepay;
          const extInfo = getLoanExtensionInfo(loanEntry.loan, data.loanDuration, data.penaltyRate);

          return (
            <div key={idx} className={`border rounded-xl p-4 ${isOverdue ? "border-red-500/30" : "border-white/10"}`}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium">
                  Loan #{idx + 1}
                  {isOverdue && <span className="text-red-400 text-xs ml-2">OVERDUE</span>}
                </span>
                <span className="text-neutral-500 text-xs">Due {dueDate.toLocaleDateString()} {dueDate.toLocaleTimeString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-neutral-500 text-xs">VAULT Locked</p>
                  <p className="font-semibold">{vaultLocked.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-neutral-500 text-xs">JitoSOL to Repay</p>
                  <p className="font-semibold">{jitosolToRepay.toFixed(6)}</p>
                </div>
              </div>

              {extInfo.extensions > 0 && (
                <div className="grid grid-cols-3 gap-4 text-sm mb-4 pt-3 border-t border-white/5">
                  <div>
                    <p className="text-neutral-500 text-xs">Periods Overdue</p>
                    <p className="font-semibold text-red-400">{extInfo.extensions}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500 text-xs">Penalty</p>
                    <p className="font-semibold text-red-400">-{extInfo.totalBurned.toFixed(2)} VAULT</p>
                  </div>
                  <div>
                    <p className="text-neutral-500 text-xs">You Receive</p>
                    <p className="font-semibold text-white">{(vaultLocked - extInfo.totalBurned).toFixed(2)} VAULT</p>
                  </div>
                </div>
              )}

              {insufficientBalance && (
                <p className="text-red-400 text-xs mb-3">
                  Insufficient JitoSOL. Need {jitosolToRepay.toFixed(6)}.
                </p>
              )}

              <button
                onClick={() => handleRepay(loanEntry)}
                disabled={status === "pending" || insufficientBalance || !loanEntry.escrowPk}
                className="w-full py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-neutral-200"
              >
                {status === "pending" && repayingLoanId === loanId
                  ? "Repaying..."
                  : `Repay ${jitosolToRepay.toFixed(6)} JitoSOL`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Status */}
      {status === "success" && (
        <div className="mt-4 border border-white/10 rounded-xl p-3">
          <p className="text-white text-sm font-medium">Repayment successful. VAULT unlocked.</p>
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
