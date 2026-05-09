import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_DIR = "./uploads";

export function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || DEFAULT_DIR;
}

export async function saveUpload(args: {
  clientId: string;
  uploadId: string;
  buffer: Buffer;
}): Promise<string> {
  const base = getUploadsDir();
  const dir = path.join(base, args.clientId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${args.uploadId}.xlsx`);
  await writeFile(filePath, args.buffer);
  return filePath;
}
