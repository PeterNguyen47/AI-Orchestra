import type { GovernedAnswer } from "./model-runtime";
import { containsSensitiveText } from "@/domain/security/sensitive-data";

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
  [
    "ROLE_IMPERSONATION",
    /(?:act|behave|respond|pretend)\s+(?:as|like)\s+(?:an?\s+)?(?:system|developer|administrator|root|privileged)\b|\byou are now (?:the )?(?:system|developer|administrator|root)\b/i,
  ],
  [
    "POLICY_BYPASS",
    /(?:bypass|circumvent|disable|evade|override).{0,30}(?:policy|policies|safety|guardrails?|governance|restrictions?)/i,
  ],
  [
    "TOOL_INVOCATION_ATTEMPT",
    /(?:call|invoke|run|execute|use).{0,24}(?:tool|function|shell|terminal|command|connector)\b|\btool[_ -]?call\b/i,
  ],
  [
    "DATA_EXFILTRATION_ATTEMPT",
    /(?:exfiltrate|transmit|send|upload).{0,40}(?:data|context|documents?|secrets?|credentials?|content).{0,30}(?:external|remote|server|endpoint|url|third.?party)/i,
  ],
];

const COMPACT_ATTACKS: ReadonlyArray<string> = [
  "ignorepreviousinstructions",
  "ignorepriorinstructions",
  "revealsystemprompt",
  "showsystemprompt",
  "bypasssafetypolicy",
  "disableguardrails",
  "executetool",
  "invoketool",
  "exfiltratedata",
];

function normalizeDetectionInput(value: string): Readonly<{ spaced: string; compact: string }> {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, "")
    .toLowerCase();
  const spaced = normalized
    .replace(/[._:/\\|=+~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { spaced, compact: spaced.replace(/[^a-z0-9]+/g, "") };
}

export function guardInput(input: string, maximumLength: number): InputGuardrailResult {
  const value = input.normalize("NFKC").trim();
  if (!value) return { allowed: false, code: "INPUT_EMPTY" };
  if (value.length > maximumLength) return { allowed: false, code: "INPUT_TOO_LONG" };
  if (/\0|[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value))
    return { allowed: false, code: "INPUT_CONTROL_CHARACTER" };
  const detection = normalizeDetectionInput(value);
  const attack = ATTACKS.find(([, pattern]) => pattern.test(detection.spaced));
  if (attack) return { allowed: false, code: attack[0] };
  if (COMPACT_ATTACKS.some((pattern) => detection.compact.includes(pattern))) {
    return { allowed: false, code: "ENCODED_INSTRUCTION_ATTEMPT" };
  }
  return { allowed: true, value };
}

export const SYSTEM_INSTRUCTION_CANARY = "AI_ORCHESTRA_SYSTEM_INSTRUCTION_CANARY_V1" as const;

export function containsSensitiveOutput(value: string): boolean {
  return value.includes(SYSTEM_INSTRUCTION_CANARY) || containsSensitiveText(value);
}

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
  if (containsSensitiveOutput(output.answerMarkdown))
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
