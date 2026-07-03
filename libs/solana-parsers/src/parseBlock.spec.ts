import { TOKEN_PROGRAM_ID, SYSTEM_PROGRAM_ID } from '@app/common';
import { parseBlock, ParseBlockResult } from './parseBlock';
import { BlockNotification, JsonParsedInstruction, RawBlockTransaction } from './types';

const SLOT: number = 123456789;
const BLOCK_TIME: number = 1735689600;
const SOL_SIG: string = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';
const MINT_SIG: string = '3nR1x1MvXvS3FS7EhH9wY9v3ekS3g7dK2eB6z8u1nR1x1MvXvS3FS7EhH9wY9v3ekS3g7dK2eB6z8u1nR1x1M';
const SOURCE_PUBKEY: string = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
const DEST_PUBKEY: string = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const MINT_PUBKEY: string = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MINT_AUTHORITY_PUBKEY: string = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

function makeRawTx (signature: string, instructions: JsonParsedInstruction[]): RawBlockTransaction {
  return {
    transaction: {
      signatures: [signature],
      message: { instructions },
    },
    meta: null,
  };
}

describe('parseBlock', () => {
  it('concatenates transfers/newTokens across all txs, leaving swaps/pools/mintRefs empty', () => {
    const solTransferTx: RawBlockTransaction = makeRawTx(SOL_SIG, [
      {
        programId: SYSTEM_PROGRAM_ID,
        program: 'system',
        parsed: {
          type: 'transfer',
          info: {
            source: SOURCE_PUBKEY,
            destination: DEST_PUBKEY,
            lamports: 1000000000,
          },
        },
      },
    ]);

    const initializeMintTx: RawBlockTransaction = makeRawTx(MINT_SIG, [
      {
        programId: TOKEN_PROGRAM_ID,
        program: 'spl-token',
        parsed: {
          type: 'initializeMint',
          info: {
            mint: MINT_PUBKEY,
            decimals: 6,
            mintAuthority: MINT_AUTHORITY_PUBKEY,
          },
        },
      },
    ]);

    const block: BlockNotification = {
      slot: SLOT,
      block: {
        blockTime: BLOCK_TIME,
        transactions: [solTransferTx, initializeMintTx],
      },
    };

    const result: ParseBlockResult = parseBlock(block);

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]?.transferType).toBe('sol');
    expect(result.transfers[0]?.txSignature).toBe(SOL_SIG);

    expect(result.newTokens).toHaveLength(1);
    expect(result.newTokens[0]?.mint).toBe(MINT_PUBKEY);
    expect(result.newTokens[0]?.txSignature).toBe(MINT_SIG);

    expect(result.swaps).toEqual([]);
    expect(result.pools).toEqual([]);
    expect(result.mintRefs).toEqual([]);
  });

  it('returns empty arrays for a block with no transactions', () => {
    const block: BlockNotification = {
      slot: SLOT,
      block: {
        blockTime: BLOCK_TIME,
        transactions: [],
      },
    };

    const result: ParseBlockResult = parseBlock(block);

    expect(result).toEqual<ParseBlockResult>({
      transfers: [],
      newTokens: [],
      swaps: [],
      pools: [],
      mintRefs: [],
    });
  });
});
