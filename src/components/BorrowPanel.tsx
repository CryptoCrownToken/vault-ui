"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  borrow,
  calculateBorrowOutput,
  getProgram,
  DashboardData,
} from "@/lib/protocol";
import { solscanTx } from "@/lib/constants";

interface Props {
  data: DashboardData;
  jitosolUsd: number;
  onSuccess: () => void;
}

export default function BorrowPanel({ data, jitosolUsd, onSuccess }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "confirm" | "pending" | "success" | "error">("idle");
  const [txSig, setTxSig] = useState("");
  const [error, setError] = useState("");

  // Sanitize input: only positive numbers
  const numAmount = Math.max(0, parseFloat(amount) || 0);
  const expectedJitosol = calculateBorrowOutput(
    numAmount,
    data.reserveBalance,
    data.circulatingSupply
  );
  const expectedUsd = expectedJitosol * jitosolUsd;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Allow empty string or positive numbers only
    if (val === "" || (parseFloat(val) >= 0)) {
      setAmount(val);
    }
  };

  const handleBorrowClick = () => {
    if (numAmount <= 0 || numAmount > data.userVaultBalance) return;
    setStatus("confirm");
  };

  const handleConfirm = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || numAmount <= 0) return;
    try {
      setStatus("pending");
      setError("");
      const provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: "processed", commitment: "processed" });
      const program = getProgram(provider);
      const { sig } = await borrow(program, wallet.publicKey, numAmount, data.loanCount);
      setTxSig(sig);
      setStatus("success");
      setAmount("");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Transaction failed");
      setStatus("error");
    }
  };

  const handleCancel = () => {
    setStatus("idle");
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Borrow JitoSOL</h2>
      <p className="text-neutral-500 text-sm mb-6">
        Lock VAULT as collateral to borrow JitoSOL at floor price. Zero interest, {formatDuration(data.loanDuration)} term.
      </p>

      {/* Confirmation Modal */}
      {status === "confirm" && (
        <div className="border border-yellow-500/30 rounded-xl p-4 mb-6 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm font-medium mb-3">Confirm Borrow</p>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-neutral-400">You will lock</span>
              <span className="text-white font-semibold">{numAmount.toLocaleString()} VAULT</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">You will receive</span>
              <span className="text-white font-semibold">{expectedJitosol.toFixed(6)} JitoSOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Loan duration</span>
              <span className="text-white">{formatDuration(data.loanDuration)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Late penalty</span>
              <span className="text-red-400">{(data.penaltyRate / 100).toFixed(1)}% burn per period</span>
            </div>
          </div>
          <p className="text-neutral-500 text-xs mb-4">
            Your VAULT will be locked until you repay the borrowed JitoSOL. If you don&apos;t repay before the due date, a penalty will be applied.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm border border-white/10 text-neutral-400 hover:text-white hover:border-white/20 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm bg-white text-black hover:bg-neutral-200 transition-all"
            >
              Confirm Borrow
            </button>
          </div>
        </div>
      )}

      {status !== "confirm" && (
        <>
          {/* Overcollateral note */}
          <div className="border border-white/5 rounded-xl p-4 mb-6 bg-white/[0.02]">
            <p className="text-neutral-400 text-xs leading-relaxed">
              Since VAULT always trades at or above the floor, your collateral is always worth more than the loan.
              Use borrowed JitoSOL to earn yield elsewhere, then repay to get your VAULT back.
            </p>
          </div>

          {/* Input */}
          <div className="border border-white/10 rounded-xl p-4 mb-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-neutral-500 text-xs uppercase tracking-wider">You lock</span>
              <button
                onClick={() => setAmount(data.userVaultBalance.toString())}
                className="text-neutral-500 text-xs hover:text-white transition-colors"
              >
                MAX {data.userVaultBalance.toLocaleString()}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="bg-transparent text-2xl font-bold outline-none flex-1 w-0 placeholder-neutral-700"
                min="0"
                max={data.userVaultBalance}
              />
              <span className="text-neutral-500 text-sm font-medium">VAULT</span>
            </div>
          </div>

          {/* Output */}
          <div className="border border-white/10 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-neutral-500 text-xs uppercase tracking-wider">You receive</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">
                {expectedJitosol > 0 ? expectedJitosol.toFixed(6) : "0.00"}
              </span>
              <span className="text-neutral-500 text-sm font-medium">JitoSOL</span>
            </div>
            {expectedUsd > 0 && (
              <p className="text-neutral-600 text-xs mt-1">~${expectedUsd.toFixed(4)}</p>
            )}
          </div>

          {/* Loan details */}
          <div className="space-y-2 mb-6 text-sm text-neutral-400">
            <div className="flex justify-between">
              <span>Duration</span>
              <span className="text-white">{formatDuration(data.loanDuration)}</span>
            </div>
            <div className="flex justify-between">
              <span>Interest rate</span>
              <span className="text-white">0%</span>
            </div>
            <div className="flex justify-between">
              <span>Escrow fee</span>
              <span className="text-white">~0.00349 SOL (refunded on repay)</span>
            </div>
            <div className="flex justify-between">
              <span>Late penalty</span>
              <span className="text-neutral-500">{(data.penaltyRate / 100).toFixed(1)}% burn per {formatDuration(data.loanDuration)} overdue</span>
            </div>
          </div>

          {/* Button */}
          <button
            onClick={handleBorrowClick}
            disabled={status === "pending" || numAmount <= 0 || numAmount > data.userVaultBalance}
            className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-neutral-200"
          >
            {status === "pending" ? "Processing..." : "Lock & Borrow"}
          </button>
        </>
      )}

      {/* Status */}
      {status === "success" && (
        <div className="mt-4 border border-white/10 rounded-xl p-3">
          <p className="text-white text-sm font-medium">Borrow successful</p>
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
