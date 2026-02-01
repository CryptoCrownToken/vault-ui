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
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txSig, setTxSig] = useState("");
  const [error, setError] = useState("");

  const numAmount = parseFloat(amount) || 0;
  const expectedJitosol = calculateBorrowOutput(
    numAmount,
    data.reserveBalance,
    data.circulatingSupply
  );
  const expectedUsd = expectedJitosol * jitosolUsd;

  const handleBorrow = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || numAmount <= 0) return;
    try {
      setStatus("pending");
      setError("");
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
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

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Borrow JitoSOL</h2>
      <p className="text-neutral-500 text-sm mb-6">
        Lock VAULT as collateral to borrow JitoSOL at floor price. Zero interest, 30-day term.
      </p>

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
            onChange={(e) => setAmount(e.target.value)}
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
          <span className="text-white">30 days</span>
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
          <span className="text-neutral-500">0.10% burn per 30 days overdue</span>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={handleBorrow}
        disabled={status === "pending" || numAmount <= 0 || numAmount > data.userVaultBalance}
        className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-neutral-200"
      >
        {status === "pending" ? "Processing..." : "Lock & Borrow"}
      </button>

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
