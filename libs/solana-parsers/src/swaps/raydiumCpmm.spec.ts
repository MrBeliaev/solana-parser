import { BN, BorshInstructionCoder, Idl } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { RAYDIUM_CPMM_PROGRAM_ID, SwapEvent, TOKEN_PROGRAM_ID } from '@app/common';
import {
  AccountKeyEntry,
  ParsedTransactionInput,
  RawInstruction,
  TokenBalance,
  TransactionMeta,
} from '../types';
import rawIdl from './idl/raydium_cpmm.json';
import { decodeRaydiumCpmmSwap, RaydiumCpmmSwapLocation } from './raydiumCpmm';

// Encoding here (rather than hand-building the discriminator+args bytes) round-trips the same
// `BorshInstructionCoder`/vendored IDL the implementation decodes with, so the test would catch a
// mismatched account/arg layout in the IDL rather than just re-asserting hand-picked bytes.
const coder: BorshInstructionCoder = new BorshInstructionCoder(rawIdl as Idl);

const SLOT: number = 123456789;
const BLOCK_TIME: number = 1735689600;
const TX_INDEX: number = 0;
const SIGNATURE: string = '3nJs52ZnQ1cQz7SVccQoJ1oS85tZK8k7XVL3PRi7EhoJhq9BYTeBrsQxbrKsHmyEC7ba9wXbPZ9M9uMcZk1J6Vye';

const PAYER_PUBKEY: string = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const POOL_STATE_PUBKEY: string = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
const INPUT_TOKEN_ACCOUNT_PUBKEY: string = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const OUTPUT_TOKEN_ACCOUNT_PUBKEY: string = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const MINT_IN_PUBKEY: string = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MINT_OUT_PUBKEY: string = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

const LOCATION: RaydiumCpmmSwapLocation = { instructionIndex: 3, innerIndex: null };

/** A 32-byte all-`seed` buffer, base58-encoded — a validly-shaped but otherwise unused pubkey. */
function dummyPubkey (seed: number): string {
  return bs58.encode(Buffer.alloc(32, seed));
}

/**
 * The 13-account Raydium CPMM `swapBaseInput`/`swapBaseOutput` account list, in the order the
 * vendored IDL's `accounts[]` declares them: payer, authority, ammConfig, poolState,
 * inputTokenAccount, outputTokenAccount, inputVault, outputVault, inputTokenProgram,
 * outputTokenProgram, inputTokenMint, outputTokenMint, observationState.
 */
function buildSwapAccounts (): string[] {
  return [
    PAYER_PUBKEY,
    dummyPubkey(2),
    dummyPubkey(3),
    POOL_STATE_PUBKEY,
    INPUT_TOKEN_ACCOUNT_PUBKEY,
    OUTPUT_TOKEN_ACCOUNT_PUBKEY,
    dummyPubkey(6),
    dummyPubkey(7),
    TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    MINT_IN_PUBKEY,
    MINT_OUT_PUBKEY,
    dummyPubkey(8),
  ];
}

function makeTokenBalance (accountIndex: number, mint: string, amount: string, decimals: number): TokenBalance {
  return {
    accountIndex,
    mint,
    owner: PAYER_PUBKEY,
    uiTokenAmount: {
      amount,
      decimals,
      uiAmount: Number(amount) / 10 ** decimals,
    },
  };
}

function makeTx (meta: TransactionMeta): ParsedTransactionInput {
  const accountKeys: AccountKeyEntry[] = [
    { pubkey: PAYER_PUBKEY, signer: true, writable: true },
    { pubkey: INPUT_TOKEN_ACCOUNT_PUBKEY, signer: false, writable: true },
    { pubkey: OUTPUT_TOKEN_ACCOUNT_PUBKEY, signer: false, writable: true },
    { pubkey: POOL_STATE_PUBKEY, signer: false, writable: true },
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

describe('decodeRaydiumCpmmSwap', () => {
  it('decodes a swapBaseInput instruction into a SwapEvent using the realized token-balance fill', () => {
    const data: Buffer = coder.encode('swapBaseInput', { amountIn: new BN(600000), minimumAmountOut: new BN(500000) });
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
      programId: RAYDIUM_CPMM_PROGRAM_ID,
      accounts: buildSwapAccounts(),
      data: bs58.encode(data),
      stackHeight: null,
    };

    const event: SwapEvent | null = decodeRaydiumCpmmSwap(ix, tx, meta, LOCATION);

    expect(event).toEqual<SwapEvent>({
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txSignature: SIGNATURE,
      instructionIndex: 3,
      innerIndex: null,
      dex: 'raydium_cpmm',
      programId: RAYDIUM_CPMM_PROGRAM_ID,
      poolAddress: POOL_STATE_PUBKEY,
      trader: PAYER_PUBKEY,
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

  it('decodes a swapBaseOutput instruction into a SwapEvent using the realized token-balance fill', () => {
    const data: Buffer = coder.encode('swapBaseOutput', { amountOut: new BN(550000), maxAmountIn: new BN(650000) });
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
      programId: RAYDIUM_CPMM_PROGRAM_ID,
      accounts: buildSwapAccounts(),
      data: bs58.encode(data),
      stackHeight: null,
    };

    const event: SwapEvent | null = decodeRaydiumCpmmSwap(ix, tx, meta, LOCATION);

    expect(event).toEqual<SwapEvent>({
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txSignature: SIGNATURE,
      instructionIndex: 3,
      innerIndex: null,
      dex: 'raydium_cpmm',
      programId: RAYDIUM_CPMM_PROGRAM_ID,
      poolAddress: POOL_STATE_PUBKEY,
      trader: PAYER_PUBKEY,
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

  it('returns null for a non-swap discriminator (e.g. an initialize instruction)', () => {
    const meta: TransactionMeta = { innerInstructions: null };
    const tx: ParsedTransactionInput = makeTx(meta);
    const unrelatedDiscriminator: Buffer = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const ix: RawInstruction = {
      programId: RAYDIUM_CPMM_PROGRAM_ID,
      accounts: buildSwapAccounts(),
      data: bs58.encode(unrelatedDiscriminator),
    };

    expect(decodeRaydiumCpmmSwap(ix, tx, meta, LOCATION)).toBeNull();
  });

  it('returns null when the token-balance data needed to resolve the fill is missing', () => {
    const data: Buffer = coder.encode('swapBaseInput', { amountIn: new BN(600000), minimumAmountOut: new BN(500000) });
    const meta: TransactionMeta = { innerInstructions: null };
    const tx: ParsedTransactionInput = makeTx(meta);
    const ix: RawInstruction = {
      programId: RAYDIUM_CPMM_PROGRAM_ID,
      accounts: buildSwapAccounts(),
      data: bs58.encode(data),
    };

    expect(decodeRaydiumCpmmSwap(ix, tx, meta, LOCATION)).toBeNull();
  });
});
