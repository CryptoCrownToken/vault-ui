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

      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
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
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4">Deposit JitoSOL to Reserve</h2>
      <p className="text-gray-400 text-sm mb-6">
        Contribute JitoSOL to the VAULT Protocol reserve. This strengthens the
        floor price for all VAULT holders.
      </p>

      {/* Warning */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
        <p className="text-amber-300 text-sm font-semibold mb-2">
          {"\u26A0\uFE0F"} Irreversible Action
        </p>
        <p className="text-amber-200/80 text-sm leading-relaxed">
          Deposited JitoSOL goes directly into the VAULT Protocol reserve and
          <strong> cannot be withdrawn</strong>. This permanently increases the
          floor price for all VAULT holders. Only deposit if you intend to
          contribute to the protocol.
        </p>
      </div>

      {/* Current reserve info */}
      <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Current Reserve</p>
            <p className="font-bold text-white">{data.reserveBalance.toFixed(4)} JitoSOL</p>
            {jitosolUsd > 0 && (
              <p className="text-gray-500 text-xs">${(data.reserveBalance * jitosolUsd).toFixed(2)}</p>
            )}
          </div>
          <div>
            <p className="text-gray-400">Current Floor Price</p>
            <p className="font-bold text-white">
              {data.floorPriceJitosol > 0
                ? `${data.floorPriceJitosol.toFixed(10)} JitoSOL`
                : "N/A"}
            </p>
            {jitosolUsd > 0 && data.floorPriceJitosol > 0 && (
              <p className="text-gray-500 text-xs">
                ${(data.floorPriceJitosol * jitosolUsd).toFixed(8)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400 text-sm">You deposit</span>
          <button
            onClick={() => setAmount(data.userReserveBalance.toFixed(9))}
            className="text-purple-400 text-xs hover:text-purple-300"
          >
            MAX: {data.userReserveBalance.toFixed(4)} JitoSOL
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
            step="0.001"
          />
          <span className="text-gray-400 font-medium">JitoSOL</span>
        </div>
        {usdValue > 0 && (
          <p className="text-gray-500 text-sm mt-1">{"\u2248"} ${usdValue.toFixed(2)}</p>
        )}
      </div>

      {/* Impact preview */}
      {numAmount > 0 && data.circulatingSupply > 0 && (() => {
        const newFloorJitosol = (data.reserveBalance + numAmount) / data.circulatingSupply;
        const newFloorUsd = newFloorJitosol * jitosolUsd;
        return (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-6 text-sm text-green-300">
            <p className="font-semibold mb-1">{"\u2728"} Impact Preview</p>
            <p>
              New floor price:{" "}
              <strong>{newFloorJitosol.toFixed(10)} JitoSOL</strong>
              {newFloorUsd > 0 && (
                <span className="text-green-400/70"> ({"\u2248"} ${newFloorUsd.toFixed(6)})</span>
              )}
            </p>
            <p>
              Floor price increase:{" "}
              <strong>
                +{((numAmount / (data.reserveBalance || 1)) * 100).toFixed(4)}%
              </strong>
            </p>
          </div>
        );
      })()}

      {/* Button */}
      <button
        onClick={handleDeposit}
        disabled={status === "pending" || numAmount <= 0 || numAmount > data.userReserveBalance}
        className="w-full py-3 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400"
      >
        {status === "pending" ? "Depositing..." : "Deposit to Reserve"}
      </button>

      {/* Status */}
      {status === "success" && (
        <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
          <p className="text-green-400 text-sm font-medium">Deposit successful! Thank you for contributing.</p>
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
