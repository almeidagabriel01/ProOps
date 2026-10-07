import { Request, Response } from "express";
import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { resolveUserAndTenant, checkPermission } from "../../lib/auth-helpers";
import { memberLinkErrorMessage, validateMemberLink } from "../services/contact-member-link";
import { isClientUsed } from "../services/proposal-usage.service";
import {
  enforceTenantPlanLimit,
  getTenantClientsUsage,
} from "../../lib/tenant-plan-policy";
import {
  assertTenantExists,
  auditSuperAdminCrossTenantWrite,
} from "../../lib/tenant-resolution";
import { z } from "zod";
import { IPI_CST_SAIDA } from "../services/fiscal/fiscal-types";
import { sanitizeText, sanitizeRichText } from "../../utils/sanitize";
import { buildClientSearchTokens } from "../../lib/search-tokens";
import { cpf, cnpj } from "cpf-cnpj-validator";
import {
  MAX_PARTNER_CONTACTS,
  contactResponsiblesErrorMessage,
  resolvePartnerContactIds,
  resolveResponsibleMember,
} from "../services/contact-responsibles";
import {
  isPriceTableContact,
  validateContactPriceTable,
} from "../services/price-tables/contact-price-table";
import { PriceTableError } from "../services/price-tables/price-tables.service";

/**
 * Campos fiscais do destinatário.
 *
 * Separados do `address` livre de propósito: aquele campo é uma string única,
 * boa para o dia a dia e inútil para a SEFAZ, que valida logradouro, número,
 * bairro, UF e — principalmente — o código IBGE do município. Tentar dividir a
 * string existente daria erro em toda ambiguidade de vírgula.
 *
 * Só a NF-e exige endereço. A NFS-e se contenta com nome e documento.
 */
const EnderecoFiscalSchema = z
  .object({
    logradouro: z.string().max(200).trim().optional().or(z.literal("")),
    numero: z.string().max(20).trim().optional().or(z.literal("")),
    complemento: z.string().max(100).trim().optional().or(z.literal("")),
    bairro: z.string().max(100).trim().optional().or(z.literal("")),
    municipio: z.string().max(120).trim().optional().or(z.literal("")),
    codigoIbge: z.string().max(10).trim().optional().or(z.literal("")),
    uf: z.string().max(2).trim().optional().or(z.literal("")),
    cep: z.string().max(12).trim().optional().or(z.literal("")),
  })
  .optional();

export const ClientFiscalFields = {
  enderecoFiscal: EnderecoFiscalSchema,
  inscricaoEstadual: z.string().max(30).trim().optional().or(z.literal("")),
  /**
   * Rejeição 805: a SEFAZ recusa "isento" para quem simplesmente não é
   * contribuinte do ICMS. Pessoa física nunca é isenta — o backend deriva
   * "não contribuinte" quando o campo vem vazio, e este enum existe só para o
   * caso em que o cliente É contribuinte e precisa dizer.
   */
  indicadorIe: z.enum(["contribuinte", "isento", "nao_contribuinte"]).optional(),
  consumidorFinal: z.boolean().optional(),
  /**
   * Padrão da NF-e para este contato: observação e IPI que já vêm preenchidos
   * ao emitir para ele. `null` apaga. Ver `ClientFiscalDefaults`.
   */
  fiscalDefaults: z
    .object({
      observacoes: z.string().max(1000).trim().optional().or(z.literal("")),
      ipi: z
        .object({
          cst: z.enum(IPI_CST_SAIDA),
          aliquota: z.number().min(0).max(100).optional(),
          codigoEnquadramento: z.string().regex(/^\d{1,3}$/).optional().or(z.literal("")),
        })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
};

/**
 * Padrão fiscal do contato sem campo vazio. `undefined` = nada a guardar, e
 * o chamador apaga o campo.
 */
export function compactFiscalDefaults(
  value: { observacoes?: string; ipi?: { cst: string; aliquota?: number; codigoEnquadramento?: string } | null } | null | undefined,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  const out: Record<string, unknown> = {};
  const observacoes = String(value.observacoes ?? "").trim();
  if (observacoes) out.observacoes = observacoes;
  if (value.ipi?.cst) {
    out.ipi = {
      cst: value.ipi.cst,
      ...(typeof value.ipi.aliquota === "number" ? { aliquota: value.ipi.aliquota } : {}),
      ...(value.ipi.codigoEnquadramento ? { codigoEnquadramento: value.ipi.codigoEnquadramento } : {}),
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

const CreateClientSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres.").max(200).trim(),
  email: z.string().email().max(254).optional().or(z.literal("")),
  phone: z.string().max(30).trim().optional().or(z.literal("")),
  document: z.string().max(20).trim().optional().or(z.literal("")),
  address: z.string().max(500).trim().optional().or(z.literal("")),
  notes: z.string().max(2000).trim().optional().or(z.literal("")),
  types: z.array(z.string().max(50)).max(10).optional(),
  /** Comissao padrao do parceiro. `null` limpa; nunca 0 por omissao. */
  commissionPercentage: z.number().min(0).max(100).nullable().optional(),
  /** Vendedor que é da equipe: o membro ligado a este contato. */
  linkedMemberId: z.string().max(128).nullable().optional(),
  /** Quem da equipe cuida deste cliente. `null` limpa. */
  responsibleMemberId: z.string().max(128).nullable().optional(),
  /** Parceiros externos (contatos vendedor ou arquiteto) que cuidam dele. */
  partnerContactIds: z.array(z.string().min(1).max(128)).max(MAX_PARTNER_CONTACTS).optional(),
  /** Tabela de preço do cliente. Ausente ou `null` = tabela padrão (o catálogo). */
  priceTableId: z.string().trim().min(1).max(128).nullable().optional(),
  source: z.string().max(50).trim().optional(),
  sourceId: z.string().max(100).trim().optional().nullable(),
  targetTenantId: z.string().max(100).optional(),
  ...ClientFiscalFields,
});

const UpdateClientSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().max(254).optional().or(z.literal("")),
  phone: z.string().max(30).trim().optional().or(z.literal("")),
  document: z.string().max(20).trim().optional().or(z.literal("")),
  address: z.string().max(500).trim().optional().or(z.literal("")),
  notes: z.string().max(2000).trim().optional().or(z.literal("")),
  types: z.array(z.string().max(50)).max(10).optional(),
  /** Comissao padrao do parceiro. `null` limpa; nunca 0 por omissao. */
  commissionPercentage: z.number().min(0).max(100).nullable().optional(),
  linkedMemberId: z.string().max(128).nullable().optional(),
  responsibleMemberId: z.string().max(128).nullable().optional(),
  partnerContactIds: z.array(z.string().min(1).max(128)).max(MAX_PARTNER_CONTACTS).optional(),
  priceTableId: z.string().trim().min(1).max(128).nullable().optional(),
  ...ClientFiscalFields,
});

/** Erro de tabela de preço do contato vira resposta; o resto sobe. */
function priceTableErrorResponse(res: Response, error: unknown) {
  if (!(error instanceof PriceTableError)) return null;
  return res
    .status(error.status)
    .json({ message: error.message, ...(error.code ? { code: error.code } : {}) });
}

/** Descarta chaves vazias para não gravar um endereço só de strings em branco. */
export function compactEnderecoFiscal(
  endereco: Record<string, string | undefined> | undefined,
): Record<string, string> | undefined {
  if (!endereco) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(endereco)) {
    const text = String(value ?? "").trim();
    if (!text) continue;
    out[key] = key === "uf" ? text.toUpperCase() : key === "cep" || key === "codigoIbge" ? text.replace(/\D/g, "") : text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Só os campos fiscais, para poder validá-los isoladamente nos testes. */
export const ClientFiscalFieldsSchema = z.object(ClientFiscalFields);

// Create Client
export const createClient = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;

    const parseResult = CreateClientSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Dados inválidos.";
      return res.status(400).json({ message: firstError });
    }
    const input = parseResult.data;

    // Sanitize text fields
    input.name = sanitizeText(input.name);
    if (input.address) input.address = sanitizeRichText(input.address);
    if (input.notes) input.notes = sanitizeRichText(input.notes);

    // Validate document (CPF/CNPJ) if provided
    if (input.document) {
      const digits = input.document.replace(/\D/g, "");
      const isValidDoc = digits.length === 11
        ? cpf.isValid(digits)
        : digits.length === 14
          ? cnpj.isValid(digits)
          : false;
      if (!isValidDoc) {
        return res.status(400).json({ code: "INVALID_DOCUMENT_FORMAT", message: "CPF ou CNPJ inválido." });
      }
    }

    const { userData, masterData, masterRef, isMaster, isSuperAdmin, tenantId } =
      await resolveUserAndTenant(userId, req.user);

    // Permission Check
    if (!isMaster && !isSuperAdmin) {
      const canCreate = await checkPermission(userId, "clients", "canCreate");
      if (!canCreate) {
        // Fallback check for consumers
        const canCreateLegacy = await checkPermission(
          userId,
          "customers",
          "canCreate"
        );
        if (!canCreateLegacy) {
          return res
            .status(403)
            .json({ message: "Sem permissão para criar clientes." });
        }
      }
    }

    // Super admin can specify target tenant
    const targetTenantId =
      input.targetTenantId && isSuperAdmin
        ? input.targetTenantId
        : tenantId ||
          masterData.companyId ||
          masterData.tenantId ||
          userData.companyId ||
          userData.tenantId;

    // Validate + audit super admin cross-tenant override
    if (isSuperAdmin && input.targetTenantId) {
      try {
        await assertTenantExists(input.targetTenantId);
      } catch {
        return res
          .status(400)
          .json({ message: "Empresa inválida ou inexistente." });
      }
      if (input.targetTenantId !== tenantId) {
        auditSuperAdminCrossTenantWrite({
          uid: userId,
          tenantId: input.targetTenantId,
          route: req.originalUrl || req.path,
          requestId: req.requestId,
        });
      }
    }

    if (!targetTenantId) {
      return res
        .status(400)
        .json({ message: "Configuração de conta inválida: tenantId ausente." });
    }

    // Adjust masterRef and masterData if Super Admin is acting on behalf of another tenant
    let targetMasterRef = masterRef;

    if (isSuperAdmin && targetTenantId && targetTenantId !== userData.tenantId) {
      console.log(`[CreateClient] SuperAdmin acting for targetTenantId: ${targetTenantId}`);
      
       // Find the owner of this tenant
       // Fetch a few users and find the one without masterId to ensure we get the owner.
       // avoiding orderBy createdAt because usage of an index that might not exist or be reliable finding the master first.
       const ownerQuery = await db.collection("users")
         .where("tenantId", "==", targetTenantId)
         .limit(10)
         .get();

      console.log(`[CreateClient] Owner query found ${ownerQuery.size} docs`);

       let ownerDoc = ownerQuery.docs.find(d => !d.data().masterId);
       if (!ownerDoc && !ownerQuery.empty) {
          // If all have masterId (unlikely for a valid tenant), try to find one with role MASTER/admin
          ownerDoc = ownerQuery.docs.find(d => ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role));
          if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
       }

       if (ownerDoc) {
          targetMasterRef = db.collection("users").doc(ownerDoc.id);
       }
    }

    // Teto de contatos pelo plano do TENANT, como os demais limites. Antes
    // lia `planId` do doc do usuario dono, que diverge do tenant quando uma
    // troca de plano so atualizou um dos dois (ver "Plano do tenant: DUAS
    // fontes" em apps/functions/CLAUDE.md), e contava um `usage.clients`
    // mantido a mao em vez dos documentos de fato.
    const clientsDecision = await enforceTenantPlanLimit({
      tenantId: targetTenantId,
      feature: "maxClients",
      loadCurrentUsage: () => getTenantClientsUsage(targetTenantId),
      uid: userId,
      requestId: req.requestId,
      route: req.path,
      isSuperAdmin,
    });
    if (!clientsDecision.allowed) {
      return res.status(clientsDecision.statusCode || 402).json({
        message:
          clientsDecision.message || "Limite de contatos atingido para o plano atual.",
        code: clientsDecision.code || "PLAN_LIMIT_EXCEEDED",
      });
    }

    // Ligar o contato a um membro (e o percentual de comissão dele) decide
    // quanto alguém recebe e o que ele vê em "Minhas comissões": é do dono e
    // dos administradores. Antes qualquer membro com Contatos se ligava a um
    // parceiro e passava a ler as comissões dele.
    if (
      !isMaster &&
      !isSuperAdmin &&
      (input.linkedMemberId || input.commissionPercentage != null)
    ) {
      return res.status(403).json({
        message: "Comissão e vínculo com a equipe são definidos pelo dono ou por um administrador.",
      });
    }
    // Ações finas de Contatos (catálogo de permissões): pôr outra pessoa como
    // responsável e escolher a tabela de preço.
    if (!isMaster && !isSuperAdmin) {
      if (
        input.responsibleMemberId &&
        input.responsibleMemberId !== userId &&
        !(await checkPermission(userId, "clients", "reassign"))
      ) {
        return res.status(403).json({ message: "Sem permissão para trocar o responsável pelo contato." });
      }
      if (input.priceTableId && !(await checkPermission(userId, "clients", "priceTable"))) {
        return res.status(403).json({ message: "Sem permissão para escolher a tabela de preço do contato." });
      }
    }

    if (input.linkedMemberId) {
      try {
        await validateMemberLink(
          targetTenantId,
          input.linkedMemberId,
          undefined,
          input.types || ["cliente"],
        );
      } catch (error) {
        const message = memberLinkErrorMessage(error);
        if (message) return res.status(400).json({ message });
        throw error;
      }
    }

    if (input.priceTableId) {
      try {
        await validateContactPriceTable(targetTenantId, input.priceTableId, input.types);
      } catch (error) {
        const response = priceTableErrorResponse(res, error);
        if (response) return response;
        throw error;
      }
    }

    let responsible: { id: string; name: string } | null = null;
    let partnerContactIds: string[] = [];
    try {
      if (input.responsibleMemberId) {
        responsible = await resolveResponsibleMember(targetTenantId, input.responsibleMemberId);
      }
      if (input.partnerContactIds?.length) {
        partnerContactIds = await resolvePartnerContactIds(targetTenantId, input.partnerContactIds);
      }
    } catch (error) {
      const message = contactResponsiblesErrorMessage(error);
      if (message) return res.status(400).json({ message });
      throw error;
    }

    // Transaction
    const clientId = await db.runTransaction(async (transaction) => {
      const companyRef = db.collection("companies").doc(targetTenantId);
      // const freshMasterSnap = await transaction.get(masterRef);
      const companySnap = await transaction.get(companyRef);

      // Re-check limit inside transaction
      // Note: Reuse logic or basic check? Basic check is safer.
      // We reuse the limit value from outer scope as it shouldn't change rapidly, but logic is duplicated.
      // Ideally calculate limit again but let's trust the outer check + fresh usage.

      // Getting maxClients again is tricky without refetching plan.
      // We'll skip strict double-check of plan, but check usage count.
      // If strictly needed, we'd refetch plain. For performance, we assume plan hasn't changed in ms.
      // But we need the number.
      // Simplified: If usage suggests overflow, block.
      // ... omitting strict intra-transaction plan fetch for speed, relying on outer check.

      const newClientRef = db.collection("clients").doc();
      const now = Timestamp.now();

      const clientData: Record<string, unknown> = {
        tenantId: targetTenantId,
        name: input.name.trim(),
        types: input.types || ["cliente"],
        source: input.source || "manual",
        sourceId: input.sourceId || null,
        // Indexed search tokens (array-contains as-you-type search)
        searchTokens: buildClientSearchTokens(input.name, input.email, input.phone),
        createdAt: now,
        updatedAt: now,
      };

      if (input.email) clientData.email = input.email.toLowerCase().trim();
      if (input.phone) clientData.phone = input.phone;
      if (input.document) clientData.document = input.document.replace(/\D/g, "");
      if (input.address) clientData.address = input.address;
      if (input.notes) clientData.notes = input.notes;
      if (input.commissionPercentage != null)
        clientData.commissionPercentage = input.commissionPercentage;
      if (input.linkedMemberId) clientData.linkedMemberId = input.linkedMemberId;
      if (responsible) {
        clientData.responsibleMemberId = responsible.id;
        clientData.responsibleMemberName = responsible.name;
      }
      if (partnerContactIds.length > 0) clientData.partnerContactIds = partnerContactIds;
      if (input.priceTableId) clientData.priceTableId = input.priceTableId;

      const enderecoFiscal = compactEnderecoFiscal(input.enderecoFiscal);
      if (enderecoFiscal) clientData.enderecoFiscal = enderecoFiscal;
      if (input.inscricaoEstadual) clientData.inscricaoEstadual = input.inscricaoEstadual;
      if (input.indicadorIe) clientData.indicadorIe = input.indicadorIe;
      if (input.consumidorFinal !== undefined) {
        clientData.consumidorFinal = input.consumidorFinal;
      }
      const fiscalDefaults = compactFiscalDefaults(input.fiscalDefaults);
      if (fiscalDefaults) clientData.fiscalDefaults = fiscalDefaults;

      transaction.set(newClientRef, clientData);

      transaction.update(targetMasterRef, {
        "usage.clients": FieldValue.increment(1),
        updatedAt: now,
      });

      if (companySnap.exists) {
        transaction.update(companyRef, {
          "usage.clients": FieldValue.increment(1),
          updatedAt: now,
        });
      }

      return newClientRef.id;
    });

    return res.status(201).json({
      success: true,
      clientId,
      message: "Cliente criado com sucesso!",
    });
  } catch (error: unknown) {
    console.error("createClient Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao criar cliente.";
    return res.status(500).json({ message });
  }
};

// Update Client
export const updateClient = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id)
      return res.status(400).json({ message: "ID do cliente inválido." });

    const parseResult = UpdateClientSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Dados inválidos.";
      return res.status(400).json({ message: firstError });
    }
    const updateData = parseResult.data;

    // Sanitize text fields
    if (updateData.name) updateData.name = sanitizeText(updateData.name);
    if (updateData.address) updateData.address = sanitizeRichText(updateData.address);
    if (updateData.notes) updateData.notes = sanitizeRichText(updateData.notes);

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user
    );

    const clientRef = db.collection("clients").doc(id);
    const clientSnap = await clientRef.get();

    if (!clientSnap.exists) {
      return res.status(404).json({ message: "Cliente não encontrado." });
    }

    const clientData = clientSnap.data();

    if (!isSuperAdmin && clientData?.tenantId !== tenantId) {
      return res
        .status(403)
        .json({ message: "Este cliente não pertence a sua organização." });
    }

    if (!isMaster && !isSuperAdmin) {
      const canEdit = await checkPermission(userId, "clients", "canEdit");
      const canEditLegacy = await checkPermission(
        userId,
        "customers",
        "canEdit"
      );
      if (!canEdit && !canEditLegacy) {
        return res
          .status(403)
          .json({ message: "Sem permissão para editar clientes." });
      }
    }

    // Mesma regra da criação: comissão e vínculo com a equipe são do dono e
    // dos administradores. O formulário reenvia os campos, então vale a
    // mudança de valor, não a presença.
    if (!isMaster && !isSuperAdmin) {
      const linkChanged =
        updateData.linkedMemberId !== undefined &&
        (updateData.linkedMemberId || null) !== ((clientData?.linkedMemberId as string | undefined) || null);
      const commissionChanged =
        updateData.commissionPercentage !== undefined &&
        (updateData.commissionPercentage ?? null) !==
          ((clientData?.commissionPercentage as number | undefined) ?? null);
      if (linkChanged || commissionChanged) {
        return res.status(403).json({
          message: "Comissão e vínculo com a equipe são definidos pelo dono ou por um administrador.",
        });
      }
      const idsKey = (value: unknown) => (Array.isArray(value) ? value.map(String) : []).sort().join("|");
      const responsibleChanged =
        (updateData.responsibleMemberId !== undefined &&
          (updateData.responsibleMemberId || null) !==
            ((clientData?.responsibleMemberId as string | undefined) || null)) ||
        (updateData.partnerContactIds !== undefined &&
          idsKey(updateData.partnerContactIds) !== idsKey(clientData?.partnerContactIds));
      if (responsibleChanged && !(await checkPermission(userId, "clients", "reassign"))) {
        return res.status(403).json({ message: "Sem permissão para trocar o responsável pelo contato." });
      }
      const priceTableChanged =
        updateData.priceTableId !== undefined &&
        (updateData.priceTableId || null) !== ((clientData?.priceTableId as string | undefined) || null);
      if (priceTableChanged && !(await checkPermission(userId, "clients", "priceTable"))) {
        return res.status(403).json({ message: "Sem permissão para escolher a tabela de preço do contato." });
      }
    }

    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.email !== undefined) safeUpdate.email = updateData.email;
    if (updateData.phone !== undefined) safeUpdate.phone = updateData.phone;
    if (updateData.document !== undefined) {
      if (updateData.document === "") {
        safeUpdate.document = "";
      } else {
        const digits = updateData.document.replace(/\D/g, "");
        const isValidDoc = digits.length === 11
          ? cpf.isValid(digits)
          : digits.length === 14
            ? cnpj.isValid(digits)
            : false;
        if (!isValidDoc) {
          return res.status(400).json({ code: "INVALID_DOCUMENT_FORMAT", message: "CPF ou CNPJ inválido." });
        }
        safeUpdate.document = digits;
      }
    }
    if (updateData.address !== undefined)
      safeUpdate.address = updateData.address;
    if (updateData.notes !== undefined) safeUpdate.notes = updateData.notes;
    if (updateData.types !== undefined) safeUpdate.types = updateData.types;
    if (updateData.commissionPercentage !== undefined) {
      safeUpdate.commissionPercentage =
        updateData.commissionPercentage ?? FieldValue.delete();
    }
    if (updateData.linkedMemberId !== undefined) {
      if (updateData.linkedMemberId) {
        try {
          await validateMemberLink(
            String(clientData?.tenantId ?? tenantId),
            updateData.linkedMemberId,
            id,
            updateData.types ?? (clientData?.types as string[] | undefined) ?? ["cliente"],
          );
        } catch (error) {
          const message = memberLinkErrorMessage(error);
          if (message) return res.status(400).json({ message });
          throw error;
        }
        safeUpdate.linkedMemberId = updateData.linkedMemberId;
      } else {
        safeUpdate.linkedMemberId = FieldValue.delete();
      }
    } else if (
      updateData.types !== undefined &&
      !updateData.types.some((type: string) => type === "vendedor" || type === "arquiteto")
    ) {
      // Deixou de ser parceiro de comissão: o vínculo com o membro não vale mais.
      safeUpdate.linkedMemberId = FieldValue.delete();
    }

    try {
      const contactTenantId = String(clientData?.tenantId ?? tenantId);
      if (updateData.responsibleMemberId !== undefined) {
        if (updateData.responsibleMemberId) {
          const person = await resolveResponsibleMember(contactTenantId, updateData.responsibleMemberId);
          safeUpdate.responsibleMemberId = person.id;
          safeUpdate.responsibleMemberName = person.name;
        } else {
          safeUpdate.responsibleMemberId = FieldValue.delete();
          safeUpdate.responsibleMemberName = FieldValue.delete();
        }
      }
      if (updateData.partnerContactIds !== undefined) {
        const partners = await resolvePartnerContactIds(
          contactTenantId,
          updateData.partnerContactIds,
          id,
        );
        safeUpdate.partnerContactIds = partners.length > 0 ? partners : FieldValue.delete();
      }
    } catch (error) {
      const message = contactResponsiblesErrorMessage(error);
      if (message) return res.status(400).json({ message });
      throw error;
    }

    if (updateData.priceTableId !== undefined) {
      if (updateData.priceTableId) {
        try {
          await validateContactPriceTable(
            String(clientData?.tenantId ?? tenantId),
            updateData.priceTableId,
            updateData.types ?? (clientData?.types as string[] | undefined),
          );
        } catch (error) {
          const response = priceTableErrorResponse(res, error);
          if (response) return response;
          throw error;
        }
        safeUpdate.priceTableId = updateData.priceTableId;
      } else {
        safeUpdate.priceTableId = FieldValue.delete();
      }
    } else if (updateData.types !== undefined && !isPriceTableContact(updateData.types)) {
      // Deixou de ser cliente: a tabela de preço não vale mais.
      safeUpdate.priceTableId = FieldValue.delete();
    }

    if (updateData.enderecoFiscal !== undefined) {
      // `null` apaga o endereço inteiro; um objeto só com campos vazios também.
      safeUpdate.enderecoFiscal =
        compactEnderecoFiscal(updateData.enderecoFiscal) ?? FieldValue.delete();
    }
    if (updateData.inscricaoEstadual !== undefined) {
      safeUpdate.inscricaoEstadual = updateData.inscricaoEstadual;
    }
    if (updateData.indicadorIe !== undefined) {
      safeUpdate.indicadorIe = updateData.indicadorIe;
    }
    if (updateData.consumidorFinal !== undefined) {
      safeUpdate.consumidorFinal = updateData.consumidorFinal;
    }
    if (updateData.fiscalDefaults !== undefined) {
      safeUpdate.fiscalDefaults =
        compactFiscalDefaults(updateData.fiscalDefaults) ?? FieldValue.delete();
    }

    // Keep indexed search tokens in sync when name/email/phone change
    if (
      updateData.name !== undefined ||
      updateData.email !== undefined ||
      updateData.phone !== undefined
    ) {
      safeUpdate.searchTokens = buildClientSearchTokens(
        updateData.name !== undefined ? updateData.name : clientData?.name,
        updateData.email !== undefined ? updateData.email : clientData?.email,
        updateData.phone !== undefined ? updateData.phone : clientData?.phone,
      );
    }

    await clientRef.update(safeUpdate);

    return res.json({
      success: true,
      message: "Cliente atualizado com sucesso.",
    });
  } catch (error: unknown) {
    console.error("updateClient Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar cliente.";
    return res.status(500).json({ message });
  }
};

// Delete Client
export const deleteClient = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id)
      return res.status(400).json({ message: "ID do cliente obrigatório." });

    const { tenantId, isMaster, isSuperAdmin, masterRef } =
      await resolveUserAndTenant(userId, req.user);

    const clientRef = db.collection("clients").doc(id);
    const clientSnap = await clientRef.get();

    if (!clientSnap.exists) {
      return res.status(404).json({ message: "Cliente não encontrado." });
    }

    const clientData = clientSnap.data();

    if (!isSuperAdmin && clientData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    if (!isMaster && !isSuperAdmin) {
      const canDelete = await checkPermission(userId, "clients", "canDelete");
      const canDeleteLegacy = await checkPermission(
        userId,
        "customers",
        "canDelete"
      );
      if (!canDelete && !canDeleteLegacy) {
        return res
          .status(403)
          .json({ message: "Sem permissão para deletar clientes." });
      }
    }

    // Contato que está numa proposta não se exclui: a proposta ficaria sem
    // cliente. A tela já conferia; o backend passa a conferir também, porque
    // a API (e a Lia) não passam pela tela.
    if (await isClientUsed(String(clientData?.tenantId || tenantId), id)) {
      return res.status(409).json({
        code: "CLIENT_IN_USE",
        message: "Este contato está em uma proposta e não pode ser excluído.",
      });
    }

    // Determine correct masterRef for usage decrement
    let targetMasterRef = masterRef;
    
    // If Super Admin deleting a client from another tenant, find that tenant's owner
    if (isSuperAdmin && clientData?.tenantId && clientData.tenantId !== tenantId) {
       const ownerQuery = await db.collection("users")
         .where("tenantId", "==", clientData.tenantId)
         .limit(10)
         .get();
         
       let ownerDoc = ownerQuery.docs.find(d => !d.data().masterId);
       if (!ownerDoc && !ownerQuery.empty) {
         ownerDoc = ownerQuery.docs.find(d => ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role));
         if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
       }
       
       if (ownerDoc) {
         targetMasterRef = db.collection("users").doc(ownerDoc.id);
       }
    }

    await db.runTransaction(async (transaction) => {
      const companyRef = db.collection("companies").doc(clientData?.tenantId || tenantId);
      const companySnap = await transaction.get(companyRef);

      transaction.delete(clientRef);

      transaction.update(targetMasterRef, {
        "usage.clients": FieldValue.increment(-1),
        updatedAt: Timestamp.now(),
      });

      if (companySnap.exists) {
        transaction.update(companyRef, {
          "usage.clients": FieldValue.increment(-1),
          updatedAt: Timestamp.now(),
        });
      }
    });

    return res.json({ success: true, message: "Cliente removido." });
  } catch (error: unknown) {
    console.error("deleteClient Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao deletar cliente.";
    return res.status(500).json({ message });
  }
};
