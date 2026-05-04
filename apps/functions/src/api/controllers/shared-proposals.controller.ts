import { Request, Response } from "express";
import { SharedProposalService } from "../services/shared-proposal.service";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { db } from "../../init";
import { FieldPath } from "firebase-admin/firestore";

type ProductLike = {
  productId?: string;
  quantity?: number;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  _isGhost?: boolean;
  _shouldHide?: boolean;
  [key: string]: unknown;
};

type ProposalLike = {
  tenantId?: string;
  status?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  validUntil?: string;
  title?: string;
  sistemas?: unknown[];
  products?: ProductLike[];
  sections?: unknown[];
  discount?: number;
  totalValue?: number;
  extraExpense?: number;
  customNotes?: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  pdfSettings?: unknown;
  pdf?: unknown;
  attachments?: unknown[];
  downPaymentEnabled?: boolean;
  downPaymentType?: string;
  downPaymentPercentage?: number;
  downPaymentValue?: number;
  downPaymentDueDate?: string;
  downPaymentMethod?: string;
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  firstInstallmentDate?: string;
  installmentsPaymentMethod?: string;
  paymentMethod?: string;
  [key: string]: unknown;
};

const SHARED_PROPOSAL_ALLOWED_FIELDS = [
  "tenantId",
  "status",
  "clientId",
  "clientName",
  "clientEmail",
  "clientPhone",
  "clientAddress",
  "validUntil",
  "title",
  "sistemas",
  "products",
  "sections",
  "discount",
  "totalValue",
  "closedValue",
  "extraExpense",
  "customNotes",
  "notes",
  "createdAt",
  "updatedAt",
  "pdfSettings",
  "pdf",
  "attachments",
  "downPaymentEnabled",
  "downPaymentType",
  "downPaymentPercentage",
  "downPaymentValue",
  "downPaymentDueDate",
  "downPaymentMethod",
  "installmentsEnabled",
  "installmentsCount",
  "installmentValue",
  "firstInstallmentDate",
  "installmentsPaymentMethod",
  "paymentMethod",
] as const;

function sanitizeSharedProposalPayload(
  proposalId: string,
  proposalData: ProposalLike | undefined,
): Record<string, unknown> {
  const safe: Record<string, unknown> = { id: proposalId };
  const source = proposalData || {};
  SHARED_PROPOSAL_ALLOWED_FIELDS.forEach((field) => {
    if (typeof source[field] !== "undefined") {
      safe[field] = source[field];
    }
  });

  // Remover storagePath interno dos attachments — dado de infraestrutura nunca
  // deve ser exposto em rotas públicas (evita enumeração de paths no Storage).
  if (Array.isArray(safe.attachments)) {
    safe.attachments = (safe.attachments as Array<Record<string, unknown>>).map(
      ({ storagePath: _storagePath, ...publicFields }) => publicFields,
    );
  }

  // Remover o campo pdf inteiro (contém storagePath e versionHash internos).
  // O cliente público não precisa de metadados de cache do PDF.
  delete safe.pdf;

  return safe;
}

function extractImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (
        item &&
        typeof item === "object" &&
        "url" in (item as Record<string, unknown>) &&
        typeof (item as Record<string, unknown>).url === "string"
      ) {
        return String((item as Record<string, unknown>).url).trim();
      }
      return "";
    })
    .filter(Boolean);
}

function chunkArray<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += chunkSize) {
    chunks.push(values.slice(i, i + chunkSize));
  }
  return chunks;
}

function normalizeSharedProduct(product: ProductLike): ProductLike {
  const quantity = Number(product.quantity || 0);
  const normalizedImages = extractImageUrls(product.productImages);
  const fallbackImage = product.productImage || normalizedImages[0] || "";
  const isGhost = quantity <= 0;

  return {
    ...product,
    quantity,
    productImage: fallbackImage,
    productImages:
      normalizedImages.length > 0
        ? normalizedImages
        : fallbackImage
          ? [fallbackImage]
          : [],
    _isGhost: isGhost,
    _shouldHide: Boolean(product._shouldHide || isGhost),
  };
}

async function enrichSharedProposalProducts(
  proposalData: ProposalLike | undefined,
  tenantId: string,
): Promise<ProposalLike | undefined> {
  if (!proposalData) return proposalData;

  const normalizedProducts = (proposalData.products || []).map((product) =>
    normalizeSharedProduct(product),
  );

  const visibleProducts = normalizedProducts.filter(
    (product) => Number(product.quantity || 0) > 0,
  );

  if (visibleProducts.length === 0) {
    return {
      ...proposalData,
      products: [],
    };
  }

  const productIds = Array.from(
    new Set(
      visibleProducts
        .map((product) => product.productId)
        .filter((productId): productId is string => Boolean(productId)),
    ),
  );

  if (!tenantId || productIds.length === 0) {
    return {
      ...proposalData,
      products: visibleProducts,
    };
  }

  const productCatalogMap = new Map<string, Record<string, unknown>>();
  const chunks = chunkArray(productIds, 10);

  // Parallel chunk queries: all chunks are independent reads
  await Promise.all(
    chunks.map(async (idsChunk) => {
      const catalogSnap = await db
        .collection("products")
        .where("tenantId", "==", tenantId)
        .where(FieldPath.documentId(), "in", idsChunk)
        .get();

      catalogSnap.docs.forEach((docSnap) => {
        productCatalogMap.set(
          docSnap.id,
          docSnap.data() as Record<string, unknown>,
        );
      });
    }),
  );

  const enrichedProducts = visibleProducts.map((product) => {
    const catalogProduct = product.productId
      ? productCatalogMap.get(product.productId)
      : undefined;

    if (!catalogProduct) {
      const isInactive = product.status === "inactive";
      return {
        ...product,
        _isInactive: isInactive,
        _shouldHide: Boolean(
          product._shouldHide || product._isGhost || isInactive,
        ),
      };
    }

    const catalogImages = extractImageUrls(catalogProduct.images);
    const catalogImage =
      typeof catalogProduct.image === "string" ? catalogProduct.image : "";

    const mergedImages =
      catalogImages.length > 0
        ? catalogImages
        : catalogImage
          ? [catalogImage]
          : product.productImages || [];
    const mergedImage = mergedImages[0] || product.productImage || "";

    const status =
      (catalogProduct.status as string) || (product.status as string);
    const isInactive = status === "inactive";

    return {
      ...product,
      productImage: mergedImage,
      productImages: mergedImages,
      productDescription:
        (typeof catalogProduct.description === "string"
          ? catalogProduct.description
          : "") ||
        product.productDescription ||
        "",
      _isInactive: isInactive,
      _shouldHide: Boolean(
        product._shouldHide || product._isGhost || isInactive,
      ),
    };
  });

  return {
    ...proposalData,
    products: enrichedProducts,
  };
}

/**
 * POST /v1/proposals/:id/share-link
 * Gera um link compartilhável para uma proposta
 */
export const createShareLink = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id: proposalId } = req.params;

    if (!proposalId) {
      return res.status(400).json({ message: "ID da proposta é obrigatório" });
    }

    // Resolver tenant do usuário
    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user,
    );

    // Buscar proposta
    const proposalRef = db.collection("proposals").doc(proposalId);
    const proposalSnap = await proposalRef.get();

    if (!proposalSnap.exists) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    const proposalData = proposalSnap.data();
    const proposalTenantId = String(proposalData?.tenantId || "").trim();
    if (!proposalTenantId) {
      return res.status(412).json({ message: "Proposta sem tenantId válido" });
    }

    // Validar acesso (proposta deve pertencer ao tenant do usuário)
    if (!isSuperAdmin && proposalData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    // Gerar link compartilhável
    const result = await SharedProposalService.createShareLink(
      proposalId,
      proposalTenantId,
      userId,
    );

    return res.status(201).json({
      success: true,
      ...result,
      message: "Link compartilhável gerado com sucesso",
    });
  } catch (error) {
    console.error("Error creating share link:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao gerar link";
    return res.status(500).json({ message });
  }
};

/**
 * GET /v1/share/:token
 * Acessa uma proposta via link público (sem autenticação)
 */
export const getSharedProposal = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: "Token inválido" });
    }

    // Buscar proposta compartilhada
    const sharedProposal = await SharedProposalService.getSharedProposal(token);

    if (!sharedProposal) {
      return res
        .status(404)
        .json({ message: "Link não encontrado ou inválido" });
    }

    // Purpose is kept in the DB for logging/auditing but no longer gates access.
    // The token itself is short-lived and purpose-scoped, which is sufficient.

    // Parallel fetch: proposal and tenant are independent reads
    const proposalRef = db
      .collection("proposals")
      .doc(sharedProposal.proposalId);
    const tenantRef = db.collection("tenants").doc(sharedProposal.tenantId);

    const [proposalSnap, tenantSnap] = await Promise.all([
      proposalRef.get(),
      tenantRef.get(),
    ]);

    if (!proposalSnap.exists) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    const proposalData = proposalSnap.data() as ProposalLike | undefined;
    if (
      String(
        (proposalData as Record<string, unknown> | undefined)?.tenantId || "",
      ).trim() !== sharedProposal.tenantId
    ) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }
    const enrichedProposalData = await enrichSharedProposalProducts(
      proposalData,
      sharedProposal.tenantId,
    );

    const tenantData = tenantSnap.exists ? tenantSnap.data() : null;

    // Skip view recording for PDF generation requests (automated Puppeteer)
    const isPdfGeneratorRequest = req.headers["x-pdf-generator"] === "true";
    if (!isPdfGeneratorRequest) {
      const viewerData = {
        ip: req.ip || (req.headers["x-forwarded-for"] as string),
        userAgent: req.headers["user-agent"],
      };
      void SharedProposalService.recordView(
        sharedProposal.id,
        sharedProposal.tenantId,
        sharedProposal.proposalId,
        viewerData,
        enrichedProposalData?.title,
      ).catch((err) => console.error("recordView failed (non-critical)", err));
    }

    // Retornar dados da proposta
    return res.status(200).json({
      success: true,
      proposal: sanitizeSharedProposalPayload(
        proposalSnap.id,
        enrichedProposalData,
      ),
      tenant: tenantData
        ? {
            id: sharedProposal.tenantId,
            name: tenantData.name,
            logoUrl: tenantData.logoUrl,
            primaryColor: tenantData.primaryColor,
            niche: (tenantData as { niche?: string }).niche,
          }
        : null,
    });
  } catch (error) {
    console.error("Error getting shared proposal:", error);

    if (error instanceof Error && error.message === "EXPIRED_LINK") {
      return res.status(410).json({
        message: "Este link expirou. Solicite um novo link ao responsável.",
        code: "EXPIRED_LINK",
      });
    }

    const message =
      error instanceof Error ? error.message : "Erro ao carregar proposta";
    return res.status(500).json({ message });
  }
};



