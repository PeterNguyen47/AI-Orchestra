const PROHIBITED_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const SENSITIVE_TEXT_PATTERNS: ReadonlyArray<RegExp> = [
  /-----BEGIN (?:ENCRYPTED |(?:DSA|EC|OPENSSH|RSA) )?PRIVATE KEY-----/i,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{12,}\b/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{12,}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+\/-]{8,}\b/i,
  /\b(?:api[_-]?key|authorization|credential|password|passphrase|private[_-]?key|secret|token)\s*[:=]\s*["']?\S{6,}/i,
  /\b(?:cookie|session(?:id|_id)?|set-cookie)\s*[:=]\s*["']?\S{4,}/i,
  /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|sqlserver):\/\/[^\s]+/i,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@/i,
  /(?:^|[\s"'(])(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+\\[^\\\s]+)/,
  /(?:^|[\s"'(])\/(?:home|Users|root)\/[A-Za-z0-9._-]+(?:\/|$)/,
];

export function containsSensitiveText(value: string): boolean {
  return (
    PROHIBITED_CONTROL_CHARACTERS.test(value) ||
    SENSITIVE_TEXT_PATTERNS.some((pattern) => pattern.test(value))
  );
}
