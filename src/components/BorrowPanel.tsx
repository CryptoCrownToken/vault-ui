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

export default function BorrowPanel({
  data,
  jitosolUsd,
  onSuccess,
}: Props) {
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
  const floorPriceUsd = data.floorPriceJitosol * jitosolUsd;
  const collateralValueUsd = numAmount * floorPriceUsd;

  const handleBorrow = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || numAmount <= 0) return;

    try {
      setStatus("pending");
      setError("");

      const provider = new AnchorProvider(connection, wallet as any, {
        commitment: "confirmed",
      });
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
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4">Borrow JitoSOL by Locking VAULT</h2>
      <p className="text-gray-400 text-sm mb-4">
        Lock your VAULT tokens as collateral to borrow JitoSOL at the floor price.
        You can repay anytime within 30 days to get your VAULT back.
      </p>

      {/* Overcollateralization explanation */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 mb-5">
        <p className="text-purple-300 text-xs font-semibold mb-2">
          {"\uD83D\uDEE1\uFE0F"} Always Overcollateralized
        </p>
        <p className="text-gray-400 text-xs leading-relaxed mb-3">
          Since VAULT always trades <strong className="text-white">at or above</strong> the floor price on the market,
          your locked VAULT is always worth <strong className="text-white">more</strong> than the JitoSOL you borrow.
          The loan is valued at the floor price, but your collateral has market value - making every
          loan naturally overcollateralized.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900/60 rounded-lg p-2.5 text-center">
            <p className="text-gray-500 text-[10px] mb-0.5">You borrow at</p>
            <p className="text-sm font-bold text-cyan-400">Floor Price</p>
            <p className="text-gray-500 text-[10px]">
              {floorPriceUsd > 0 ? `$${floorPriceUsd.toFixed(6)}/VAULT` : "..."}
            </p>
          </div>
          <div className="bg-gray-900/60 rounded-lg p-2.5 text-center">
            <p className="text-gray-500 text-[10px] mb-0.5">Collateral worth</p>
            <p className="text-sm font-bold text-green-400">{"\u2265"} Market Price</p>
            <p className="text-gray-500 text-[10px]">Always {"\u2265"} floor</p>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400 text-sm">You lock</span>
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
        {numAmount > 0 && collateralValueUsd > 0 && (
          <p className="text-gray-500 text-xs mt-1">Collateral floor value: ${collateralValueUsd.toFixed(2)}</p>
        )}
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

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4 text-sm text-blue-300">
        <p>{"\uD83D\uDCC5"} Loan duration: <strong>30 days</strong></p>
        <p>{"\uD83D\uDD12"} Your VAULT is safe in escrow and returned on repay</p>
        <p>{"\uD83D\uDCB0"} You repay the same JitoSOL amount to unlock your VAULT</p>
        <p>{"\u2699\uFE0F"} A one-time fee of <strong>~0.00349 SOL</strong> is charged to open the escrow account - it is <strong>refunded automatically</strong> when you repay the loan</p>
      </div>
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-6 text-sm text-red-300">
        <p>{"\u26A0\uFE0F"} <strong>Warning:</strong> If you do not repay within 30 days, <strong>0.10% of your locked VAULT will be burned</strong> and the loan will be extended by 30 additional days. This penalty repeats every 30 days until repayment.</p>
      </div>

      {/* Button */}
      <button
        onClick={handleBorrow}
        disabled={status === "pending" || numAmount <= 0 || numAmount > data.userVaultBalance}
        className="w-full py-3 rounded-xl font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400"
      >
        {status === "pending" ? "Processing..." : "Lock VAULT & Borrow"}
      </button>

      {/* Status */}
      {status === "success" && (
        <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
          <p className="text-green-400 text-sm font-medium">Borrow successful!</p>
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
