/**
 * Shapes describing a `jsonParsed`-encoded `blockSubscribe` notification.
 * These are intentionally narrower than the full Solana RPC response —
 * only the fields the parsers in this package actually read.
 */

/** The `parsed` payload of a `jsonParsed` instruction: its instruction-type discriminant and info fields. */
export interface JsonParsedInstructionParsed {
  readonly type: string;
  readonly info: Record<string, unknown>;
}

/** One `parsed` instruction as returned by `encoding: "jsonParsed"`. */
export interface JsonParsedInstruction {
  readonly programId: string;
  readonly program?: string;
  readonly parsed?: JsonParsedInstructionParsed;
  readonly data?: string;
}

/** One entry of `meta.innerInstructions[]`: the inner instructions for a given top-level instruction index. */
export interface InnerInstructionSet {
  readonly index: number;
  readonly instructions: JsonParsedInstruction[];
}

/** One entry of `message.accountKeys[]` under `encoding: "jsonParsed"`. */
export interface AccountKeyEntry {
  readonly pubkey: string;
  readonly signer: boolean;
  readonly writable: boolean;
}

/**
 * Addresses pulled in via an Address Lookup Table for a v0 transaction. When present, the
 * transaction's *full* account list (the one `preBalances`/`postBalances`/`preTokenBalances`/
 * `postTokenBalances[].accountIndex` index into) is `message.accountKeys` followed by
 * `loadedAddresses.writable` followed by `loadedAddresses.readonly`.
 */
export interface LoadedAddresses {
  readonly writable: string[];
  readonly readonly: string[];
}

/** One entry of `meta.preTokenBalances[]`/`meta.postTokenBalances[]`. */
export interface TokenBalance {
  readonly accountIndex: number;
  readonly mint: string;
  readonly owner?: string;
  readonly uiTokenAmount: {
    readonly amount: string;
    readonly decimals: number;
    readonly uiAmount: number | null;
  };
}

/**
 * The `meta` shape of a `blockSubscribe`/`getTransaction` result, narrowed to the fields this
 * package reads. `preTokenBalances`/`postTokenBalances`/`preBalances`/`postBalances`/
 * `loadedAddresses` are optional here (rather than always-present arrays, which is what a real
 * RPC response has) purely so existing `meta: { innerInstructions }` fixtures from Task 3 keep
 * type-checking without modification — `balanceDiff.ts`'s helpers treat "missing" the same as
 * "empty".
 */
export interface TransactionMeta {
  readonly innerInstructions: InnerInstructionSet[] | null;
  readonly preTokenBalances?: TokenBalance[];
  readonly postTokenBalances?: TokenBalance[];
  readonly preBalances?: number[];
  readonly postBalances?: number[];
  readonly loadedAddresses?: LoadedAddresses;
}

/** The raw per-transaction shape nested under `block.transactions[]` in a `blockSubscribe` result. */
export interface RawBlockTransaction {
  readonly transaction: {
    readonly signatures: string[];
    readonly message: {
      readonly instructions: JsonParsedInstruction[];
      readonly accountKeys?: AccountKeyEntry[];
    };
  };
  readonly meta: TransactionMeta | null;
}

/**
 * A single transaction enriched with the block-level context (`slot`, `blockTime`) and its
 * index within the block, as consumed by `parseTransfers`/`parseNewTokens`. `parseBlock` builds
 * these from the raw `BlockNotification.block.transactions[]` entries.
 */
export interface ParsedTransactionInput extends RawBlockTransaction {
  readonly slot: number;
  readonly blockTime: number;
  readonly txIndex: number;
}

/** The raw shape of a `blockSubscribe` notification result. */
export interface BlockNotification {
  readonly slot: number;
  readonly block: {
    readonly blockTime: number;
    readonly transactions: RawBlockTransaction[];
  };
}
