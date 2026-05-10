import { signPdfToken } from "@/lib/pdf-token";

/**
 * Render the /print/[uploadId] page in headless Chromium and return the PDF bytes.
 * Used both at publish time (pre-gen) and as the fallback for downloads where the
 * cached file is missing.
 */
export async function generateUploadPdf(args: {
  uploadId: string;
  baseUrl: string;
}): Promise<Buffer> {
  const { uploadId, baseUrl } = args;
  const token = signPdfToken(uploadId);
  const printUrl = `${baseUrl}/print/${uploadId}?token=${encodeURIComponent(token)}`;

  // Lazy import so the heavy playwright dep isn't loaded at module init time.
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle", timeout: 30_000 });
    await page
      .waitForSelector('#print-ready[data-ready="1"]', { timeout: 10_000 })
      .catch(() => {});
    await page.waitForTimeout(400);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

/**
 * Resolve the public origin to use when Playwright fetches /print/...
 * Mirrors the resolution used in the PDF route. Must work from server actions
 * (where we have the request via next/headers).
 */
export function resolvePrintBaseUrl(headers: {
  get(name: string): string | null;
}): string {
  const forwardedHost = headers.get("x-forwarded-host");
  const forwardedProto = headers.get("x-forwarded-proto") || "https";
  const host = headers.get("host");
  return (
    process.env.PRINT_BASE_URL ||
    process.env.AUTH_URL ||
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ||
    (host ? `http://${host}` : "http://localhost:3000")
  );
}
