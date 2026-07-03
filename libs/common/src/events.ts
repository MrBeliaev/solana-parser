/**
 * Kafka payload / ClickHouse row shapes shared across services.
 * Field names are camelCase here; the ClickHouse writer maps them to the
 * snake_case columns defined in `sql/schema/*.sql`.
 *
 * UInt64-range ClickHouse columns (`amount_raw`, `amount_in_raw`, `amount_out_raw`)
 * are typed as `string` because a JS `number` loses precision above 2^53.
 */

export interface TransferEvent {
  slot: number;
  blockTime: number;
  txSignature: string;
  txIndex: number;
  instructionIndex: number;
  innerIndex: number | null;
  programId: string;
  transferType: 'sol' | 'spl' | 'spl_checked';
  mint: string;
  decimals: number | null;
  source: string;
  destination: string;
  authority: string;
  amountRaw: string;
  amountUi: number;
}

export interface NewTokenEvent {
  slot: number;
  blockTime: number;
  txSignature: string;
  instructionIndex: number;
  programId: string;
  mint: string;
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  initMethod: 'initializeMint' | 'initializeMint2' | 'backfilled';
}

export interface SwapEvent {
  slot: number;
  blockTime: number;
  txSignature: string;
  instructionIndex: number;
  innerIndex: number | null;
  dex: 'raydium_amm_v4' | 'raydium_cpmm' | 'orca_whirlpool' | 'pumpfun';
  programId: string;
  poolAddress: string;
  trader: string;
  mintIn: string;
  mintOut: string;
  amountInRaw: string;
  amountOutRaw: string;
  amountInUi: number;
  amountOutUi: number;
  decimalsIn: number | null;
  decimalsOut: number | null;
}

export interface PoolEvent {
  poolAddress: string;
  dex: 'raydium_amm_v4' | 'raydium_cpmm' | 'orca_whirlpool' | 'pumpfun';
  programId: string;
  baseMint: string;
  quoteMint: string;
  createdSlot: number;
  createdBlockTime: number;
  createdTxSignature: string;
}

export interface MintReferenceEvent {
  mint: string;
  slot: number;
  blockTime: number;
  txSignature: string;
}
