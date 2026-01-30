import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "9sX23pBwJg5Sqc5ta4RqpaBa1yvofnXE5p8VfAqV6PJ3"
);

export const RESERVE_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_RESERVE_MINT || "FQ7AZorgJoQDWBNSx5Lv5ijwpYoUXeQA4dLFvhQPngMi"
);

export const VAULT_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_VAULT_MINT || "7yMZLGJQuWeRcqW9apA3AyBLMnH6pn7qyEm5wPtkoo3V"
);

export const RESERVE_DECIMALS = 9;
export const VAULT_DECIMALS = 6;

export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "devnet") as "devnet" | "mainnet-beta";

export const EXPLORER_URL = SOLANA_NETWORK === "devnet"
  ? "https://solscan.io/tx/{sig}?cluster=devnet"
  : "https://solscan.io/tx/{sig}";

export function solscanTx(sig: string): string {
  return EXPLORER_URL.replace("{sig}", sig);
}
