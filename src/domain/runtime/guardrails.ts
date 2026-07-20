import type { GovernedAnswer } from "./model-runtime";

export type InputGuardrailResult =
  Readonly<{ allowed: true; value: string }> | Readonly<{ allowed: false; code: string }>;

const ATTACKS: ReadonlyArray<readonly [string, RegExp]> = [
  ["INSTRUCTION_OVERRIDE", /ignore (all |any )?(previous|prior|system|developer) instructions?/i],
  ["PROMPT_EXTRACTION", /(reveal|show|print|repeat).{0,30}(system prompt|instructions?)/i],
  [
    "SECRET_EXTRACTION",
    /(reveal|show|print|extract).{0,30}(secret|api[ _-]?key|token|environment)/i,
  ],
  [
    "CONTEXT_AS_INSTRUCTIONS",
    /(treat|follow|execute).{0,30}(documents?|retrieved context).{0,20}instructions?/i,
  ],
];

export function guardInput(input: string, maximumLength: number): InputGuardrailResult {
  const value = input.trim();
  if (!value) return { allowed: false, code: "INPUT_EMPTY" };
  if (value.length > maximumLength) return { allowed: false, code: "INPUT_TOO_LONG" };
  if (/\0|[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value))
    return { allowed: false, code: "INPUT_CONTROL_CHARACTER" };
  const attack = ATTACKS.find(([, pattern]) => pattern.test(value));
  return attack ? { allowed: false, code: attack[0] } : { allowed: true, value };
}

const SENSITIVE = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\b(?:sk|pk)-[A-Za-z0-9_-]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~-]{16,}\b/i,
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s]+/i,
  /\b(?:api[_-]?key|authorization|password)\s*[:=]\s*\S+/i,
];

export function protectOutput(
  output: GovernedAnswer,
  retrievedIds: ReadonlySet<string>,
  maximumCharacters = 8_000,
):
  Readonly<{ success: true; output: GovernedAnswer }> | Readonly<{ success: false; code: string }> {
  if (output.answerMarkdown.length > maximumCharacters)
    return { success: false, code: "OUTPUT_TOO_LONG" };
  if (/<[^>]+>|javascript:/i.test(output.answerMarkdown))
    return { success: false, code: "OUTPUT_ACTIVE_MARKUP" };
  if (SENSITIVE.some((pattern) => pattern.test(output.answerMarkdown)))
    return { success: false, code: "OUTPUT_SENSITIVE_DATA" };
  const unique = [...new Set(output.citationIds)];
  if (unique.length !== output.citationIds.length)
    return { success: false, code: "CITATION_DUPLICATE" };
  if (unique.some((id) => !retrievedIds.has(id)))
    return { success: false, code: "CITATION_UNKNOWN" };
  if (!output.insufficientContext && unique.length === 0)
    return { success: false, code: "CITATION_REQUIRED" };
  return { success: true, output: { ...output, citationIds: unique } };
}
