import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET_ENV = "AUTH_SECRET";
const TTL_MS = 60_000;

function getSecret(): string {
  const s = process.env[SECRET_ENV];
  if (!s) throw new Error(`${SECRET_ENV} is not set; required to sign PDF tokens`);
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function signPdfToken(uploadId: string): string {
  const exp = Date.now() + TTL_MS;
  const body = Buffer.from(JSON.stringify({ uploadId, exp })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export type PdfTokenPayload = { uploadId: string; exp: number };

export function verifyPdfToken(token: string): PdfTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  // timingSafeEqual requires equal-length buffers
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let parsed: PdfTokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof parsed?.uploadId !== "string" || typeof parsed?.exp !== "number") return null;
  if (parsed.exp < Date.now()) return null;
  return parsed;
}
