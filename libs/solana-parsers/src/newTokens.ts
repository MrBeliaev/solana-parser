import { NewTokenEvent, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@app/common';
import { InstructionLocation, walkInstructions } from './instructionWalk';
import { JsonParsedInstructionParsed, ParsedTransactionInput } from './types';

function getStringField (info: Record<string, unknown>, key: string): string | null {
  const value: unknown = info[key];
  return typeof value === 'string' ? value : null;
}

function getNumberField (info: Record<string, unknown>, key: string): number | null {
  const value: unknown = info[key];
  return typeof value === 'number' ? value : null;
}

function buildNewTokenEvent (
  tx: ParsedTransactionInput,
  txSignature: string,
  location: InstructionLocation,
  programId: string,
  initMethod: 'initializeMint' | 'initializeMint2',
): NewTokenEvent | null {
  const { instruction } = location;
  const info: Record<string, unknown> | undefined = instruction.parsed?.info;

  if (info === undefined) {
    return null;
  }

  const mint: string | null = getStringField(info, 'mint');
  const decimals: number | null = getNumberField(info, 'decimals');
  const mintAuthority: string | null = getStringField(info, 'mintAuthority');

  if (mint === null || decimals === null || mintAuthority === null) {
    return null;
  }

  return {
    slot: tx.slot,
    blockTime: tx.blockTime,
    txSignature,
    instructionIndex: location.instructionIndex,
    programId,
    mint,
    decimals,
    mintAuthority,
    freezeAuthority: getStringField(info, 'freezeAuthority'),
    initMethod,
  };
}

function parseNewTokenInstruction (
  tx: ParsedTransactionInput,
  txSignature: string,
  location: InstructionLocation,
): NewTokenEvent | null {
  const { instruction } = location;
  const parsed: JsonParsedInstructionParsed | undefined = instruction.parsed;

  if (parsed === undefined) {
    return null;
  }

  const isTokenProgram: boolean =
    instruction.programId === TOKEN_PROGRAM_ID || instruction.programId === TOKEN_2022_PROGRAM_ID;

  if (!isTokenProgram) {
    return null;
  }

  if (parsed.type === 'initializeMint' || parsed.type === 'initializeMint2') {
    return buildNewTokenEvent(tx, txSignature, location, instruction.programId, parsed.type);
  }

  return null;
}

/**
 * Extracts `NewTokenEvent`s from a single transaction's `jsonParsed` Token/Token-2022
 * `initializeMint`/`initializeMint2` instructions (both top-level and inner).
 */
export function parseNewTokens (tx: ParsedTransactionInput): NewTokenEvent[] {
  const txSignature: string = tx.transaction.signatures[0] ?? '';
  const events: NewTokenEvent[] = [];

  for (const location of walkInstructions(tx)) {
    const event: NewTokenEvent | null = parseNewTokenInstruction(tx, txSignature, location);

    if (event !== null) {
      events.push(event);
    }
  }

  return events;
}
