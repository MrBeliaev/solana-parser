import {
  TransferEvent,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@app/common';
import { parseTransfers } from './transfers';
import { InnerInstructionSet, JsonParsedInstruction, ParsedTransactionInput } from './types';

const SLOT: number = 123456789;
const BLOCK_TIME: number = 1735689600;
const TX_INDEX: number = 2;
const SIGNATURE: string = '5j7s6NiJS3JAkvgkoc18WVAsiSaci2pxB2A6ueCJP4tprA2TFg9wSyTLeYouxPBJEMzJinENTkpA52YStRW5Dia7';
const SOURCE_PUBKEY: string = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
const DEST_PUBKEY: string = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const AUTHORITY_PUBKEY: string = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const MINT_PUBKEY: string = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function makeTx (
  instructions: JsonParsedInstruction[],
  innerInstructions: InnerInstructionSet[] | null = null,
): ParsedTransactionInput {
  return {
    slot: SLOT,
    blockTime: BLOCK_TIME,
    txIndex: TX_INDEX,
    transaction: {
      signatures: [SIGNATURE],
      message: { instructions },
    },
    meta: innerInstructions === null ? null : { innerInstructions },
  };
}

describe('parseTransfers', () => {
  it('maps a native SOL transfer instruction to a TransferEvent', () => {
    const instructions: JsonParsedInstruction[] = [
      {
        programId: SYSTEM_PROGRAM_ID,
        program: 'system',
        parsed: {
          type: 'transfer',
          info: {
            source: SOURCE_PUBKEY,
            destination: DEST_PUBKEY,
            lamports: 1500000000,
          },
        },
      },
    ];

    const [event] = parseTransfers(makeTx(instructions));

    expect(event).toEqual<TransferEvent>({
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txSignature: SIGNATURE,
      txIndex: TX_INDEX,
      instructionIndex: 0,
      innerIndex: null,
      programId: SYSTEM_PROGRAM_ID,
      transferType: 'sol',
      mint: '',
      decimals: 9,
      source: SOURCE_PUBKEY,
      destination: DEST_PUBKEY,
      authority: SOURCE_PUBKEY,
      amountRaw: '1500000000',
      amountUi: 1.5,
    });
  });

  it('maps a plain SPL transfer instruction to a TransferEvent with an empty mint', () => {
    const instructions: JsonParsedInstruction[] = [
      {
        programId: TOKEN_PROGRAM_ID,
        program: 'spl-token',
        parsed: {
          type: 'transfer',
          info: {
            source: SOURCE_PUBKEY,
            destination: DEST_PUBKEY,
            authority: AUTHORITY_PUBKEY,
            amount: '2500000',
          },
        },
      },
    ];

    const [event] = parseTransfers(makeTx(instructions));

    expect(event).toEqual<TransferEvent>({
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txSignature: SIGNATURE,
      txIndex: TX_INDEX,
      instructionIndex: 0,
      innerIndex: null,
      programId: TOKEN_PROGRAM_ID,
      transferType: 'spl',
      mint: '',
      decimals: null,
      source: SOURCE_PUBKEY,
      destination: DEST_PUBKEY,
      authority: AUTHORITY_PUBKEY,
      amountRaw: '2500000',
      amountUi: 2500000,
    });
  });

  it('leaves amountUi numerically equal to amountRaw when decimals is unknown (plain SPL transfer)', () => {
    // Documents the deliberate limitation described in transfers.ts: without a mint/decimals
    // lookup, `amountUi` is NOT a real human-readable value here — it is `amountRaw` treated as
    // if decimals were 0. This test locks that behavior in so it can't drift silently.
    const instructions: JsonParsedInstruction[] = [
      {
        programId: TOKEN_PROGRAM_ID,
        program: 'spl-token',
        parsed: {
          type: 'transfer',
          info: {
            source: SOURCE_PUBKEY,
            destination: DEST_PUBKEY,
            authority: AUTHORITY_PUBKEY,
            amount: '2500000',
          },
        },
      },
    ];

    const [event] = parseTransfers(makeTx(instructions));

    expect(event).toBeDefined();
    expect(event?.decimals).toBeNull();
    expect(event?.amountUi).toBe(Number(event?.amountRaw));
  });

  it('maps a transferChecked instruction through the classic Token Program to a TransferEvent', () => {
    const instructions: JsonParsedInstruction[] = [
      {
        programId: TOKEN_PROGRAM_ID,
        program: 'spl-token',
        parsed: {
          type: 'transferChecked',
          info: {
            source: SOURCE_PUBKEY,
            destination: DEST_PUBKEY,
            authority: AUTHORITY_PUBKEY,
            mint: MINT_PUBKEY,
            tokenAmount: {
              amount: '3000000',
              decimals: 6,
              uiAmount: 3,
              uiAmountString: '3',
            },
          },
        },
      },
    ];

    const [event] = parseTransfers(makeTx(instructions));

    expect(event).toEqual<TransferEvent>({
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txSignature: SIGNATURE,
      txIndex: TX_INDEX,
      instructionIndex: 0,
      innerIndex: null,
      programId: TOKEN_PROGRAM_ID,
      transferType: 'spl_checked',
      mint: MINT_PUBKEY,
      decimals: 6,
      source: SOURCE_PUBKEY,
      destination: DEST_PUBKEY,
      authority: AUTHORITY_PUBKEY,
      amountRaw: '3000000',
      amountUi: 3,
    });
  });

  it('maps a Token-2022 transferChecked instruction to a TransferEvent', () => {
    const instructions: JsonParsedInstruction[] = [
      {
        programId: TOKEN_2022_PROGRAM_ID,
        program: 'spl-token-2022',
        parsed: {
          type: 'transferChecked',
          info: {
            source: SOURCE_PUBKEY,
            destination: DEST_PUBKEY,
            authority: AUTHORITY_PUBKEY,
            mint: MINT_PUBKEY,
            tokenAmount: {
              amount: '1000000',
              decimals: 6,
              uiAmount: 1,
              uiAmountString: '1',
            },
          },
        },
      },
    ];

    const [event] = parseTransfers(makeTx(instructions));

    expect(event).toEqual<TransferEvent>({
      slot: SLOT,
      blockTime: BLOCK_TIME,
      txSignature: SIGNATURE,
      txIndex: TX_INDEX,
      instructionIndex: 0,
      innerIndex: null,
      programId: TOKEN_2022_PROGRAM_ID,
      transferType: 'spl_checked',
      mint: MINT_PUBKEY,
      decimals: 6,
      source: SOURCE_PUBKEY,
      destination: DEST_PUBKEY,
      authority: AUTHORITY_PUBKEY,
      amountRaw: '1000000',
      amountUi: 1,
    });
  });

  it('returns an empty array for a transaction with no matching instructions', () => {
    const instructions: JsonParsedInstruction[] = [
      {
        programId: TOKEN_PROGRAM_ID,
        program: 'spl-token',
        parsed: {
          type: 'approve',
          info: {
            source: SOURCE_PUBKEY,
            delegate: AUTHORITY_PUBKEY,
            amount: '100',
          },
        },
      },
    ];

    expect(parseTransfers(makeTx(instructions))).toEqual([]);
  });

  it('walks inner instructions and records their instruction/inner indices', () => {
    const innerInstructions: InnerInstructionSet[] = [
      {
        index: 1,
        instructions: [
          {
            programId: TOKEN_PROGRAM_ID,
            program: 'spl-token',
            parsed: {
              type: 'transfer',
              info: {
                source: SOURCE_PUBKEY,
                destination: DEST_PUBKEY,
                authority: AUTHORITY_PUBKEY,
                amount: '42',
              },
            },
          },
        ],
      },
    ];

    const [event] = parseTransfers(makeTx([], innerInstructions));

    expect(event?.instructionIndex).toBe(1);
    expect(event?.innerIndex).toBe(0);
    expect(event?.transferType).toBe('spl');
  });
});
