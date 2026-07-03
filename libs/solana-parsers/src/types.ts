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

/** The raw per-transaction shape nested under `block.transactions[]` in a `blockSubscribe` result. */
export interface RawBlockTransaction {
  readonly transaction: {
    readonly signatures: string[];
    readonly message: {
      readonly instructions: JsonParsedInstruction[];
    };
  };
  readonly meta: {
    readonly innerInstructions: InnerInstructionSet[] | null;
  } | null;
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
