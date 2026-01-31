"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  repay,
  getProgram,
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

      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);
      const sig = await repay(
        program,
        wallet.publicKey,
        loanEntry.loanPDA,
        loanEntry.escrowPk
      );

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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Repay Loan</h2>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-gray-400">No active loans to repay.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4">Repay Loans</h2>
      <p className="text-gray-400 text-sm mb-6">
        Repay your JitoSOL to unlock your VAULT tokens from escrow.
      </p>

      {/* Penalty warning */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-6 text-sm text-red-300">
        <p>{"\u26A0\uFE0F"} <strong>Warning:</strong> If you do not repay within 30 days, <strong>0.10% of your locked VAULT will be burned</strong> and the loan will be extended by 30 additional days. This penalty repeats every 30 days until repayment.</p>
      </div>

      {/* List of loans */}
      <div className="space-y-4">
        {data.loans.map((loanEntry, idx) => {
          const jitosolToRepay = Number(loanEntry.loan.jitosolBorrowed) / 10 ** 9;
          const vaultLocked = Number(loanEntry.loan.vaultLocked) / 10 ** 6;
          const dueDate = new Date(Number(loanEntry.loan.dueTime) * 1000);
          const isOverdue = dueDate < new Date();
          const loanId = Number(loanEntry.loan.loanId);
          const insufficientBalance = data.userReserveBalance < jitosolToRepay;

          return (
            <div
              key={idx}
              className={`border rounded-xl p-4 ${
                isOverdue
                  ? "bg-red-500/5 border-red-500/30"
                  : "bg-gray-800 border-gray-700"
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm">
                  {"\u26A1"} Loan #{loanId}
                  {isOverdue && (
                    <span className="ml-2 text-red-400 text-xs">(OVERDUE)</span>
                  )}
                </h3>
                <span className="text-xs text-gray-500">
                  Due: {dueDate.toLocaleDateString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <p className="text-gray-400 text-xs">VAULT Locked</p>
                  <p className="font-bold">{vaultLocked.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">JitoSOL to Repay</p>
                  <p className="font-bold">{jitosolToRepay.toFixed(6)}</p>
                </div>
              </div>

              {insufficientBalance && (
                <p className="text-red-400 text-xs mb-2">
                  Insufficient JitoSOL. You need {jitosolToRepay.toFixed(6)} JitoSOL.
                </p>
              )}

              <button
                onClick={() => handleRepay(loanEntry)}
                disabled={
                  status === "pending" ||
                  insufficientBalance ||
                  !loanEntry.escrowPk
                }
                className="w-full py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400"
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
        <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
          <p className="text-green-400 text-sm font-medium">Repayment successful! VAULT unlocked.</p>
          <a
            href={solscanTx(txSig)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-300 text-xs underline"
          >
            View on Solscan &rarr;
          </a>
        </div>
      )}
      {status === "error" && (
        <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
