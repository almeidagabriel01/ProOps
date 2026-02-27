import { chromium } from "playwright-core";
import chromiumPackage from "@sparticuz/chromium";
import { db } from "../../init";
import { SharedTransactionService } from "./shared-transactions.service";

const PDF_VIEWPORT_WIDTH = 1280;
const PDF_VIEWPORT_HEIGHT = 1700;
const PDF_PAGE_READY_TIMEOUT_MS = 45_000;
const PDF_RENDER_ASSET_TIMEOUT_MS = 20_000;

type TransactionDocData = {
  tenantId?: unknown;
  description?: unknown;
};

function getBaseAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  const isLocal =
    process.env.FUNCTIONS_EMULATOR === "true" ||
    process.env.NODE_ENV === "development";
  return isLocal ? "http://localhost:3000/" : "https://proops.com.br/";
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

async function generatePdfFromUrl(url: string): Promise<Buffer> {
  chromiumPackage.setGraphicsMode = false;
  const executablePath = await chromiumPackage.executablePath();
  const pageErrors: string[] = [];

  const browser = await chromium.launch({
    executablePath,
    args: chromiumPackage.args,
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: PDF_VIEWPORT_WIDTH, height: PDF_VIEWPORT_HEIGHT },
    });

    const bypassSecret = process.env.VERCEL_PROTECTION_BYPASS_SECRET || "";
    const extraHeaders: Record<string, string> = {
      "x-pdf-generator": "true",
    };
    if (bypassSecret) {
      extraHeaders["x-vercel-protection-bypass"] = bypassSecret;
    }
    await page.setExtraHTTPHeaders(extraHeaders);

    page.on("pageerror", (error) => {
      pageErrors.push(error?.message || "unknown_page_error");
    });

    page.on("requestfailed", (request) => {
      const failureText = request.failure()?.errorText || "request_failed";
      pageErrors.push(`${request.method()} ${request.url()} :: ${failureText}`);
    });

    await page.goto(`${url}?print=1`, {
      waitUntil: "networkidle",
      timeout: PDF_PAGE_READY_TIMEOUT_MS,
    });

    await page.waitForFunction(
      async () => {
        try {
          await document.fonts.ready;
        } catch {
          // Ignore fonts readiness failures.
        }

        const marker = document.querySelector('[data-pdf-transaction-ready="1"]');
        if (!marker) return false;

        const imageWaiters = Array.from(document.images).map(
          (image) =>
            new Promise<void>((resolve) => {
              if (image.complete) {
                resolve();
                return;
              }
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
        );

        await Promise.all(imageWaiters);
        return true;
      },
      { timeout: PDF_RENDER_ASSET_TIMEOUT_MS },
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return Buffer.from(pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnostics = pageErrors.slice(0, 8).join(" || ") || "UNAVAILABLE";
    throw new Error(
      `TRANSACTION_PDF_RENDER_FAILED: ${message} | pageErrors=${diagnostics}`,
    );
  } finally {
    await browser.close();
  }
}

export async function generateSharedTransactionPdf(token: string): Promise<{
  buffer: Buffer;
  transactionDescription: string;
}> {
  const sharedTransaction = await SharedTransactionService.getSharedTransaction(token);
  if (!sharedTransaction) {
    throw new Error("SHARED_TRANSACTION_NOT_FOUND");
  }

  const transactionRef = db.collection("transactions").doc(sharedTransaction.transactionId);
  const transactionSnap = await transactionRef.get();
  if (!transactionSnap.exists) {
    throw new Error("TRANSACTION_NOT_FOUND");
  }

  const transactionData = (transactionSnap.data() || {}) as TransactionDocData;
  const transactionTenantId = toStringValue(transactionData.tenantId);
  if (!transactionTenantId || transactionTenantId !== sharedTransaction.tenantId) {
    throw new Error("SHARED_TRANSACTION_NOT_FOUND");
  }

  const shareUrl = new URL(
    `/share/transaction/${encodeURIComponent(token)}`,
    getBaseAppUrl(),
  ).toString();
  const buffer = await generatePdfFromUrl(shareUrl);

  return {
    buffer,
    transactionDescription:
      toStringValue(transactionData.description) || transactionSnap.id,
  };
}
