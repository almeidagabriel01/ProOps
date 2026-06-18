import { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { sendEmail } from "../../services/email/send-email";
import {
  renderDemoBookingInternalEmail,
  renderDemoBookingConfirmationEmail,
} from "../../services/email/templates/demo-booking";
import {
  isValidSlotStart,
  hasConflict,
  type BookedInterval,
} from "../../lib/booking-slots";

const COLLECTION = "demo_bookings";

const BookingSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().max(200).toLowerCase().trim(),
  phone: z.string().max(40).optional().transform((v) => v?.trim() || undefined),
  company: z.string().max(100).optional().transform((v) => v?.trim() || undefined),
  message: z.string().max(2000).optional().transform((v) => v?.trim() || undefined),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  startMinutes: z.number().int().min(0).max(1440),
  durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  website: z.string().optional().default(""), // honeypot
});

const MonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const WEEKDAYS = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${WEEKDAYS[dow]}, ${d} de ${MONTHS[m - 1]} de ${y}`;
}

function durationLabel(min: number): string {
  if (min === 60) return "1 hora";
  return `${min} minutos`;
}

// Fim de semana é bloqueado (janela Seg–Sex).
function isWeekendDate(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

export async function getDemoBookingAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  const month = MonthSchema.safeParse(req.query.month);
  if (!month.success) {
    res.status(400).json({ message: "Parâmetro 'month' inválido (YYYY-MM)." });
    return;
  }
  try {
    const start = `${month.data}-01`;
    const end = `${month.data}-31`;
    const snap = await db
      .collection(COLLECTION)
      .where("date", ">=", start)
      .where("date", "<=", end)
      .limit(500)
      .get();

    const out: { date: string; startMinutes: number; endMinutes: number }[] = [];
    snap.forEach((doc) => {
      const b = doc.data() as Record<string, unknown>;
      out.push({
        date: String(b.date),
        startMinutes: Number(b.startMinutes),
        endMinutes: Number(b.endMinutes),
      });
    });
    res.status(200).json({ bookings: out });
  } catch (err) {
    logger.error("demo-booking availability failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: "Erro ao carregar disponibilidade." });
  }
}

export async function submitDemoBooking(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = BookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dados inválidos." });
    return;
  }
  const data = parsed.data;

  // Honeypot: bot preencheu → finge sucesso, não persiste.
  if (data.website !== "") {
    res.status(200).json({ success: true });
    return;
  }

  // Regras de slot (grade + expediente + dia útil).
  if (!isValidSlotStart(data.startMinutes, data.durationMinutes)) {
    res.status(400).json({ message: "Horário inválido." });
    return;
  }
  if (isWeekendDate(data.date)) {
    res.status(400).json({ message: "Reuniões apenas em dias úteis." });
    return;
  }

  const endMinutes = data.startMinutes + data.durationMinutes;

  try {
    await db.runTransaction(async (tx) => {
      const dayQuery = db
        .collection(COLLECTION)
        .where("date", "==", data.date)
        .limit(100);
      const snap = await tx.get(dayQuery);

      const existing: BookedInterval[] = [];
      snap.forEach((doc: { data: () => Record<string, unknown> }) => {
        const b = doc.data();
        existing.push({
          startMinutes: Number(b.startMinutes),
          endMinutes: Number(b.endMinutes),
        });
      });

      if (hasConflict(data.startMinutes, data.durationMinutes, existing)) {
        const conflict = new Error("SLOT_TAKEN");
        conflict.name = "SLOT_TAKEN";
        throw conflict;
      }

      const ref = db.collection(COLLECTION).doc();
      tx.set(ref, {
        date: data.date,
        startMinutes: data.startMinutes,
        durationMinutes: data.durationMinutes,
        endMinutes,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        company: data.company ?? null,
        message: data.message ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.name === "SLOT_TAKEN") {
      res.status(409).json({
        message: "Este horário acabou de ser reservado. Escolha outro.",
      });
      return;
    }
    logger.error("demo-booking transaction failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: "Erro ao agendar. Tente novamente." });
    return;
  }

  // Emails (best-effort; o agendamento já está persistido).
  const emailData = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    company: data.company,
    message: data.message,
    dateLabel: dateLabel(data.date),
    timeLabel: `${minutesToLabel(data.startMinutes)}–${minutesToLabel(endMinutes)}`,
    durationLabel: durationLabel(data.durationMinutes),
  };
  try {
    const internal = renderDemoBookingInternalEmail(emailData);
    await sendEmail({
      to: "gestao@proops.com.br",
      subject: internal.subject,
      html: internal.html,
      replyTo: data.email,
      type: "demo_booking_internal",
    });
    const confirm = renderDemoBookingConfirmationEmail(emailData);
    await sendEmail({
      to: data.email,
      subject: confirm.subject,
      html: confirm.html,
      type: "demo_booking_confirmation",
    });
  } catch (err) {
    logger.error("demo-booking sendEmail failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Não falha a request — booking já foi criado.
  }

  logger.info("demo booking created", { date: data.date, startMinutes: data.startMinutes });
  res.status(200).json({ success: true });
}
