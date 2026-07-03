/**
 * Kafka topic names shared by every service in the pipeline.
 * Names are lowercase, dot-separated, and must stay in sync across producers/consumers.
 */
/* eslint-disable-next-line @typescript-eslint/typedef -- an explicit annotation would widen the
   values from string literals to `string`, breaking the `KafkaTopic` literal union below */
export const KAFKA_TOPICS = {
  BLOCKS_RAW: 'solana.blocks.raw',
  TRANSFERS: 'solana.events.transfers',
  NEW_TOKENS: 'solana.events.new-tokens',
  SWAPS: 'solana.events.swaps',
  POOLS: 'solana.events.pools',
  MINT_REFS: 'solana.events.mint-refs',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];
