import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { NotificationService } from "./notification.service";

const SHARED_PROPOSALS_COLLECTION = "shared_proposals";
const SHARED_LINK_EXPIRATION_DAYS = 30;
const DEFAULT_PROPOSAL_TITLE = "Proposta sem t\u00edtulo";

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

export class SharedProposalService {
  private static getBaseAppUrl(): string {
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

    if (configuredUrl) {
      return configuredUrl;
    }

    return process.env.NODE_ENV === "production"
      ? "https://proops.com.br/"
      : "http://localhost:3000/";
  }

  private static getExpirationDate(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SHARED_LINK_EXPIRATION_DAYS);
    return expiresAt;
  }

  private static buildShareUrl(token: string): string {
    return new URL(`/share/${token}`, this.getBaseAppUrl()).toString();
  }

  private static assertNotExpired(expiresAtIso: string): void {
    const expiresAt = new Date(expiresAtIso);
    if (expiresAt < new Date()) {
      throw new Error("EXPIRED_LINK");
    }
  }

  private static async resolveProposalInfo(
    proposalId: string,
    proposalTitle?: string,
    tenantId?: string,
  ): Promise<{ proposalTitle: string; tenantId?: string }> {
    let resolvedProposalTitle = proposalTitle;
    let resolvedTenantId = tenantId;

    if (!resolvedProposalTitle || !resolvedTenantId) {
      const proposalDoc = await db.collection("proposals").doc(proposalId).get();
      if (proposalDoc.exists) {
        const proposalData = proposalDoc.data();
        resolvedProposalTitle =
          resolvedProposalTitle || proposalData?.title || DEFAULT_PROPOSAL_TITLE;
        resolvedTenantId = resolvedTenantId || proposalData?.tenantId;
      }
    }

    return {
      proposalTitle: resolvedProposalTitle || DEFAULT_PROPOSAL_TITLE,
      tenantId: resolvedTenantId,
    };
  }

  static async createShareLink(
    proposalId: string,
    tenantId: string,
    userId: string,
  ): Promise<ShareLinkResponse> {
    try {
      const token = uuidv4();
      const expiresAt = this.getExpirationDate();

      const sharedProposal: Omit<SharedProposal, "id"> = {
        proposalId,
        tenantId,
        token,
        createdAt: new Date().toISOString(),
        createdBy: userId,
        expiresAt: expiresAt.toISOString(),
        viewerInfo: [],
      };

      await db.collection(SHARED_PROPOSALS_COLLECTION).add(sharedProposal);

      return {
        shareUrl: this.buildShareUrl(token),
        token,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      console.error("Error creating share link:", error);
      throw new Error("Failed to create share link");
    }
  }

  static async getSharedProposal(token: string): Promise<SharedProposal | null> {
    try {
      const snapshot = await db
        .collection(SHARED_PROPOSALS_COLLECTION)
        .where("token", "==", token)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data() as Omit<SharedProposal, "id">;
      this.assertNotExpired(data.expiresAt);

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

  static async recordView(
    sharedProposalId: string,
    tenantId: string,
    proposalId: string,
    viewerData: {
      ip?: string;
      userAgent?: string;
    },
    proposalTitle?: string,
  ): Promise<void> {
    try {
      const viewerInfo: ViewerInfo = {
        ip: this.anonymizeIP(viewerData.ip),
        userAgent: this.sanitizeUserAgent(viewerData.userAgent),
        timestamp: new Date().toISOString(),
      };

      const docRef = db.collection(SHARED_PROPOSALS_COLLECTION).doc(sharedProposalId);
      const resolved = await this.resolveProposalInfo(proposalId, proposalTitle, tenantId);

      if (!resolved.tenantId) {
        console.error("Error recording view: missing tenantId for notification", {
          sharedProposalId,
          proposalId,
        });
        return;
      }

      await Promise.all([
        docRef.update({
          viewedAt: new Date().toISOString(),
          viewerInfo: FieldValue.arrayUnion(viewerInfo),
        }),
        NotificationService.createNotification({
          tenantId: resolved.tenantId,
          type: "proposal_viewed",
          title: "Proposta Visualizada",
          message: `A proposta "${resolved.proposalTitle}" foi visualizada por um cliente`,
          proposalId,
          sharedProposalId,
        }),
      ]);
    } catch (error) {
      console.error("Error recording view:", error);
    }
  }

  private static anonymizeIP(ip?: string): string | undefined {
    if (!ip) return undefined;

    const ipv4Match = ip.match(/^(\d+\.\d+)\.\d+\.\d+$/);
    if (ipv4Match) {
      return `${ipv4Match[1]}.XXX.XXX`;
    }

    if (ip.includes(":")) {
      const parts = ip.split(":");
      return `${parts[0]}:${parts[1]}:XXXX:XXXX`;
    }

    return "XXX.XXX.XXX.XXX";
  }

  private static sanitizeUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    const simplified = userAgent
      .replace(/\(.*?\)/g, "")
      .replace(/\d+\.\d+(\.\d+)*/g, "")
      .trim();

    return simplified.substring(0, 100);
  }
}
