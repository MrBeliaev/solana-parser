import { BorshInstructionCoder, Idl } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { SwapEvent } from '@app/common';
import { diffTokenBalance, findAccountIndex } from '../balanceDiff';
import {
  ParsedTransactionInput,
  RawInstruction,
  TokenBalance,
  TransactionMeta,
} from '../types';
import rawIdl from './idl/raydium_cpmm.json';

/**
 * Raydium CPMM is Anchor-compatible: each instruction's discriminator is the first 8 bytes of
 * `sha256("global:<snake_case_name>")` (an Anchor "sighash"), rather than the single leading byte
 * used by the native Raydium AMM v4 program. The vendored IDL below embeds these discriminators
 * explicitly (as required by `@coral-xyz/anchor@0.32`'s IDL spec) — `swapBaseInput` = `sha256(
 * "global:swap_base_input")[0:8]` = `[143, 190, 90, 218, 196, 30, 51, 222]`, `swapBaseOutput` =
 * `sha256("global:swap_base_output")[0:8]` = `[55, 217, 98, 86, 163, 74, 180, 173]`. Account names/
 * ordering and the `metadata`/`address` fields are hand-constructed to match the real published
 * `raydium-io/raydium-cp-swap` IDL as closely as possible from what's known of it; cross-check
 * against that repo's vendored IDL before relying on this for production traffic.
 */
const idl: Idl = rawIdl as Idl;
const coder: BorshInstructionCoder = new BorshInstructionCoder(idl);

const SWAP_BASE_INPUT_NAME: string = 'swapBaseInput';
const SWAP_BASE_OUTPUT_NAME: string = 'swapBaseOutput';

/**
 * Account indices within a Raydium CPMM `swapBaseInput`/`swapBaseOutput` instruction's account
 * list, per the vendored IDL's `accounts[]` ordering (see `idl/raydium_cpmm.json`).
 */
const PAYER_INDEX: number = 0;
const POOL_STATE_INDEX: number = 3;
const INPUT_TOKEN_ACCOUNT_INDEX: number = 4;
const OUTPUT_TOKEN_ACCOUNT_INDEX: number = 5;
const INPUT_TOKEN_MINT_INDEX: number = 10;
const OUTPUT_TOKEN_MINT_INDEX: number = 11;

/**
 * The instruction-location fields `SwapEvent` needs (`instructionIndex`/`innerIndex`) aren't
 * derivable from `ix`/`tx`/`meta` alone — see `RaydiumAmmV4SwapLocation` in `raydiumAmmV4.ts` for
 * the full rationale. The dispatcher (Task 9) threads this through at the call site.
 */
export interface RaydiumCpmmSwapLocation {
  readonly instructionIndex: number;
  readonly innerIndex: number | null;
}

function absBigInt (value: bigint): bigint {
  return value < 0n ? -value : value;
}

/**
 * Finds the `TokenBalance` entry for a given account index + mint in either `postTokenBalances`
 * (preferred) or `preTokenBalances` (fallback, for an account fully drained of the mint by this
 * instruction) — used here only to recover `decimals` for the event, since `diffTokenBalance`
 * already validates the account/mint pairing exists in at least one of the two arrays.
 */
function findDecimals (meta: TransactionMeta, accountIndex: number, mint: string): number | null {
  const matches = (balance: TokenBalance): boolean => balance.accountIndex === accountIndex && balance.mint === mint;
  const post: TokenBalance | undefined = (meta.postTokenBalances ?? []).find(matches);

  if (post !== undefined) {
    return post.uiTokenAmount.decimals;
  }

  const pre: TokenBalance | undefined = (meta.preTokenBalances ?? []).find(matches);

  return pre !== undefined ? pre.uiTokenAmount.decimals : null;
}

/**
 * Decodes a Raydium CPMM `swapBaseInput`/`swapBaseOutput` instruction into a `SwapEvent`. Returns
 * `null` when `ix.data`'s 8-byte discriminator doesn't match either swap variant (e.g. `deposit`/
 * `withdraw`/`initialize`), or when the account list / token-balance data needed to resolve the
 * real fill is missing/malformed.
 */
export function decodeRaydiumCpmmSwap (
  ix: RawInstruction,
  tx: ParsedTransactionInput,
  meta: TransactionMeta,
  location: RaydiumCpmmSwapLocation,
): SwapEvent | null {
  const data: Buffer = Buffer.from(bs58.decode(ix.data));
  const decoded: { name: string; data: object } | null = coder.decode(data);

  if (decoded === null || (decoded.name !== SWAP_BASE_INPUT_NAME && decoded.name !== SWAP_BASE_OUTPUT_NAME)) {
    return null;
  }

  const payer: string | undefined = ix.accounts[PAYER_INDEX];
  const poolAddress: string | undefined = ix.accounts[POOL_STATE_INDEX];
  const inputTokenAccount: string | undefined = ix.accounts[INPUT_TOKEN_ACCOUNT_INDEX];
  const outputTokenAccount: string | undefined = ix.accounts[OUTPUT_TOKEN_ACCOUNT_INDEX];
  const mintIn: string | undefined = ix.accounts[INPUT_TOKEN_MINT_INDEX];
  const mintOut: string | undefined = ix.accounts[OUTPUT_TOKEN_MINT_INDEX];

  if (
    payer === undefined ||
    poolAddress === undefined ||
    inputTokenAccount === undefined ||
    outputTokenAccount === undefined ||
    mintIn === undefined ||
    mintOut === undefined
  ) {
    return null;
  }

  const inputAccountIndex: number = findAccountIndex(tx, inputTokenAccount);
  const outputAccountIndex: number = findAccountIndex(tx, outputTokenAccount);

  if (inputAccountIndex === -1 || outputAccountIndex === -1) {
    return null;
  }

  const diffIn: { raw: bigint; ui: number } | null = diffTokenBalance(meta, inputAccountIndex, mintIn);
  const diffOut: { raw: bigint; ui: number } | null = diffTokenBalance(meta, outputAccountIndex, mintOut);

  if (diffIn === null || diffOut === null) {
    return null;
  }

  const decimalsIn: number | null = findDecimals(meta, inputAccountIndex, mintIn);
  const decimalsOut: number | null = findDecimals(meta, outputAccountIndex, mintOut);

  return {
    slot: tx.slot,
    blockTime: tx.blockTime,
    txSignature: tx.transaction.signatures[0] ?? '',
    instructionIndex: location.instructionIndex,
    innerIndex: location.innerIndex,
    dex: 'raydium_cpmm',
    programId: ix.programId,
    poolAddress,
    trader: payer,
    mintIn,
    mintOut,
    amountInRaw: absBigInt(diffIn.raw).toString(),
    amountOutRaw: absBigInt(diffOut.raw).toString(),
    amountInUi: Math.abs(diffIn.ui),
    amountOutUi: Math.abs(diffOut.ui),
    decimalsIn,
    decimalsOut,
  };
}
