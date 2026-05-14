import { Request, Response } from "express";
import { z } from "zod";
import { sendEmail } from "../../services/email/send-email";
import { renderContactFormEmail } from "../../services/email/templates/contact-form";
import { logger } from "../../lib/logger";
import {
  normalizeBrazilPhoneNumber,
  validateBrazilMobilePhone,
} from "../../lib/contact-validation";

const ContactFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100).trim(),
  company: z.string().min(1, "Empresa é obrigatória").max(100).trim(),
  email: z.string().email("Email inválido").max(200).toLowerCase().trim(),
  phone: z.string().optional().transform((val) => val?.trim() || undefined),
  segment: z.string().min(1, "Segmento é obrigatório").max(200).trim(),
  message: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(2000).trim(),
  website: z.string().optional().default(""), // honeypot — deve ser vazio
});

export async function submitContactForm(req: Request, res: Response): Promise<void> {
  const parsed = ContactFormSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      message: "Dados inválidos.",
      errors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  if (parsed.data.website !== "") {
    res.status(200).json({ success: true });
    return;
  }

  let phone: string | undefined;
  if (parsed.data.phone) {
    const normalized = normalizeBrazilPhoneNumber(parsed.data.phone);
    if (normalized && validateBrazilMobilePhone(parsed.data.phone).valid) {
      phone = normalized;
    }
  }

  try {
    const { subject, html } = renderContactFormEmail({
      name: parsed.data.name,
      company: parsed.data.company,
      email: parsed.data.email,
      phone,
      segment: parsed.data.segment,
      message: parsed.data.message,
    });

    await sendEmail({ to: "gestao@proops.com.br", subject, html, type: "contact_form" });

    logger.info("Contact form submitted", {
      email: parsed.data.email,
      segment: parsed.data.segment,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    logger.error("Contact form sendEmail failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: "Erro ao enviar mensagem. Tente novamente." });
  }
}
