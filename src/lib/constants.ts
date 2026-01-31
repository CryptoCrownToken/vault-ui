import { PublicKey } from "@solana/web3.js";

export const RESERVE_DECIMALS = 9;
export const VAULT_DECIMALS = 6;

export const SOLANA_RPC =
  "https://devnet.helius-rpc.com/?api-key=c22770b7-7d18-4f70-bc85-f615fe13ade8";
export const SOLANA_NETWORK: "devnet" | "mainnet-beta" = "devnet";

// Hardcoded program addresses — avoids any env-var / SSR issues
const PROGRAM_ID_STR = "9sX23pBwJg5Sqc5ta4RqpaBa1yvofnXE5p8VfAqV6PJ3";
const RESERVE_MINT_STR = "FQ7AZorgJoQDWBNSx5Lv5ijwpYoUXeQA4dLFvhQPngMi";
const VAULT_MINT_STR = "7yMZLGJQuWeRcqW9apA3AyBLMnH6pn7qyEm5wPtkoo3V";

// Lazy singletons — avoids build-time SSR crash
let _programId: PublicKey | undefined;
let _reserveMint: PublicKey | undefined;
let _vaultMint: PublicKey | undefined;

export function PROGRAM_ID(): PublicKey {
  if (!_programId) _programId = new PublicKey(PROGRAM_ID_STR);
  return _programId;
}

export function RESERVE_MINT(): PublicKey {
  if (!_reserveMint) _reserveMint = new PublicKey(RESERVE_MINT_STR);
  return _reserveMint;
}

export function VAULT_MINT(): PublicKey {
  if (!_vaultMint) _vaultMint = new PublicKey(VAULT_MINT_STR);
  return _vaultMint;
}

export function solscanTx(sig: string): string {
  return SOLANA_NETWORK === "devnet"
    ? `https://solscan.io/tx/${sig}?cluster=devnet`
    : `https://solscan.io/tx/${sig}`;
}
