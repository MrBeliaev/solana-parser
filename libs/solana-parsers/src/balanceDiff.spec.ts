import { diffLamports, diffTokenBalance, findAccountIndex } from './balanceDiff';
import {
  AccountKeyEntry,
  ParsedTransactionInput,
  TokenBalance,
  TransactionMeta,
} from './types';

const SLOT: number = 123456789;
const BLOCK_TIME: number = 1735689600;
const TX_INDEX: number = 0;
const SIGNATURE: string = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';
const POOL_TOKEN_ACCOUNT_PUBKEY: string = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
const TRADER_PUBKEY: string = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const MINT_PUBKEY: string = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const OTHER_MINT_PUBKEY: string = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const LOOKUP_WRITABLE_PUBKEY: string = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const LOOKUP_READONLY_PUBKEY: string = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const UNKNOWN_PUBKEY: string = '11111111111111111111111111111111';

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

function makeTx (accountKeys: AccountKeyEntry[], meta: TransactionMeta | null): ParsedTransactionInput {
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

describe('diffTokenBalance', () => {
  it('returns a positive diff when the token balance increased', () => {
    const meta: TransactionMeta = {
      innerInstructions: null,
      preTokenBalances: [makeTokenBalance(1, MINT_PUBKEY, '1000000', 6)],
      postTokenBalances: [makeTokenBalance(1, MINT_PUBKEY, '1500000', 6)],
    };

    expect(diffTokenBalance(meta, 1, MINT_PUBKEY)).toEqual({ raw: 500000n, ui: 0.5 });
  });

  it('returns a negative diff when the token balance decreased', () => {
    const meta: TransactionMeta = {
      innerInstructions: null,
      preTokenBalances: [makeTokenBalance(1, MINT_PUBKEY, '1000000', 6)],
      postTokenBalances: [makeTokenBalance(1, MINT_PUBKEY, '400000', 6)],
    };

    expect(diffTokenBalance(meta, 1, MINT_PUBKEY)).toEqual({ raw: -600000n, ui: -0.6 });
  });

  it('treats a missing pre entry as zero (account received the mint for the first time)', () => {
    const meta: TransactionMeta = {
      innerInstructions: null,
      preTokenBalances: [],
      postTokenBalances: [makeTokenBalance(2, MINT_PUBKEY, '250000', 6)],
    };

    expect(diffTokenBalance(meta, 2, MINT_PUBKEY)).toEqual({ raw: 250000n, ui: 0.25 });
  });

  it('treats a missing post entry as zero (account was fully drained of the mint)', () => {
    const meta: TransactionMeta = {
      innerInstructions: null,
      preTokenBalances: [makeTokenBalance(3, MINT_PUBKEY, '750000', 6)],
      postTokenBalances: [],
    };

    expect(diffTokenBalance(meta, 3, MINT_PUBKEY)).toEqual({ raw: -750000n, ui: -0.75 });
  });

  it('returns null when neither pre nor post has an entry for this account + mint', () => {
    const meta: TransactionMeta = {
      innerInstructions: null,
      preTokenBalances: [makeTokenBalance(1, OTHER_MINT_PUBKEY, '1000000', 6)],
      postTokenBalances: [makeTokenBalance(1, OTHER_MINT_PUBKEY, '1500000', 6)],
    };

    expect(diffTokenBalance(meta, 1, MINT_PUBKEY)).toBeNull();
  });

  it('returns null when preTokenBalances/postTokenBalances are absent entirely', () => {
    const meta: TransactionMeta = { innerInstructions: null };

    expect(diffTokenBalance(meta, 1, MINT_PUBKEY)).toBeNull();
  });
});

describe('diffLamports', () => {
  it('returns a positive diff when lamports increased', () => {
    const meta: TransactionMeta = {
      innerInstructions: null,
      preBalances: [5000, 1000000000],
      postBalances: [5000, 1500000000],
    };

    expect(diffLamports(meta, 1)).toBe(500000000n);
  });

  it('returns a negative diff when lamports decreased', () => {
    const meta: TransactionMeta = {
      innerInstructions: null,
      preBalances: [5000, 1000000000],
      postBalances: [5000, 400000000],
    };

    expect(diffLamports(meta, 1)).toBe(-600000000n);
  });

  it('documents that an out-of-range index is treated the same as a missing preBalances/postBalances ' +
    'field (missing side resolves to 0)', () => {
    const meta: TransactionMeta = {
      innerInstructions: null,
      preBalances: [5000, 1000000000],
      postBalances: [5000, 1000000000, 2000000000],
    };

    // Index 2 is out of range for preBalances (length 2) but in range for postBalances: the
    // "missing" pre side is treated as 0, exactly like an entirely absent preBalances array would
    // be. This is a deliberate compromise (see diffLamports's `?? 0`), locked in by this test.
    expect(diffLamports(meta, 2)).toBe(2000000000n);
  });
});

describe('findAccountIndex', () => {
  const accountKeys: AccountKeyEntry[] = [
    { pubkey: TRADER_PUBKEY, signer: true, writable: true },
    { pubkey: POOL_TOKEN_ACCOUNT_PUBKEY, signer: false, writable: true },
  ];

  it('resolves a pubkey present in message.accountKeys', () => {
    const tx: ParsedTransactionInput = makeTx(accountKeys, { innerInstructions: null });

    expect(findAccountIndex(tx, POOL_TOKEN_ACCOUNT_PUBKEY)).toBe(1);
  });

  it('resolves a pubkey present in meta.loadedAddresses.writable, offset past accountKeys', () => {
    const tx: ParsedTransactionInput = makeTx(accountKeys, {
      innerInstructions: null,
      loadedAddresses: { writable: [LOOKUP_WRITABLE_PUBKEY], readonly: [] },
    });

    expect(findAccountIndex(tx, LOOKUP_WRITABLE_PUBKEY)).toBe(2);
  });

  it('resolves a pubkey present in meta.loadedAddresses.readonly, offset past accountKeys + writable', () => {
    const tx: ParsedTransactionInput = makeTx(accountKeys, {
      innerInstructions: null,
      loadedAddresses: { writable: [LOOKUP_WRITABLE_PUBKEY], readonly: [LOOKUP_READONLY_PUBKEY] },
    });

    expect(findAccountIndex(tx, LOOKUP_READONLY_PUBKEY)).toBe(3);
  });

  it('returns -1 when the pubkey is not found anywhere', () => {
    const tx: ParsedTransactionInput = makeTx(accountKeys, {
      innerInstructions: null,
      loadedAddresses: { writable: [LOOKUP_WRITABLE_PUBKEY], readonly: [LOOKUP_READONLY_PUBKEY] },
    });

    expect(findAccountIndex(tx, UNKNOWN_PUBKEY)).toBe(-1);
  });

  it('does not throw and still resolves via loadedAddresses when message.accountKeys is absent entirely', () => {
    const tx: ParsedTransactionInput = {
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txIndex: TX_INDEX,
      transaction: {
        signatures: [SIGNATURE],
        message: { instructions: [] }, // no accountKeys field at all
      },
      meta: {
        innerInstructions: null,
        loadedAddresses: { writable: [LOOKUP_WRITABLE_PUBKEY], readonly: [LOOKUP_READONLY_PUBKEY] },
      },
    };

    expect(() => findAccountIndex(tx, LOOKUP_WRITABLE_PUBKEY)).not.toThrow();
    // accountKeys treated as empty (length 0), so the writable lookup address lands at index 0.
    expect(findAccountIndex(tx, LOOKUP_WRITABLE_PUBKEY)).toBe(0);
  });

  it('returns -1 (not found) when both message.accountKeys and meta.loadedAddresses are absent', () => {
    const tx: ParsedTransactionInput = {
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txIndex: TX_INDEX,
      transaction: {
        signatures: [SIGNATURE],
        message: { instructions: [] }, // no accountKeys field at all
      },
      meta: { innerInstructions: null }, // no loadedAddresses field at all
    };

    expect(() => findAccountIndex(tx, UNKNOWN_PUBKEY)).not.toThrow();
    expect(findAccountIndex(tx, UNKNOWN_PUBKEY)).toBe(-1);
  });
});
