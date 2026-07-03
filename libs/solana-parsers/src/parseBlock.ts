import {
  MintReferenceEvent,
  NewTokenEvent,
  PoolEvent,
  SwapEvent,
  TransferEvent,
} from '@app/common';
import { parseNewTokens } from './newTokens';
import { parseTransfers } from './transfers';
import { BlockNotification, ParsedTransactionInput, RawBlockTransaction } from './types';

export interface ParseBlockResult {
  readonly transfers: TransferEvent[];
  readonly newTokens: NewTokenEvent[];
  readonly swaps: SwapEvent[];
  readonly pools: PoolEvent[];
  readonly mintRefs: MintReferenceEvent[];
}

function toParsedTransactionInput (
  rawTx: RawBlockTransaction,
  slot: number,
  blockTime: number,
  txIndex: number,
): ParsedTransactionInput {
  return {
    ...rawTx,
    slot,
    blockTime,
    txIndex,
  };
}

/**
 * Parses one `blockSubscribe` notification into the event streams the rest of the pipeline
 * publishes to Kafka. For now only `transfers`/`newTokens` are wired up (this is Task 3's scope);
 * `swaps`/`pools`/`mintRefs` are populated by later tasks.
 */
export function parseBlock (block: BlockNotification): ParseBlockResult {
  const transfers: TransferEvent[] = [];
  const newTokens: NewTokenEvent[] = [];

  block.block.transactions.forEach((rawTx, txIndex) => {
    const tx: ParsedTransactionInput = toParsedTransactionInput(rawTx, block.slot, block.block.blockTime, txIndex);

    transfers.push(...parseTransfers(tx));
    newTokens.push(...parseNewTokens(tx));
  });

  return {
    transfers,
    newTokens,
    // TODO(Task 8): wire in swap decoders
    swaps: [],
    pools: [],
    mintRefs: [],
  };
}
