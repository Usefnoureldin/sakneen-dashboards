import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export function generatePassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 10);
}
