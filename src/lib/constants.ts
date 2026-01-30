import { PublicKey } from "@solana/web3.js";

export const RESERVE_DECIMALS = 9;
export const VAULT_DECIMALS = 6;

export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as "devnet" | "mainnet-beta";

// Lazy singletons — avoids build-time SSR crash
let _programId: PublicKey | undefined;
let _reserveMint: PublicKey | undefined;
let _vaultMint: PublicKey | undefined;

export function PROGRAM_ID(): PublicKey {
  if (!_programId) _programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || "9sX23pBwJg5Sqc5ta4RqpaBa1yvofnXE5p8VfAqV6PJ3");
  return _programId;
}

export function RESERVE_MINT(): PublicKey {
  if (!_reserveMint) _reserveMint = new PublicKey(process.env.NEXT_PUBLIC_RESERVE_MINT || "FQ7AZorgJoQDWBNSx5Lv5ijwpYoUXeQA4dLFvhQPngMi");
  return _reserveMint;
}

export function VAULT_MINT(): PublicKey {
  if (!_vaultMint) _vaultMint = new PublicKey(process.env.NEXT_PUBLIC_VAULT_MINT || "7yMZLGJQuWeRcqW9apA3AyBLMnH6pn7qyEm5wPtkoo3V");
  return _vaultMint;
}

export function solscanTx(sig: string): string {
  return SOLANA_NETWORK === "devnet"
    ? `https://solscan.io/tx/${sig}?cluster=devnet`
    : `https://solscan.io/tx/${sig}`;
}
