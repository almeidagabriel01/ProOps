import { Request, Response } from "express";
import { db } from "../../init";
import { WebhookPayload } from "../services/whatsapp/whatsapp.types";
import {
  verifyWhatsAppSignature,
  normalizePhoneNumber,
  logIncomingStatuses,
} from "../services/whatsapp/whatsapp.utils";
import {
  checkRateLimit,
  getOrCreateSession,
  updateSession,
  logAction,
  checkUsage,
  incrementUsage,
} from "../services/whatsapp/whatsapp.session";
import { sendWhatsAppMessage } from "../services/whatsapp/whatsapp.api";
import {
  handleListProposals,
  handleSendPdf,
  handleFinancialDaySummary,
  handleCurrentBalance,
} from "../services/whatsapp/whatsapp.flows";

const MONTHLY_LIMIT = Number(process.env.WHATSAPP_MONTHLY_LIMIT) || 2000;

export const verifyChallenge = async (req: Request, res: Response) => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!VERIFY_TOKEN) {
    console.error("WHATSAPP_VERIFY_TOKEN is not defined");
    return res.status(500).send("Internal Server Error");
  }

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send("Forbidden");
    }
  }

  return res.status(200).send("Hello WhatsApp");
};

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

    if (!APP_SECRET) {
      console.error("WHATSAPP_APP_SECRET is not defined");
      return res.status(500).send("Server Configuration Error");
    }

    const signature = req.headers["x-hub-signature-256"] as string;

    const rawBodyBuffer = (req as any).rawBody;
    const rawBodyString = rawBodyBuffer
      ? rawBodyBuffer.toString("utf8")
      : JSON.stringify(req.body);

    if (
      !verifyWhatsAppSignature(
        rawBodyBuffer || rawBodyString,
        signature,
        APP_SECRET,
      )
    ) {
      console.log("Invalid WhatsApp signature");
      return res.status(401).send("Invalid signature");
    }

    const body = req.body as WebhookPayload;

    if (body.object === "whatsapp_business_account") {
      const changeValue = body.entry?.[0]?.changes?.[0]?.value;

      if (changeValue?.statuses?.length) {
        logIncomingStatuses(changeValue.statuses);
      }

      if (changeValue?.messages?.[0]) {
        const message = changeValue.messages[0];
        const from = message.from;
        const phone = normalizePhoneNumber(from);
        const text = message.text?.body || "";

        const isRateLimitOk = await checkRateLimit(from);
        if (!isRateLimitOk) {
          await sendWhatsAppMessage(
            from,
            "⏳ Limite temporário de uso atingido. Tente novamente em alguns minutos.",
          );
          return res.status(200).send("OK");
        }

        if (!phone) {
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        const phoneIndexSnap = await db
          .collection("phoneNumberIndex")
          .doc(phone)
          .get();
        if (!phoneIndexSnap.exists) {
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        const phoneIndexData = phoneIndexSnap.data() as
          | { userId?: string; tenantId?: string }
          | undefined;
        const indexedUserId = String(phoneIndexData?.userId || "").trim();
        const indexedTenantId = String(phoneIndexData?.tenantId || "").trim();

        if (!indexedUserId || !indexedTenantId) {
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        const userDoc = await db.collection("users").doc(indexedUserId).get();
        if (!userDoc.exists) {
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        const user = { id: userDoc.id, ...userDoc.data() } as any;
        if (user.status === "inactive") {
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        if (user.tenantId && user.tenantId !== indexedTenantId) {
          console.warn("[WhatsApp] phone index tenant mismatch", {
            phone,
            userId: user.id,
            userTenantId: user.tenantId,
            indexTenantId: indexedTenantId,
          });
          await sendWhatsAppMessage(from, "Seu número não está vinculado");
          return res.status(200).send("OK");
        }

        const tenantId = indexedTenantId;
        console.log("[WhatsApp] resolved phone", {
          phone,
          userId: user.id,
          tenantId,
        });

        const tenantRef = db.collection("tenants").doc(tenantId);
        const tenantSnap = await tenantRef.get();

        if (!tenantSnap.exists) {
          return res.status(200).send("OK");
        }

        const tenantData = tenantSnap.data()!;

        if (tenantData.whatsappEnabled !== true) {
          await sendWhatsAppMessage(
            from,
            "🚫 O WhatsApp não está habilitado para sua empresa. Entre em contato com o administrador.",
          );
          return res.status(200).send("OK");
        }

        const limit = tenantData.whatsappMonthlyLimit || MONTHLY_LIMIT;
        const allowOverage = tenantData.whatsappAllowOverage === true;

        const isUsageOk = await checkUsage(tenantId, limit, allowOverage);

        if (!isUsageOk) {
          await sendWhatsAppMessage(
            from,
            "⚠️ O limite mensal de uso do WhatsApp foi atingido. Entre em contato com o administrador.",
          );
          return res.status(200).send("OK");
        }

        const normalizedText = text.toLowerCase().trim();

        const session = await getOrCreateSession(from, user.id);

        let actionProcessed = false;

        if (normalizedText.startsWith("#")) {
          const inputId = text.trim().substring(1).trim();
          if (inputId) {
            await handleSendPdf(from, tenantId, inputId, user.id);
            actionProcessed = true;
          }
        } else if (
          session.lastAction === "awaiting_proposal_selection" &&
          session.proposalsShown &&
          /^\d+$/.test(normalizedText)
        ) {
          const index = parseInt(normalizedText, 10);

          if (index === 0) {
            await sendWhatsAppMessage(
              from,
              "Retornando ao menu...\n\nOlá! Sou seu assistente ERP. Posso ajudar com:\n\n1. 'Ver propostas'\n2. 'Financeiro de hoje'\n3. 'Saldo atual'",
            );
            await updateSession(from, {
              lastAction: "idle",
              proposalsShown: [],
            });
            actionProcessed = true;
          } else {
            const selected = session.proposalsShown.find(
              (p) => p.index === index,
            );

            if (selected) {
              await handleSendPdf(from, tenantId, selected.id, user.id);
            } else {
              await sendWhatsAppMessage(
                from,
                "Não encontrei a proposta com esse número na lista. Digite um número válido, ou digite *0* para voltar ao menu inicial.",
              );
            }
            actionProcessed = true;
          }
        } else if (
          normalizedText === "1" ||
          ["ver propostas", "minhas propostas", "listar propostas"].some((t) =>
            normalizedText.includes(t),
          )
        ) {
          await handleListProposals(from, tenantId, user.id);
          actionProcessed = true;
        } else if (
          normalizedText === "2" ||
          ["financeiro de hoje", "resumo de hoje", "movimento do dia"].some(
            (t) => normalizedText.includes(t),
          )
        ) {
          if (!["admin", "superadmin"].includes(user.role)) {
            await sendWhatsAppMessage(
              from,
              "Você não tem permissão para acessar informações financeiras pelo WhatsApp.",
            );
            await logAction(from, user.id, "unauthorized_access_attempt", {
              target: "financial_summary",
            });
          } else {
            await handleFinancialDaySummary(from, tenantId, user.id);
          }
          actionProcessed = true;
        } else if (
          normalizedText === "3" ||
          ["saldo", "saldo atual", "quanto tenho", "caixa"].some((t) =>
            normalizedText.includes(t),
          )
        ) {
          if (!["admin", "superadmin"].includes(user.role)) {
            await sendWhatsAppMessage(
              from,
              "Você não tem permissão para acessar o saldo pelo WhatsApp.",
            );
            await logAction(from, user.id, "unauthorized_access_attempt", {
              target: "balance",
            });
          } else {
            await handleCurrentBalance(from, tenantId, user.id);
          }
          actionProcessed = true;
        } else if (
          ["cadastrar", "editar", "criar", "alterar", "excluir"].some((t) =>
            normalizedText.includes(t),
          )
        ) {
          await sendWhatsAppMessage(
            from,
            "Essa operação não pode ser realizada pelo WhatsApp. Acesse o sistema para continuar.",
          );
          actionProcessed = true;
        } else {
          await sendWhatsAppMessage(
            from,
            "Olá! Sou seu assistente ERP. Posso ajudar com:\n\n1. 'Ver propostas'\n2. 'Financeiro de hoje'\n3. 'Saldo atual'\n\nOu digite o número da proposta (#ID) para PDF.",
          );
          await updateSession(from, {
            lastAction: "idle",
            proposalsShown: [],
          });
          actionProcessed = true;
        }

        if (actionProcessed) {
          await incrementUsage(tenantId, limit, from);
        }
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).send("Internal Server Error");
  }
};
