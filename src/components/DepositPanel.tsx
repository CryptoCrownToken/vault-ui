"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  depositReserve,
  getProgram,
  DashboardData,
} from "@/lib/protocol";
import { solscanTx } from "@/lib/constants";

interface Props {
  data: DashboardData;
  jitosolUsd: number;
  onSuccess: () => void;
}

export default function DepositPanel({ data, jitosolUsd, onSuccess }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txSig, setTxSig] = useState("");
  const [error, setError] = useState("");

  const numAmount = parseFloat(amount) || 0;
  const usdValue = numAmount * jitosolUsd;

  const handleDeposit = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || numAmount <= 0) return;
    try {
      setStatus("pending");
      setError("");
      const provider = new AnchorProvider(connection, wallet as any, { preflightCommitment: "processed", commitment: "processed" });
      const program = getProgram(provider);
      const sig = await depositReserve(program, wallet.publicKey, numAmount);
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
      <h2 className="text-lg font-semibold mb-1">Deposit JitoSOL</h2>
      <p className="text-neutral-500 text-sm mb-6">
        Contribute to the reserve. This increases the floor price for all VAULT holders.
      </p>

      {/* Warning */}
      <div className="border border-neutral-800 rounded-xl p-4 mb-6 bg-white/[0.02]">
        <p className="text-neutral-300 text-xs font-medium mb-1">Irreversible</p>
        <p className="text-neutral-500 text-xs leading-relaxed">
          Deposited JitoSOL goes directly into the reserve and cannot be withdrawn.
          Only deposit if you intend to contribute to the protocol.
        </p>
      </div>

      {/* Current reserve */}
      <div className="border border-white/10 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-neutral-500 text-xs">Current Reserve</p>
            <p className="font-semibold">{data.reserveBalance.toFixed(4)} JitoSOL</p>
            {jitosolUsd > 0 && (
              <p className="text-neutral-600 text-xs">${(data.reserveBalance * jitosolUsd).toFixed(2)}</p>
            )}
          </div>
          <div>
            <p className="text-neutral-500 text-xs">Current Floor</p>
            <p className="font-semibold">
              {data.floorPriceJitosol > 0 ? `${data.floorPriceJitosol.toFixed(10)}` : "N/A"}
            </p>
            {jitosolUsd > 0 && data.floorPriceJitosol > 0 && (
              <p className="text-neutral-600 text-xs">${(data.floorPriceJitosol * jitosolUsd).toFixed(8)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-neutral-500 text-xs uppercase tracking-wider">You deposit</span>
          <button
            onClick={() => setAmount(data.userReserveBalance.toFixed(9))}
            className="text-neutral-500 text-xs hover:text-white transition-colors"
          >
            MAX {data.userReserveBalance.toFixed(4)}
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
            step="0.001"
          />
          <span className="text-neutral-500 text-sm font-medium">JitoSOL</span>
        </div>
        {usdValue > 0 && (
          <p className="text-neutral-600 text-xs mt-1">~${usdValue.toFixed(2)}</p>
        )}
      </div>

      {/* Impact */}
      {numAmount > 0 && data.circulatingSupply > 0 && (() => {
        const newFloorJitosol = (data.reserveBalance + numAmount) / data.circulatingSupply;
        const newFloorUsd = newFloorJitosol * jitosolUsd;
        return (
          <div className="border border-white/5 rounded-xl p-3 mb-6 bg-white/[0.02]">
            <p className="text-neutral-500 text-xs mb-1">Impact preview</p>
            <p className="text-neutral-300 text-xs">
              New floor: <span className="text-white font-medium">{newFloorJitosol.toFixed(10)} JitoSOL</span>
              {newFloorUsd > 0 && (
                <span className="text-neutral-500"> (~${newFloorUsd.toFixed(6)})</span>
              )}
            </p>
            <p className="text-neutral-300 text-xs">
              Increase: <span className="text-white font-medium">+{((numAmount / (data.reserveBalance || 1)) * 100).toFixed(4)}%</span>
            </p>
          </div>
        );
      })()}

      {/* Button */}
      <button
        onClick={handleDeposit}
        disabled={status === "pending" || numAmount <= 0 || numAmount > data.userReserveBalance}
        className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-neutral-200"
      >
        {status === "pending" ? "Depositing..." : "Deposit to Reserve"}
      </button>

      {/* Status */}
      {status === "success" && (
        <div className="mt-4 border border-white/10 rounded-xl p-3">
          <p className="text-white text-sm font-medium">Deposit successful</p>
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
