import bs58 from 'bs58';
import { SwapEvent } from '@app/common';
import { diffTokenBalance, findAccountIndex } from '../balanceDiff';
import {
  ParsedTransactionInput,
  RawInstruction,
  TokenBalance,
  TransactionMeta,
} from '../types';

/**
 * Raydium AMM v4 is a native (non-Anchor) program: its instruction discriminator is a single
 * leading byte rather than an 8-byte Anchor sighash. `SwapBaseIn` = `9`, `SwapBaseOut` = `11`
 * (other bytes are `deposit`/`withdraw`/`initialize`/etc. instructions this decoder ignores).
 * Both swap variants are followed by two little-endian `u64`s: for `SwapBaseIn` these are
 * `(amountIn, minimumAmountOut)`; for `SwapBaseOut` they are `(maxAmountIn, amountOut)`. These
 * instruction args are the trader's *requested* amount + slippage bound, not the realized fill
 * (fees/slippage mean the actual transferred amounts can differ), so this decoder does not read
 * them — the real amounts are recovered from `meta.pre/postTokenBalances` via `diffTokenBalance`.
 */
const SWAP_BASE_IN_DISCRIMINATOR: number = 9;
const SWAP_BASE_OUT_DISCRIMINATOR: number = 11;

/**
 * Account indices within a Raydium AMM v4 `Swap` instruction's account list, per the well-known
 * on-chain layout: token program, amm id, amm authority, amm open orders, amm target orders, pool
 * coin token account, pool pc token account, serum program, serum market, serum bids, serum asks,
 * serum event queue, serum coin vault, serum pc vault, serum vault signer, user source token
 * account, user destination token account, user owner. Only the four indices this decoder actually
 * needs are named below; the serum/pool-internal accounts in between are unused here.
 */
const POOL_ACCOUNT_INDEX: number = 1;
const USER_SOURCE_TOKEN_ACCOUNT_INDEX: number = 15;
const USER_DESTINATION_TOKEN_ACCOUNT_INDEX: number = 16;
const USER_OWNER_INDEX: number = 17;

/**
 * The instruction-location fields `SwapEvent` needs (`instructionIndex`/`innerIndex`) aren't
 * derivable from `ix`/`tx`/`meta` alone — `RawInstruction` carries no positional information, and
 * a transaction can contain the same-shaped raw instruction at multiple locations. The dispatcher
 * (Task 9) walks the transaction's instructions (see `instructionWalk.ts`) and already has this
 * location at the call site, so it's threaded through as an explicit parameter here rather than
 * re-derived.
 */
export interface RaydiumAmmV4SwapLocation {
  readonly instructionIndex: number;
  readonly innerIndex: number | null;
}

/**
 * Finds the `TokenBalance` entry for a given account index in either `postTokenBalances` (preferred,
 * since it reflects the mint the account holds after the swap) or `preTokenBalances` (fallback, for
 * an account that was fully drained of the mint by this instruction).
 */
function findTokenBalanceForAccount (meta: TransactionMeta, accountIndex: number): TokenBalance | undefined {
  const post: TokenBalance | undefined = (meta.postTokenBalances ?? [])
    .find((balance) => balance.accountIndex === accountIndex);

  if (post !== undefined) {
    return post;
  }

  return (meta.preTokenBalances ?? []).find((balance) => balance.accountIndex === accountIndex);
}

function absBigInt (value: bigint): bigint {
  return value < 0n ? -value : value;
}

/**
 * Decodes a Raydium AMM v4 `swap` instruction (`SwapBaseIn`/`SwapBaseOut`) into a `SwapEvent`.
 * Returns `null` when `ix.data`'s discriminator byte isn't a swap (e.g. `deposit`/`withdraw`), or
 * when the account list / token-balance data needed to resolve the real fill is missing/malformed.
 */
export function decodeRaydiumAmmV4Swap (
  ix: RawInstruction,
  tx: ParsedTransactionInput,
  meta: TransactionMeta,
  location: RaydiumAmmV4SwapLocation,
): SwapEvent | null {
  const data: Buffer = Buffer.from(bs58.decode(ix.data));
  const discriminator: number | undefined = data[0];

  if (discriminator !== SWAP_BASE_IN_DISCRIMINATOR && discriminator !== SWAP_BASE_OUT_DISCRIMINATOR) {
    return null;
  }

  const poolAddress: string | undefined = ix.accounts[POOL_ACCOUNT_INDEX];
  const userSourceTokenAccount: string | undefined = ix.accounts[USER_SOURCE_TOKEN_ACCOUNT_INDEX];
  const userDestinationTokenAccount: string | undefined = ix.accounts[USER_DESTINATION_TOKEN_ACCOUNT_INDEX];
  const trader: string | undefined = ix.accounts[USER_OWNER_INDEX];

  if (
    poolAddress === undefined ||
    userSourceTokenAccount === undefined ||
    userDestinationTokenAccount === undefined ||
    trader === undefined
  ) {
    return null;
  }

  const sourceAccountIndex: number = findAccountIndex(tx, userSourceTokenAccount);
  const destinationAccountIndex: number = findAccountIndex(tx, userDestinationTokenAccount);

  if (sourceAccountIndex === -1 || destinationAccountIndex === -1) {
    return null;
  }

  const sourceBalance: TokenBalance | undefined = findTokenBalanceForAccount(meta, sourceAccountIndex);
  const destinationBalance: TokenBalance | undefined = findTokenBalanceForAccount(meta, destinationAccountIndex);

  if (sourceBalance === undefined || destinationBalance === undefined) {
    return null;
  }

  const mintIn: string = sourceBalance.mint;
  const mintOut: string = destinationBalance.mint;

  const diffIn: { raw: bigint; ui: number } | null = diffTokenBalance(meta, sourceAccountIndex, mintIn);
  const diffOut: { raw: bigint; ui: number } | null = diffTokenBalance(meta, destinationAccountIndex, mintOut);

  if (diffIn === null || diffOut === null) {
    return null;
  }

  return {
    slot: tx.slot,
    blockTime: tx.blockTime,
    txSignature: tx.transaction.signatures[0] ?? '',
    instructionIndex: location.instructionIndex,
    innerIndex: location.innerIndex,
    dex: 'raydium_amm_v4',
    programId: ix.programId,
    poolAddress,
    trader,
    mintIn,
    mintOut,
    amountInRaw: absBigInt(diffIn.raw).toString(),
    amountOutRaw: absBigInt(diffOut.raw).toString(),
    amountInUi: Math.abs(diffIn.ui),
    amountOutUi: Math.abs(diffOut.ui),
    decimalsIn: sourceBalance.uiTokenAmount.decimals,
    decimalsOut: destinationBalance.uiTokenAmount.decimals,
  };
}
