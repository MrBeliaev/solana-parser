import {
  AccountKeyEntry,
  LoadedAddresses,
  ParsedTransactionInput,
  TokenBalance,
  TransactionMeta,
} from './types';

/**
 * Finds the `TokenBalance` entry for a given account index + mint in a `preTokenBalances`/
 * `postTokenBalances` array. Both arrays only contain entries for accounts that actually held
 * an SPL token balance at that point in the transaction, so a missing entry is a legitimate
 * "zero balance" rather than a data error.
 */
function findTokenBalance (
  balances: TokenBalance[] | undefined,
  accountIndex: number,
  mint: string,
): TokenBalance | undefined {
  return (balances ?? []).find((balance) => balance.accountIndex === accountIndex && balance.mint === mint);
}

/**
 * Computes the real (raw + UI) amount an SPL token balance changed by across a transaction, by
 * diffing `meta.postTokenBalances` against `meta.preTokenBalances` for a given account + mint.
 * This is how swap decoders (Tasks 5-9) recover a DEX pool's actual in/out amounts, since the
 * amounts written into an AMM instruction's own accounts don't always reflect fees/slippage.
 *
 * Returns `null` when neither `preTokenBalances` nor `postTokenBalances` has an entry for this
 * account + mint (i.e. the account never held this mint during the transaction).
 */
export function diffTokenBalance (
  meta: TransactionMeta,
  accountIndex: number,
  mint: string,
): { raw: bigint; ui: number } | null {
  const pre: TokenBalance | undefined = findTokenBalance(meta.preTokenBalances, accountIndex, mint);
  const post: TokenBalance | undefined = findTokenBalance(meta.postTokenBalances, accountIndex, mint);

  if (pre === undefined && post === undefined) {
    return null;
  }

  const preRaw: bigint = pre !== undefined ? BigInt(pre.uiTokenAmount.amount) : 0n;
  const postRaw: bigint = post !== undefined ? BigInt(post.uiTokenAmount.amount) : 0n;
  const raw: bigint = postRaw - preRaw;

  // decimals should agree between pre/post for the same mint; prefer whichever side is present
  // when only one of them is (account received/drained the mint entirely within this tx).
  const decimals: number = post?.uiTokenAmount.decimals ?? pre?.uiTokenAmount.decimals ?? 0;

  return {
    raw,
    ui: Number(raw) / 10 ** decimals,
  };
}

/**
 * Computes the lamport (native SOL) balance change for an account across a transaction, from
 * `meta.postBalances[accountIndex] - meta.preBalances[accountIndex]`.
 */
export function diffLamports (meta: TransactionMeta, accountIndex: number): bigint {
  const pre: number = meta.preBalances?.[accountIndex] ?? 0;
  const post: number = meta.postBalances?.[accountIndex] ?? 0;

  return BigInt(post) - BigInt(pre);
}

/**
 * Resolves an account pubkey to its index in the transaction's *full* account list: static
 * `message.accountKeys` first, then (for v0/ALT transactions) `meta.loadedAddresses.writable`,
 * then `meta.loadedAddresses.readonly` — the same ordering `preBalances`/`postBalances`/
 * `preTokenBalances`/`postTokenBalances[].accountIndex` index into. Returns `-1` if the pubkey
 * isn't found in either list.
 */
export function findAccountIndex (tx: ParsedTransactionInput, pubkey: string): number {
  const accountKeys: AccountKeyEntry[] = tx.transaction.message.accountKeys ?? [];
  const staticIndex: number = accountKeys.findIndex((entry) => entry.pubkey === pubkey);

  if (staticIndex !== -1) {
    return staticIndex;
  }

  const loadedAddresses: LoadedAddresses | undefined = tx.meta?.loadedAddresses;

  if (loadedAddresses === undefined) {
    return -1;
  }

  const writableIndex: number = loadedAddresses.writable.indexOf(pubkey);

  if (writableIndex !== -1) {
    return accountKeys.length + writableIndex;
  }

  const readonlyIndex: number = loadedAddresses.readonly.indexOf(pubkey);

  if (readonlyIndex !== -1) {
    return accountKeys.length + loadedAddresses.writable.length + readonlyIndex;
  }

  return -1;
}
