"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import {
  burnToRedeem,
  calculateBurnOutput,
  getProgram,
  DashboardData,
} from "@/lib/protocol";
import { solscanTx } from "@/lib/constants";

interface Props {
  data: DashboardData;
  jitosolUsd: number;
  onSuccess: () => void;
}

export default function BurnPanel({ data, jitosolUsd, onSuccess }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txSig, setTxSig] = useState("");
  const [error, setError] = useState("");

  const numAmount = parseFloat(amount) || 0;
  const expectedJitosol = calculateBurnOutput(
    numAmount,
    data.reserveBalance,
    data.circulatingSupply
  );
  const expectedUsd = expectedJitosol * jitosolUsd;
  const floorPriceUsd = data.floorPriceJitosol * jitosolUsd;

  const handleBurn = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || numAmount <= 0) return;
    try {
      setStatus("pending");
      setError("");
      const provider = new AnchorProvider(connection, wallet as any, { commitment: "confirmed" });
      const program = getProgram(provider);
      const sig = await burnToRedeem(program, wallet.publicKey, numAmount);
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
      <h2 className="text-lg font-semibold mb-1">Burn VAULT</h2>
      <p className="text-neutral-500 text-sm mb-6">
        Redeem JitoSOL at the floor price. Burned tokens are permanently destroyed.
      </p>

      {/* Floor price */}
      <div className="border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500 text-sm">Floor Price</span>
          <div className="text-right">
            <span className="font-semibold">{floorPriceUsd > 0 ? `$${floorPriceUsd.toFixed(6)}` : "..."}</span>
            <p className="text-neutral-600 text-xs">
              {data.floorPriceJitosol > 0 ? `${data.floorPriceJitosol.toFixed(10)} JitoSOL` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Arbitrage note */}
      <div className="border border-white/5 rounded-xl p-4 mb-6 bg-white/[0.02]">
        <p className="text-neutral-400 text-xs leading-relaxed">
          If VAULT trades below the floor on the market, you can buy cheap and burn here for
          profit. This arbitrage is what enforces the minimum price.
        </p>
      </div>

      {/* Input */}
      <div className="border border-white/10 rounded-xl p-4 mb-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-neutral-500 text-xs uppercase tracking-wider">You burn</span>
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

      {/* Impact */}
      {numAmount > 0 && data.circulatingSupply > 0 && (
        <div className="border border-white/5 rounded-xl p-3 mb-6 bg-white/[0.02]">
          <p className="text-neutral-500 text-xs mb-1">After this burn</p>
          <p className="text-neutral-400 text-xs">
            Supply: {(data.circulatingSupply - numAmount).toLocaleString()} VAULT
            {" "} - {" "}
            Floor price unchanged (proportional burn)
          </p>
        </div>
      )}

      {/* Button */}
      <button
        onClick={handleBurn}
        disabled={status === "pending" || numAmount <= 0 || numAmount > data.userVaultBalance}
        className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-neutral-200"
      >
        {status === "pending" ? "Burning..." : "Burn VAULT"}
      </button>

      {/* Status */}
      {status === "success" && (
        <div className="mt-4 border border-white/10 rounded-xl p-3">
          <p className="text-white text-sm font-medium">Burn successful</p>
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
