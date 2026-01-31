"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { repay, getProgram, DashboardData } from "@/lib/protocol";
import { solscanTx } from "@/lib/constants";

interface Props {
  data: DashboardData;
  escrowPk: string | null;
  onSuccess: () => void;
}

export default function RepayPanel({ data, escrowPk, onSuccess }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txSig, setTxSig] = useState("");
  const [error, setError] = useState("");
  const [manualEscrow, setManualEscrow] = useState("");

  const loan = data.loan;

  if (!loan) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Repay Loan</h2>
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-400 text-lg">No active loan found</p>
          <p className="text-gray-500 text-sm mt-2">
            You don&apos;t have any active loan to repay.
          </p>
        </div>
      </div>
    );
  }

  const vaultLocked = Number(loan.vaultLocked) / 10 ** 6;
  const jitosolToRepay = Number(loan.jitosolBorrowed) / 10 ** 9;
  const dueDate = new Date(Number(loan.dueTime) * 1000);
  const isOverdue = dueDate < new Date();

  const handleRepay = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return;

    const escrowKey = escrowPk || manualEscrow;
    if (!escrowKey) {
      setError("Escrow address required. Enter it below.");
      setStatus("error");
      return;
    }

    try {
      setStatus("pending");
      setError("");

      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
      const program = getProgram(provider);
      const sig = await repay(
        program,
        wallet.publicKey,
        new PublicKey(escrowKey)
      );

      setTxSig(sig);
      setStatus("success");
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Transaction failed");
      setStatus("error");
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4">Repay Loan</h2>

      {/* Loan details */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-400">VAULT Locked</span>
          <span className="font-bold">{vaultLocked.toLocaleString()} VAULT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">JitoSOL to Repay</span>
          <span className="font-bold">{jitosolToRepay.toFixed(6)} JitoSOL</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Due Date</span>
          <span className={`font-bold ${isOverdue ? "text-red-400" : "text-green-400"}`}>
            {dueDate.toLocaleDateString()} {dueDate.toLocaleTimeString()}
            {isOverdue && " (OVERDUE)"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Your JitoSOL Balance</span>
          <span className={`font-bold ${data.userReserveBalance < jitosolToRepay ? "text-red-400" : "text-green-400"}`}>
            {data.userReserveBalance.toFixed(6)} JitoSOL
          </span>
        </div>
      </div>

      {/* Insufficient balance warning */}
      {data.userReserveBalance < jitosolToRepay && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm">
            Insufficient JitoSOL. You need {jitosolToRepay.toFixed(6)} JitoSOL to repay.
          </p>
        </div>
      )}

      {/* Escrow input if not saved */}
      {!escrowPk && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4">
          <p className="text-yellow-400 text-sm mb-2">
            Escrow address not found. Paste the escrow public key from your borrow transaction:
          </p>
          <input
            type="text"
            value={manualEscrow}
            onChange={(e) => setManualEscrow(e.target.value)}
            placeholder="Escrow public key..."
            className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm outline-none text-white"
          />
        </div>
      )}

      {/* Penalty warning */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-sm text-red-300">
        <p>{"\u26A0\uFE0F"} <strong>Warning:</strong> If you do not repay within 30 days, <strong>0.10% of your locked VAULT will be burned</strong> and the loan will be extended by 30 additional days. This penalty repeats every 30 days until repayment.</p>
      </div>

      {/* Repay button */}
      <button
        onClick={handleRepay}
        disabled={
          status === "pending" ||
          data.userReserveBalance < jitosolToRepay ||
          (!escrowPk && !manualEscrow)
        }
        className="w-full py-3 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400"
      >
        {status === "pending"
          ? "Repaying..."
          : `Repay ${jitosolToRepay.toFixed(6)} JitoSOL`}
      </button>

      {/* Status */}
      {status === "success" && (
        <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
          <p className="text-green-400 text-sm font-medium">
            Repayment successful! Your {vaultLocked.toLocaleString()} VAULT have been returned.
          </p>
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
