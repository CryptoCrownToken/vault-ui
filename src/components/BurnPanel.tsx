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
      <p className="text-gray-400 text-sm mb-4">
        Burn your VAULT tokens to receive JitoSOL at the guaranteed floor price.
        Burned tokens are permanently destroyed, reducing supply and increasing the floor for everyone.
      </p>

      {/* Floor price card */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-sm font-medium">Guaranteed Floor Price</span>
          <span className="text-lg font-bold text-white">
            {floorPriceUsd > 0 ? `$${floorPriceUsd.toFixed(6)}` : "..."}
          </span>
        </div>
        <p className="text-gray-500 text-xs mb-3">
          {data.floorPriceJitosol > 0 ? `${data.floorPriceJitosol.toFixed(10)} JitoSOL per VAULT` : "..."}
        </p>

        {/* Arbitrage explanation */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
          <p className="text-emerald-300 text-xs font-semibold mb-1">
            {"\uD83D\uDCA1"} Arbitrage Opportunity
          </p>
          <p className="text-emerald-200/70 text-xs leading-relaxed">
            If VAULT trades <strong>below</strong> this floor price on the market, you can <strong>buy cheap VAULT
            and burn it here</strong> to receive more JitoSOL than what you paid - guaranteed profit.
            This arbitrage mechanism is what enforces the floor price: it will always be profitable
            to buy and burn until market price meets the floor.
          </p>
        </div>
      </div>

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
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
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

      {/* Impact info */}
      {numAmount > 0 && data.circulatingSupply > 0 && (
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 mb-4 text-xs text-cyan-300">
          <p className="font-semibold mb-1">{"\u2728"} After this burn</p>
          <p>
            New floor price:{" "}
            <strong>
              {(
                (data.reserveBalance - expectedJitosol) /
                (data.circulatingSupply - numAmount)
              ).toFixed(10)}{" "}
              JitoSOL
            </strong>{" "}
            (unchanged - burning is proportional)
          </p>
          <p>New circulating supply: <strong>{(data.circulatingSupply - numAmount).toLocaleString()} VAULT</strong></p>
        </div>
      )}

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
