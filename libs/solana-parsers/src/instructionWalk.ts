import { InnerInstructionSet, JsonParsedInstruction, ParsedTransactionInput } from './types';

/** One instruction location within a transaction: either top-level or nested inside an inner-instruction set. */
export interface InstructionLocation {
  readonly instruction: JsonParsedInstruction;
  readonly instructionIndex: number;
  readonly innerIndex: number | null;
}

/**
 * Flattens a transaction's top-level `message.instructions[]` and `meta.innerInstructions[]`
 * into a single ordered list of instruction locations, shared by `parseTransfers` and `parseNewTokens`.
 */
export function walkInstructions (tx: ParsedTransactionInput): InstructionLocation[] {
  const locations: InstructionLocation[] = [];

  tx.transaction.message.instructions.forEach((instruction, instructionIndex) => {
    locations.push({ instruction, instructionIndex, innerIndex: null });
  });

  const innerInstructionSets: InnerInstructionSet[] | null | undefined = tx.meta?.innerInstructions ?? [];

  innerInstructionSets.forEach((set) => {
    set.instructions.forEach((instruction, innerIndex) => {
      locations.push({ instruction, instructionIndex: set.index, innerIndex });
    });
  });

  return locations;
}
