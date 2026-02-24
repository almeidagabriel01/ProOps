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
  title?: string;
  products?: ProductLike[];
  [key: string]: unknown;
};

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

  for (const idsChunk of chunks) {
    const catalogSnap = await db
      .collection("products")
      .where("tenantId", "==", tenantId)
      .where(FieldPath.documentId(), "in", idsChunk)
      .get();

    catalogSnap.docs.forEach((docSnap) => {
      productCatalogMap.set(docSnap.id, docSnap.data() as Record<string, unknown>);
    });
  }

  const enrichedProducts = visibleProducts.map((product) => {
    const catalogProduct = product.productId
      ? productCatalogMap.get(product.productId)
      : undefined;

    if (!catalogProduct) {
      return product;
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

    return {
      ...product,
      productImage: mergedImage,
      productImages: mergedImages,
      productDescription:
        (typeof catalogProduct.description === "string"
          ? catalogProduct.description
          : "") || product.productDescription || "",
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

    // Buscar dados da proposta
    const proposalRef = db
      .collection("proposals")
      .doc(sharedProposal.proposalId);
    const proposalSnap = await proposalRef.get();

    if (!proposalSnap.exists) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    const proposalData = proposalSnap.data() as ProposalLike | undefined;
    if (String((proposalData as Record<string, unknown> | undefined)?.tenantId || "").trim() !== sharedProposal.tenantId) {
      return res.status(404).json({ message: "Proposta nÃ£o encontrada" });
    }
    const enrichedProposalData = await enrichSharedProposalProducts(
      proposalData,
      sharedProposal.tenantId,
    );

    // Buscar dados do tenant para branding
    const tenantRef = db.collection("tenants").doc(sharedProposal.tenantId);
    const tenantSnap = await tenantRef.get();
    const tenantData = tenantSnap.exists ? tenantSnap.data() : null;

    // Registrar visualização
    const viewerData = {
      ip: req.ip || (req.headers["x-forwarded-for"] as string),
      userAgent: req.headers["user-agent"],
    };

    // Registrar visualização antes da resposta para evitar perda em ambiente serverless
    await SharedProposalService.recordView(
      sharedProposal.id,
      sharedProposal.tenantId,
      sharedProposal.proposalId,
      viewerData,
      enrichedProposalData?.title,
    );

    // Retornar dados da proposta
    return res.status(200).json({
      success: true,
      proposal: {
        id: proposalSnap.id,
        ...enrichedProposalData,
      },
      tenant: tenantData
        ? {
            id: sharedProposal.tenantId,
            name: tenantData.name,
            logoUrl: tenantData.logoUrl,
            primaryColor: tenantData.primaryColor,
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
