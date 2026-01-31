import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
  getMint,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import {
  PROGRAM_ID,
  RESERVE_MINT,
  VAULT_MINT,
  RESERVE_DECIMALS,
  VAULT_DECIMALS,
} from "./constants";
import idlJson from "./idl.json";

// Types
export interface ProtocolState {
  reserveMint: PublicKey;
  vaultMint: PublicKey;
  reserveDecimals: number;
  vaultDecimals: number;
  bump: number;
  admin: PublicKey;
  loanDuration: BN;
  penaltyRate: number;
  totalLockedVault: BN;
  loanCount: BN;
}

export interface LoanData {
  borrower: PublicKey;
  loanId: BN;
  vaultLocked: BN;
  jitosolBorrowed: BN;
  startTime: BN;
  dueTime: BN;
  bump: number;
}

export interface LoanWithKey {
  loan: LoanData;
  loanPDA: PublicKey;
  escrowPk: PublicKey | null;
}

export interface DashboardData {
  reserveBalance: number;
  totalSupply: number;
  circulatingSupply: number;
  totalLocked: number;
  floorPriceJitosol: number;
  userVaultBalance: number;
  userReserveBalance: number;
  loans: LoanWithKey[];
  loanCount: number;
}

// Derive PDAs
export function getStatePDA(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state"), RESERVE_MINT().toBuffer(), VAULT_MINT().toBuffer()],
    PROGRAM_ID()
  );
  return pda;
}

export function getLoanPDA(user: PublicKey, loanId: number): PublicKey {
  const loanIdBuf = Buffer.alloc(8);
  const bn = new BN(loanId);
  loanIdBuf.set(bn.toArrayLike(Buffer, "le", 8));
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("loan"), user.toBuffer(), loanIdBuf],
    PROGRAM_ID()
  );
  return pda;
}

export function getVaultReserveAta(): PublicKey {
  return getAssociatedTokenAddressSync(RESERVE_MINT(), getStatePDA(), true);
}

// Get program instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getProgram(provider: AnchorProvider): Program<any> {
  return new Program(idlJson as Idl, provider);
}

// Fetch all dashboard data
export async function fetchDashboard(
  connection: Connection,
  program: Program,
  userPk: PublicKey | null
): Promise<DashboardData> {
  const statePDA = getStatePDA();
  const vaultReserveAta = getVaultReserveAta();

  const [stateAcc, reserveAcc, mintAcc] = await Promise.all([
    (program.account as any).state.fetch(statePDA) as Promise<ProtocolState>,
    getAccount(connection, vaultReserveAta),
    getMint(connection, VAULT_MINT()),
  ]);

  const reserveBalance = Number(reserveAcc.amount) / 10 ** RESERVE_DECIMALS;
  const totalSupply = Number(mintAcc.supply) / 10 ** VAULT_DECIMALS;
  const totalLocked = Number(stateAcc.totalLockedVault) / 10 ** VAULT_DECIMALS;
  const circulatingSupply = totalSupply - totalLocked;
  const floorPriceJitosol = circulatingSupply > 0 ? reserveBalance / circulatingSupply : 0;
  const loanCount = Number(stateAcc.loanCount);

  let userVaultBalance = 0;
  let userReserveBalance = 0;
  const loans: LoanWithKey[] = [];

  if (userPk) {
    try {
      const userVaultAta = getAssociatedTokenAddressSync(VAULT_MINT(), userPk);
      const acc = await getAccount(connection, userVaultAta);
      userVaultBalance = Number(acc.amount) / 10 ** VAULT_DECIMALS;
    } catch {}

    try {
      const userReserveAta = getAssociatedTokenAddressSync(RESERVE_MINT(), userPk);
      const acc = await getAccount(connection, userReserveAta);
      userReserveBalance = Number(acc.amount) / 10 ** RESERVE_DECIMALS;
    } catch {}

    // Scan all possible loan PDAs for this user
    for (let i = 0; i < loanCount; i++) {
      try {
        const loanPDA = getLoanPDA(userPk, i);
        const loanData = (await (program.account as any).loan.fetch(loanPDA)) as unknown as LoanData;

        if (loanData && loanData.borrower.equals(userPk)) {
          // Auto-discover escrow
          let escrowPk: PublicKey | null = null;
          try {
            const escrowAccounts = await connection.getTokenAccountsByOwner(loanPDA, {
              mint: VAULT_MINT(),
            });
            if (escrowAccounts.value.length > 0) {
              escrowPk = escrowAccounts.value[0].pubkey;
            }
          } catch {}

          loans.push({ loan: loanData, loanPDA, escrowPk });
        }
      } catch {
        // Loan closed (repaid) — skip
      }
    }
  }

  return {
    reserveBalance,
    totalSupply,
    circulatingSupply,
    totalLocked,
    floorPriceJitosol,
    userVaultBalance,
    userReserveBalance,
    loans,
    loanCount,
  };
}

// ============================================================
// INSTRUCTIONS
// ============================================================

export async function burnToRedeem(
  program: Program,
  userPk: PublicKey,
  burnAmount: number
): Promise<string> {
  const rawAmount = new BN(burnAmount * 10 ** VAULT_DECIMALS);
  const statePDA = getStatePDA();
  const userVaultAta = getAssociatedTokenAddressSync(VAULT_MINT(), userPk);
  const userReserveAta = getAssociatedTokenAddressSync(RESERVE_MINT(), userPk);

  const sig = await program.methods
    .burnToRedeem(rawAmount)
    .accounts({
      state: statePDA,
      reserveMint: RESERVE_MINT(),
      vaultReserveAta: getVaultReserveAta(),
      vaultMint: VAULT_MINT(),
      userVaultAta,
      userReserveAta,
      user: userPk,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  return sig;
}

export async function borrow(
  program: Program,
  userPk: PublicKey,
  vaultAmount: number,
  currentLoanCount: number
): Promise<{ sig: string; escrowPk: PublicKey }> {
  const rawAmount = new BN(vaultAmount * 10 ** VAULT_DECIMALS);
  const statePDA = getStatePDA();
  const loanPDA = getLoanPDA(userPk, currentLoanCount);
  const escrow = Keypair.generate();

  const userVaultAta = getAssociatedTokenAddressSync(VAULT_MINT(), userPk);
  const userReserveAta = getAssociatedTokenAddressSync(RESERVE_MINT(), userPk);

  const sig = await program.methods
    .borrow(rawAmount)
    .accounts({
      state: statePDA,
      reserveMint: RESERVE_MINT(),
      vaultMint: VAULT_MINT(),
      vaultReserveAta: getVaultReserveAta(),
      user: userPk,
      userVaultAta,
      userReserveAta,
      loan: loanPDA,
      loanVaultEscrow: escrow.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([escrow])
    .rpc();

  return { sig, escrowPk: escrow.publicKey };
}

export async function repay(
  program: Program,
  userPk: PublicKey,
  loanPDA: PublicKey,
  escrowPk: PublicKey
): Promise<string> {
  const statePDA = getStatePDA();
  const userVaultAta = getAssociatedTokenAddressSync(VAULT_MINT(), userPk);
  const userReserveAta = getAssociatedTokenAddressSync(RESERVE_MINT(), userPk);

  const sig = await program.methods
    .repay()
    .accounts({
      state: statePDA,
      reserveMint: RESERVE_MINT(),
      vaultMint: VAULT_MINT(),
      vaultReserveAta: getVaultReserveAta(),
      user: userPk,
      userVaultAta,
      userReserveAta,
      loan: loanPDA,
      loanVaultEscrow: escrowPk,
      borrower: userPk,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return sig;
}

export async function depositReserve(
  program: Program,
  userPk: PublicKey,
  jitosolAmount: number
): Promise<string> {
  const rawAmount = new BN(Math.floor(jitosolAmount * 10 ** RESERVE_DECIMALS));
  const statePDA = getStatePDA();
  const userReserveAta = getAssociatedTokenAddressSync(RESERVE_MINT(), userPk);

  const sig = await program.methods
    .depositReserve(rawAmount)
    .accounts({
      state: statePDA,
      reserveMint: RESERVE_MINT(),
      vaultReserveAta: getVaultReserveAta(),
      user: userPk,
      userReserveAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return sig;
}

// Calculate expected output
export function calculateBurnOutput(
  burnAmount: number,
  reserveBalance: number,
  circulatingSupply: number
): number {
  if (circulatingSupply <= 0 || reserveBalance <= 0) return 0;
  return (burnAmount * reserveBalance) / circulatingSupply;
}

export function calculateBorrowOutput(
  vaultAmount: number,
  reserveBalance: number,
  circulatingSupply: number
): number {
  if (circulatingSupply <= 0 || reserveBalance <= 0) return 0;
  return (vaultAmount * reserveBalance) / circulatingSupply;
}
