import { Request, Response } from "express";
import { SharedProposalService } from "../services/shared-proposal.service";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { db } from "../../init";

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

    // Validar acesso (proposta deve pertencer ao tenant do usuário)
    if (!isSuperAdmin && proposalData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    // Gerar link compartilhável
    const result = await SharedProposalService.createShareLink(
      proposalId,
      proposalData?.tenantId || tenantId,
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

    const proposalData = proposalSnap.data();

    // Buscar dados do tenant para branding
    const tenantRef = db.collection("tenants").doc(sharedProposal.tenantId);
    const tenantSnap = await tenantRef.get();
    const tenantData = tenantSnap.exists ? tenantSnap.data() : null;

    // Registrar visualização
    const viewerData = {
      ip: req.ip || (req.headers["x-forwarded-for"] as string),
      userAgent: req.headers["user-agent"],
    };

    // Registrar visualização em background (não bloqueia resposta)
    SharedProposalService.recordView(
      sharedProposal.id,
      sharedProposal.tenantId,
      sharedProposal.proposalId,
      viewerData,
    ).catch((err) => console.error("Error recording view:", err));

    // Retornar dados da proposta
    return res.status(200).json({
      success: true,
      proposal: {
        id: proposalSnap.id,
        ...proposalData,
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
