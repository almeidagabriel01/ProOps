import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { NotificationService } from "./notification.service";

/**
 * Interface para Proposta Compartilhada
 */
export interface SharedProposal {
  id: string;
  proposalId: string;
  tenantId: string;
  token: string;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  viewedAt?: string;
  viewerInfo?: ViewerInfo[];
}

export interface ViewerInfo {
  ip?: string;
  userAgent?: string;
  timestamp: string;
}

export interface ShareLinkResponse {
  shareUrl: string;
  token: string;
  expiresAt: string;
}

/**
 * Service para gerenciar links compartilháveis de propostas
 */
export class SharedProposalService {
  private static COLLECTION = "shared_proposals";
  private static EXPIRATION_DAYS = 30;

  /**
   * Cria um link compartilhável para uma proposta
   */
  static async createShareLink(
    proposalId: string,
    tenantId: string,
    userId: string,
  ): Promise<ShareLinkResponse> {
    try {
      // Gerar token único UUID v4
      const token = uuidv4();

      // Calcular data de expiração (30 dias)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.EXPIRATION_DAYS);

      // Criar documento no Firestore
      const sharedProposal: Omit<SharedProposal, "id"> = {
        proposalId,
        tenantId,
        token,
        createdAt: new Date().toISOString(),
        createdBy: userId,
        expiresAt: expiresAt.toISOString(),
        viewerInfo: [],
      };

      await db.collection(this.COLLECTION).add(sharedProposal);

      // Construir URL compartilhável
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        "http://localhost:3000";
      const shareUrl = `${baseUrl}/share/${token}`;

      return {
        shareUrl,
        token,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      console.error("Error creating share link:", error);
      throw new Error("Failed to create share link");
    }
  }

  /**
   * Busca uma proposta compartilhada por token
   */
  static async getSharedProposal(
    token: string,
  ): Promise<SharedProposal | null> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where("token", "==", token)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data() as Omit<SharedProposal, "id">;

      // Verificar expiração
      const expiresAt = new Date(data.expiresAt);
      if (expiresAt < new Date()) {
        throw new Error("EXPIRED_LINK");
      }

      return {
        id: doc.id,
        ...data,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "EXPIRED_LINK") {
        throw error;
      }
      console.error("Error getting shared proposal:", error);
      throw new Error("Failed to get shared proposal");
    }
  }

  /**
   * Registra a visualização de uma proposta compartilhada
   */
  static async recordView(
    sharedProposalId: string,
    tenantId: string,
    proposalId: string,
    viewerData: {
      ip?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    try {
      const viewerInfo: ViewerInfo = {
        ip: this.anonymizeIP(viewerData.ip),
        userAgent: this.sanitizeUserAgent(viewerData.userAgent),
        timestamp: new Date().toISOString(),
      };

      // Atualizar documento com informação de visualização
      const docRef = db.collection(this.COLLECTION).doc(sharedProposalId);
      await docRef.update({
        viewedAt: new Date().toISOString(),
        viewerInfo: FieldValue.arrayUnion(viewerInfo),
      });

      // Buscar informações da proposta para criar notificação
      const proposalDoc = await db
        .collection("proposals")
        .doc(proposalId)
        .get();

      if (proposalDoc.exists) {
        const proposalData = proposalDoc.data();
        const proposalTitle = proposalData?.title || "Proposta sem título";

        // Criar notificação para o admin
        await NotificationService.createNotification({
          tenantId,
          type: "proposal_viewed",
          title: "Proposta Visualizada",
          message: `A proposta "${proposalTitle}" foi visualizada por um cliente`,
          proposalId,
          sharedProposalId,
        });
      }
    } catch (error) {
      console.error("Error recording view:", error);
      // Não lançar erro para não bloquear visualização do PDF
    }
  }

  /**
   * Anonimiza IP para compliance com LGPD
   * Remove os últimos octetos do IPv4
   */
  private static anonymizeIP(ip?: string): string | undefined {
    if (!ip) return undefined;

    // IPv4: manter apenas os 2 primeiros octetos
    const ipv4Match = ip.match(/^(\d+\.\d+)\.\d+\.\d+$/);
    if (ipv4Match) {
      return `${ipv4Match[1]}.XXX.XXX`;
    }

    // IPv6: manter apenas prefixo
    if (ip.includes(":")) {
      const parts = ip.split(":");
      return `${parts[0]}:${parts[1]}:XXXX:XXXX`;
    }

    return "XXX.XXX.XXX.XXX";
  }

  /**
   * Sanitiza user-agent para guardar apenas informações essenciais
   */
  private static sanitizeUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    // Extrair apenas browser e OS básico (remover versões específicas)
    const simplified = userAgent
      .replace(/\(.*?\)/g, "") // Remove conteúdo entre parênteses
      .replace(/\d+\.\d+(\.\d+)*/g, "") // Remove versões numéricas
      .trim();

    return simplified.substring(0, 100); // Limitar tamanho
  }
}
