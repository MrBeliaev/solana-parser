import bs58 from 'bs58';
import { RAYDIUM_AMM_V4_PROGRAM_ID, SwapEvent, TOKEN_PROGRAM_ID } from '@app/common';
import {
  AccountKeyEntry,
  ParsedTransactionInput,
  RawInstruction,
  TokenBalance,
  TransactionMeta,
} from '../types';
import { decodeRaydiumAmmV4Swap, RaydiumAmmV4SwapLocation } from './raydiumAmmV4';

const SLOT: number = 123456789;
const BLOCK_TIME: number = 1735689600;
const TX_INDEX: number = 0;
const SIGNATURE: string = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';

const POOL_PUBKEY: string = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
const TRADER_PUBKEY: string = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const SOURCE_TOKEN_ACCOUNT_PUBKEY: string = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const DESTINATION_TOKEN_ACCOUNT_PUBKEY: string = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const MINT_IN_PUBKEY: string = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MINT_OUT_PUBKEY: string = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

const LOCATION: RaydiumAmmV4SwapLocation = { instructionIndex: 2, innerIndex: null };

/** A 32-byte all-`seed` buffer, base58-encoded — a validly-shaped but otherwise unused pubkey. */
function dummyPubkey (seed: number): string {
  return bs58.encode(Buffer.alloc(32, seed));
}

/** Builds the raw instruction data for a Raydium AMM v4 `SwapBaseIn`: discriminator `9` + two u64 LE args. */
function buildSwapBaseInData (amountIn: bigint, minimumAmountOut: bigint): string {
  const buffer: Buffer = Buffer.alloc(17);

  buffer.writeUInt8(9, 0);
  buffer.writeBigUInt64LE(amountIn, 1);
  buffer.writeBigUInt64LE(minimumAmountOut, 9);

  return bs58.encode(buffer);
}

/** Builds the raw instruction data for a non-swap Raydium AMM v4 instruction (e.g. `deposit`, discriminator `3`). */
function buildDepositData (): string {
  return bs58.encode(Buffer.from([3]));
}

/**
 * A realistic 18-account Raydium AMM v4 `Swap` account list: token program, amm id (pool), amm
 * authority, amm open orders, amm target orders, pool coin/pc token accounts, serum program/market/
 * bids/asks/event-queue/coin-vault/pc-vault/vault-signer, then user source, user destination, user owner.
 */
function buildSwapAccounts (): string[] {
  return [
    TOKEN_PROGRAM_ID,
    POOL_PUBKEY,
    dummyPubkey(2),
    dummyPubkey(3),
    dummyPubkey(4),
    dummyPubkey(5),
    dummyPubkey(6),
    dummyPubkey(7),
    dummyPubkey(8),
    dummyPubkey(9),
    dummyPubkey(10),
    dummyPubkey(11),
    dummyPubkey(12),
    dummyPubkey(13),
    dummyPubkey(14),
    SOURCE_TOKEN_ACCOUNT_PUBKEY,
    DESTINATION_TOKEN_ACCOUNT_PUBKEY,
    TRADER_PUBKEY,
  ];
}

function makeTokenBalance (accountIndex: number, mint: string, amount: string, decimals: number): TokenBalance {
  return {
    accountIndex,
    mint,
    owner: TRADER_PUBKEY,
    uiTokenAmount: {
      amount,
      decimals,
      uiAmount: Number(amount) / 10 ** decimals,
    },
  };
}

function makeTx (meta: TransactionMeta): ParsedTransactionInput {
  const accountKeys: AccountKeyEntry[] = [
    { pubkey: TRADER_PUBKEY, signer: true, writable: true },
    { pubkey: SOURCE_TOKEN_ACCOUNT_PUBKEY, signer: false, writable: true },
    { pubkey: DESTINATION_TOKEN_ACCOUNT_PUBKEY, signer: false, writable: true },
    { pubkey: POOL_PUBKEY, signer: false, writable: true },
  ];

  return {
    slot: SLOT,
    blockTime: BLOCK_TIME,
    txIndex: TX_INDEX,
    transaction: {
      signatures: [SIGNATURE],
      message: { instructions: [], accountKeys },
    },
    meta,
  };
}

describe('decodeRaydiumAmmV4Swap', () => {
  it('decodes a SwapBaseIn instruction into a SwapEvent using the realized token-balance fill', () => {
    const meta: TransactionMeta = {
      innerInstructions: null,
      preTokenBalances: [
        makeTokenBalance(1, MINT_IN_PUBKEY, '1000000', 6),
      ],
      postTokenBalances: [
        makeTokenBalance(1, MINT_IN_PUBKEY, '400000', 6),
        makeTokenBalance(2, MINT_OUT_PUBKEY, '550000', 6),
      ],
    };
    const tx: ParsedTransactionInput = makeTx(meta);
    const ix: RawInstruction = {
      programId: RAYDIUM_AMM_V4_PROGRAM_ID,
      accounts: buildSwapAccounts(),
      data: buildSwapBaseInData(600000n, 500000n),
      stackHeight: null,
    };

    const event: SwapEvent | null = decodeRaydiumAmmV4Swap(ix, tx, meta, LOCATION);

    expect(event).toEqual<SwapEvent>({
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txSignature: SIGNATURE,
      instructionIndex: 2,
      innerIndex: null,
      dex: 'raydium_amm_v4',
      programId: RAYDIUM_AMM_V4_PROGRAM_ID,
      poolAddress: POOL_PUBKEY,
      trader: TRADER_PUBKEY,
      mintIn: MINT_IN_PUBKEY,
      mintOut: MINT_OUT_PUBKEY,
      amountInRaw: '600000',
      amountOutRaw: '550000',
      amountInUi: 0.6,
      amountOutUi: 0.55,
      decimalsIn: 6,
      decimalsOut: 6,
    });
  });

  it('returns null for a non-swap discriminator byte (e.g. deposit)', () => {
    const meta: TransactionMeta = { innerInstructions: null };
    const tx: ParsedTransactionInput = makeTx(meta);
    const ix: RawInstruction = {
      programId: RAYDIUM_AMM_V4_PROGRAM_ID,
      accounts: buildSwapAccounts(),
      data: buildDepositData(),
    };

    expect(decodeRaydiumAmmV4Swap(ix, tx, meta, LOCATION)).toBeNull();
  });

  it('returns null when the token-balance data needed to resolve the fill is missing', () => {
    const meta: TransactionMeta = { innerInstructions: null };
    const tx: ParsedTransactionInput = makeTx(meta);
    const ix: RawInstruction = {
      programId: RAYDIUM_AMM_V4_PROGRAM_ID,
      accounts: buildSwapAccounts(),
      data: buildSwapBaseInData(600000n, 500000n),
    };

    expect(decodeRaydiumAmmV4Swap(ix, tx, meta, LOCATION)).toBeNull();
  });
});
