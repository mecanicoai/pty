import { createHash } from "node:crypto";

export function createIntegrityRequestHash(input: { installId: string; issuedAtMs: number }) {
  return createHash("sha256").update(`${input.installId}:${input.issuedAtMs}:mecanico-play-integrity`).digest("base64url");
}
