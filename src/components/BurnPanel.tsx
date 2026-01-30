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

  const handleBurn = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || numAmount <= 0) return;

    try {
      setStatus("pending");
      setError("");

      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
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
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4">Burn VAULT &rarr; Redeem JitoSOL</h2>
      <p className="text-gray-400 text-sm mb-6">
        Burn your VAULT tokens to receive JitoSOL at the guaranteed floor price.
        Burned tokens are permanently destroyed.
      </p>

      {/* Input */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400 text-sm">You burn</span>
          <button
            onClick={() => setAmount(data.userVaultBalance.toString())}
            className="text-purple-400 text-xs hover:text-purple-300"
          >
            MAX: {data.userVaultBalance.toLocaleString()} VAULT
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-transparent text-2xl font-bold outline-none flex-1 w-0"
            min="0"
            max={data.userVaultBalance}
          />
          <span className="text-gray-400 font-medium">VAULT</span>
        </div>
      </div>

      {/* Arrow */}
      <div className="flex justify-center my-2">
        <div className="bg-gray-800 rounded-lg p-2">
          <span className="text-gray-400">&darr;</span>
        </div>
      </div>

      {/* Output */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400 text-sm">You receive</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">
            {expectedJitosol > 0 ? expectedJitosol.toFixed(6) : "0.00"}
          </span>
          <span className="text-gray-400 font-medium">JitoSOL</span>
        </div>
        {expectedUsd > 0 && (
          <p className="text-gray-500 text-sm mt-1">&asymp; ${expectedUsd.toFixed(4)}</p>
        )}
      </div>

      {/* Button */}
      <button
        onClick={handleBurn}
        disabled={status === "pending" || numAmount <= 0 || numAmount > data.userVaultBalance}
        className="w-full py-3 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400"
      >
        {status === "pending" ? "Burning..." : "Burn VAULT"}
      </button>

      {/* Status */}
      {status === "success" && (
        <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
          <p className="text-green-400 text-sm font-medium">Burn successful!</p>
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
