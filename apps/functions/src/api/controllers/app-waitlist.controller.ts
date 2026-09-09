import { Request, Response } from "express";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "../../init";
import { logger } from "../../lib/logger";

const COLLECTION = "app_waitlist";

const AppWaitlistSchema = z.object({
  email: z.string().email("Email inválido").max(200).toLowerCase().trim(),
  // Honeypot. A real person never sees this field, so anything in it is a bot.
  website: z.string().optional().default(""),
});

/**
 * The document id is a hash of the email rather than the email itself.
 *
 * Two reasons, and only the second is about privacy. First, a Firestore
 * document id cannot contain a slash and cannot be "." or "..", and while a
 * normal address has none of those, an id derived from arbitrary user input is
 * a write that fails on the one address that does. Second, the hash makes the
 * write idempotent for free: submitting twice updates one document instead of
 * creating a second row that someone has to de-duplicate later.
 */
function idDoEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex");
}

export async function joinAppWaitlist(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = AppWaitlistSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Dados inválidos.",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  // A filled honeypot gets the same answer a person gets. Telling a bot it was
  // caught only teaches whoever wrote it to stop filling the field.
  if (parsed.data.website !== "") {
    res.status(200).json({ success: true });
    return;
  }

  const { email } = parsed.data;

  try {
    await db
      .collection(COLLECTION)
      .doc(idDoEmail(email))
      .set(
        {
          email,
          origem: "landing-aplicativo",
          criadoEm: FieldValue.serverTimestamp(),
          atualizadoEm: FieldValue.serverTimestamp(),
        },
        // Merge so a second submission refreshes the timestamp instead of
        // failing or duplicating. `criadoEm` is overwritten by design: the
        // exact first-seen moment is not worth a read-before-write here.
        { merge: true },
      );

    // The address is the payload of this endpoint, so it is deliberately NOT
    // logged: the project's logging rule lists full e-mail addresses among the
    // things that never go to Cloud Logging.
    logger.info("App waitlist signup", { origem: "landing-aplicativo" });

    res.status(200).json({ success: true });
  } catch (err) {
    logger.error("App waitlist write failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res
      .status(500)
      .json({ message: "Erro ao registrar seu e-mail. Tente novamente." });
  }
}
