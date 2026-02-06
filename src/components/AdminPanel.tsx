"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createMetadataAccountV3,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { publicKey } from "@metaplex-foundation/umi";
import { solscanTx } from "@/lib/constants";

const VAULT_MINT = "7yMZLGJQuWeRcqW9apA3AyBLMnH6pn7qyEm5wPtkoo3V";
const METADATA_URI = "https://vault-ui-pi.vercel.app/vault-metadata.json";

export default function AdminPanel() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txSig, setTxSig] = useState("");
  const [error, setError] = useState("");

  const handleCreateMetadata = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError("Please connect your wallet first");
      setStatus("error");
      return;
    }

    try {
      setStatus("pending");
      setError("");

      // Create UMI instance with wallet adapter
      const umi = createUmi(connection.rpcEndpoint)
        .use(mplTokenMetadata())
        .use(walletAdapterIdentity(wallet));

      const mintPubkey = publicKey(VAULT_MINT);

      // Create metadata account
      const tx = await createMetadataAccountV3(umi, {
        mint: mintPubkey,
        mintAuthority: umi.identity,
        payer: umi.identity,
        updateAuthority: umi.identity.publicKey,
        data: {
          name: "Vault",
          symbol: "VAULT",
          uri: METADATA_URI,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      }).sendAndConfirm(umi);

      const sig = Buffer.from(tx.signature).toString("base64");
      setTxSig(sig);
      setStatus("success");
    } catch (err: any) {
      console.error("Create metadata error:", err);
      if (err.message?.includes("already in use")) {
        setError("Token metadata already exists!");
      } else {
        setError(err.message || "Failed to create metadata");
      }
      setStatus("error");
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Admin Tools</h2>
      <p className="text-neutral-500 text-sm mb-6">
        Administrative functions for the protocol.
      </p>

      {/* Token Metadata Section */}
      <div className="border border-white/10 rounded-xl p-4 mb-4">
        <h3 className="font-medium mb-2">Token Metadata</h3>
        <p className="text-neutral-500 text-xs mb-4">
          Create Metaplex token metadata for VAULT to display name, symbol, and logo in wallets like Phantom.
        </p>

        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-neutral-400">Name</span>
            <span className="text-white">Vault</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Symbol</span>
            <span className="text-white">VAULT</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Metadata URI</span>
            <a
              href={METADATA_URI}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline text-xs truncate max-w-[200px]"
            >
              {METADATA_URI}
            </a>
          </div>
        </div>

        <button
          onClick={handleCreateMetadata}
          disabled={status === "pending" || !wallet.publicKey}
          className="w-full py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white text-black hover:bg-neutral-200"
        >
          {status === "pending" ? "Creating Metadata..." : "Create Token Metadata"}
        </button>

        {!wallet.publicKey && (
          <p className="text-yellow-500 text-xs mt-2 text-center">
            Connect your wallet to create metadata
          </p>
        )}
      </div>

      {/* Status */}
      {status === "success" && (
        <div className="border border-green-500/20 rounded-xl p-3">
          <p className="text-green-400 text-sm font-medium">Token metadata created successfully!</p>
          <p className="text-neutral-500 text-xs mt-1">
            Refresh your Phantom wallet to see the updated token info.
          </p>
          {txSig && (
            <a
              href={solscanTx(txSig)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 text-xs underline hover:text-white"
            >
              View on Solscan
            </a>
          )}
        </div>
      )}
      {status === "error" && (
        <div className="border border-red-500/20 rounded-xl p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
