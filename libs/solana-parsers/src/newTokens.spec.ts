import { NewTokenEvent, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@app/common';
import { parseNewTokens } from './newTokens';
import { JsonParsedInstruction, ParsedTransactionInput } from './types';

const SLOT: number = 123456789;
const BLOCK_TIME: number = 1735689600;
const TX_INDEX: number = 0;
const SIGNATURE: string = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';
const MINT_PUBKEY: string = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MINT_AUTHORITY_PUBKEY: string = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const FREEZE_AUTHORITY_PUBKEY: string = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

function makeTx (instructions: JsonParsedInstruction[]): ParsedTransactionInput {
  return {
    slot: SLOT,
    blockTime: BLOCK_TIME,
    txIndex: TX_INDEX,
    transaction: {
      signatures: [SIGNATURE],
      message: { instructions },
    },
    meta: null,
  };
}

describe('parseNewTokens', () => {
  it('maps an initializeMint instruction to a NewTokenEvent', () => {
    const instructions: JsonParsedInstruction[] = [
      {
        programId: TOKEN_PROGRAM_ID,
        program: 'spl-token',
        parsed: {
          type: 'initializeMint',
          info: {
            mint: MINT_PUBKEY,
            decimals: 6,
            mintAuthority: MINT_AUTHORITY_PUBKEY,
            freezeAuthority: FREEZE_AUTHORITY_PUBKEY,
            rentSysvar: 'SysvarRent111111111111111111111111111111',
          },
        },
      },
    ];

    const [event] = parseNewTokens(makeTx(instructions));

    expect(event).toEqual<NewTokenEvent>({
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txSignature: SIGNATURE,
      instructionIndex: 0,
      programId: TOKEN_PROGRAM_ID,
      mint: MINT_PUBKEY,
      decimals: 6,
      mintAuthority: MINT_AUTHORITY_PUBKEY,
      freezeAuthority: FREEZE_AUTHORITY_PUBKEY,
      initMethod: 'initializeMint',
    });
  });

  it('maps an initializeMint2 (Token-2022) instruction to a NewTokenEvent', () => {
    const instructions: JsonParsedInstruction[] = [
      {
        programId: TOKEN_2022_PROGRAM_ID,
        program: 'spl-token-2022',
        parsed: {
          type: 'initializeMint2',
          info: {
            mint: MINT_PUBKEY,
            decimals: 9,
            mintAuthority: MINT_AUTHORITY_PUBKEY,
            freezeAuthority: FREEZE_AUTHORITY_PUBKEY,
          },
        },
      },
    ];

    const [event] = parseNewTokens(makeTx(instructions));

    expect(event).toEqual<NewTokenEvent>({
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txSignature: SIGNATURE,
      instructionIndex: 0,
      programId: TOKEN_2022_PROGRAM_ID,
      mint: MINT_PUBKEY,
      decimals: 9,
      mintAuthority: MINT_AUTHORITY_PUBKEY,
      freezeAuthority: FREEZE_AUTHORITY_PUBKEY,
      initMethod: 'initializeMint2',
    });
  });

  it('maps freezeAuthority to null when absent from parsed.info', () => {
    const instructions: JsonParsedInstruction[] = [
      {
        programId: TOKEN_PROGRAM_ID,
        program: 'spl-token',
        parsed: {
          type: 'initializeMint2',
          info: {
            mint: MINT_PUBKEY,
            decimals: 2,
            mintAuthority: MINT_AUTHORITY_PUBKEY,
          },
        },
      },
    ];

    const [event] = parseNewTokens(makeTx(instructions));

    expect(event?.freezeAuthority).toBeNull();
  });

  it('returns an empty array for a transaction with no matching instructions', () => {
    const instructions: JsonParsedInstruction[] = [
      {
        programId: TOKEN_PROGRAM_ID,
        program: 'spl-token',
        parsed: {
          type: 'transfer',
          info: {
            source: MINT_AUTHORITY_PUBKEY,
            destination: FREEZE_AUTHORITY_PUBKEY,
            authority: MINT_AUTHORITY_PUBKEY,
            amount: '100',
          },
        },
      },
    ];

    expect(parseNewTokens(makeTx(instructions))).toEqual([]);
  });
});
