import {
  TransferEvent,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@app/common';
import { InstructionLocation, walkInstructions } from './instructionWalk';
import { JsonParsedInstructionParsed, ParsedTransactionInput } from './types';

/** Native SOL always has 9 decimals. */
const SOL_DECIMALS: number = 9;

type BaseTransferFields = Pick<
  TransferEvent,
  'slot' | 'blockTime' | 'txSignature' | 'txIndex' | 'instructionIndex' | 'innerIndex' | 'programId'
>;

function getStringField (info: Record<string, unknown>, key: string): string | null {
  const value: unknown = info[key];
  return typeof value === 'string' ? value : null;
}

function getNumberField (info: Record<string, unknown>, key: string): number | null {
  const value: unknown = info[key];
  return typeof value === 'number' ? value : null;
}

function getTokenAmountField (info: Record<string, unknown>): { amount: string; decimals: number } | null {
  const tokenAmount: unknown = info.tokenAmount;

  if (typeof tokenAmount !== 'object' || tokenAmount === null) {
    return null;
  }

  const record: Record<string, unknown> = tokenAmount as Record<string, unknown>;
  const amount: string | null = getStringField(record, 'amount');
  const decimals: number | null = getNumberField(record, 'decimals');

  if (amount === null || decimals === null) {
    return null;
  }

  return { amount, decimals };
}

/**
 * Converts a raw base-unit amount to its UI (human-readable) value.
 * When `decimals` is unknown (plain SPL `transfer`, see the mint/decimals note below), the amount
 * is left in raw units (decimals treated as 0) — `token-enricher` fills in the real value downstream.
 */
function toUiAmount (amountRaw: string, decimals: number | null): number {
  return Number(amountRaw) / 10 ** (decimals ?? 0);
}

function buildBaseEvent (
  tx: ParsedTransactionInput,
  txSignature: string,
  location: InstructionLocation,
  programId: string,
): BaseTransferFields {
  return {
    slot: tx.slot,
    blockTime: tx.blockTime,
    txSignature,
    txIndex: tx.txIndex,
    instructionIndex: location.instructionIndex,
    innerIndex: location.innerIndex,
    programId,
  };
}

function buildSolTransfer (
  info: Record<string, unknown>,
  tx: ParsedTransactionInput,
  txSignature: string,
  location: InstructionLocation,
  programId: string,
): TransferEvent | null {
  const source: string | null = getStringField(info, 'source');
  const destination: string | null = getStringField(info, 'destination');
  const lamports: number | null = getNumberField(info, 'lamports');

  if (source === null || destination === null || lamports === null) {
    return null;
  }

  const amountRaw: string = lamports.toString();

  return {
    ...buildBaseEvent(tx, txSignature, location, programId),
    transferType: 'sol',
    mint: '', // native SOL transfers have no mint
    decimals: SOL_DECIMALS,
    source,
    destination,
    authority: source, // System transfer's signer/authority is always the source account
    amountRaw,
    amountUi: toUiAmount(amountRaw, SOL_DECIMALS),
  };
}

function buildSplTransfer (
  info: Record<string, unknown>,
  tx: ParsedTransactionInput,
  txSignature: string,
  location: InstructionLocation,
  programId: string,
): TransferEvent | null {
  const source: string | null = getStringField(info, 'source');
  const destination: string | null = getStringField(info, 'destination');
  const authority: string | null = getStringField(info, 'authority');
  const amountRaw: string | null = getStringField(info, 'amount');

  if (source === null || destination === null || authority === null || amountRaw === null) {
    return null;
  }

  return {
    ...buildBaseEvent(tx, txSignature, location, programId),
    transferType: 'spl',
    // Plain `transfer` (unlike `transferChecked`) carries no mint in `parsed.info` — it isn't
    // derivable here without a separate account lookup, so it is left empty for token-enricher.
    mint: '',
    decimals: null,
    source,
    destination,
    authority,
    amountRaw,
    // `decimals` is unknown here (see the `mint`/`decimals` comment above), so `toUiAmount` treats
    // it as 0 — this makes `amountUi` numerically equal to `amountRaw` (NOT a real human-readable
    // UI amount). This is a deliberate, documented limitation, not a bug: recovering the true
    // decimals would require a separate mint-account lookup, which is out of scope here and is
    // performed downstream by `token-enricher`. Callers must not treat this `amountUi` as the
    // real UI value for plain SPL `transfer` events.
    amountUi: toUiAmount(amountRaw, null),
  };
}

function buildSplTransferChecked (
  info: Record<string, unknown>,
  tx: ParsedTransactionInput,
  txSignature: string,
  location: InstructionLocation,
  programId: string,
): TransferEvent | null {
  const source: string | null = getStringField(info, 'source');
  const destination: string | null = getStringField(info, 'destination');
  const authority: string | null = getStringField(info, 'authority');
  const mint: string | null = getStringField(info, 'mint');
  const tokenAmount: { amount: string; decimals: number } | null = getTokenAmountField(info);

  if (source === null || destination === null || authority === null || mint === null || tokenAmount === null) {
    return null;
  }

  return {
    ...buildBaseEvent(tx, txSignature, location, programId),
    transferType: 'spl_checked',
    mint,
    decimals: tokenAmount.decimals,
    source,
    destination,
    authority,
    amountRaw: tokenAmount.amount,
    amountUi: toUiAmount(tokenAmount.amount, tokenAmount.decimals),
  };
}

function parseTransferInstruction (
  tx: ParsedTransactionInput,
  txSignature: string,
  location: InstructionLocation,
): TransferEvent | null {
  const { instruction } = location;
  const parsed: JsonParsedInstructionParsed | undefined = instruction.parsed;

  if (parsed === undefined) {
    return null;
  }

  if (instruction.programId === SYSTEM_PROGRAM_ID && parsed.type === 'transfer') {
    return buildSolTransfer(parsed.info, tx, txSignature, location, instruction.programId);
  }

  const isTokenProgram: boolean =
    instruction.programId === TOKEN_PROGRAM_ID || instruction.programId === TOKEN_2022_PROGRAM_ID;

  if (isTokenProgram && parsed.type === 'transfer') {
    return buildSplTransfer(parsed.info, tx, txSignature, location, instruction.programId);
  }

  if (isTokenProgram && parsed.type === 'transferChecked') {
    return buildSplTransferChecked(parsed.info, tx, txSignature, location, instruction.programId);
  }

  return null;
}

/**
 * Extracts `TransferEvent`s from a single transaction's `jsonParsed` System/Token/Token-2022
 * instructions (both top-level and inner). Non-transfer instructions are ignored.
 */
export function parseTransfers (tx: ParsedTransactionInput): TransferEvent[] {
  const txSignature: string = tx.transaction.signatures[0] ?? '';
  const events: TransferEvent[] = [];

  for (const location of walkInstructions(tx)) {
    const event: TransferEvent | null = parseTransferInstruction(tx, txSignature, location);

    if (event !== null) {
      events.push(event);
    }
  }

  return events;
}
