import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { NotificationService } from "./notification.service";

const SHARED_PROPOSALS_COLLECTION = "shared_proposals";
const SHARED_LINK_EXPIRATION_DAYS = 30;
const DEFAULT_PROPOSAL_TITLE = "Proposta sem titulo";

export type SharedProposalPurpose = "external_share" | "system_pdf_render";

export interface SharedProposal {
  id: string;
  proposalId: string;
  tenantId: string;
  token: string;
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  purpose?: SharedProposalPurpose;
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

    const isLocal =
      process.env.FUNCTIONS_EMULATOR === "true" ||
      process.env.NODE_ENV === "development";

    return isLocal ? "http://localhost:3000/" : "https://proops.com.br/";
  }

  private static getExpirationDate(days = SHARED_LINK_EXPIRATION_DAYS): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  private static getInternalRenderExpirationDate(minutes = 30): Date {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + minutes);
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
      const existingSnapshot = await db
        .collection(SHARED_PROPOSALS_COLLECTION)
        .where("proposalId", "==", proposalId)
        .where("tenantId", "==", tenantId)
        .limit(10)
        .get();

      const existingExternalDoc = existingSnapshot.docs.find((docSnap) => {
        const currentPurpose = String((docSnap.data() as SharedProposal).purpose || "");
        return !currentPurpose || currentPurpose === "external_share";
      });

      if (existingExternalDoc) {
        const doc = existingExternalDoc;
        const data = doc.data() as SharedProposal;

        const expiresAt = this.getExpirationDate();
        await doc.ref.update({
          expiresAt: expiresAt.toISOString(),
          purpose: "external_share",
        });

        return {
          shareUrl: this.buildShareUrl(data.token),
          token: data.token,
          expiresAt: expiresAt.toISOString(),
        };
      }

      const token = uuidv4();
      const expiresAt = this.getExpirationDate();

      const sharedProposal: Omit<SharedProposal, "id"> = {
        proposalId,
        tenantId,
        token,
        createdAt: new Date().toISOString(),
        createdBy: userId,
        expiresAt: expiresAt.toISOString(),
        purpose: "external_share",
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

  static async createInternalRenderLink(
    proposalId: string,
    tenantId: string,
    userId: string,
  ): Promise<ShareLinkResponse> {
    try {
      const existingSnapshot = await db
        .collection(SHARED_PROPOSALS_COLLECTION)
        .where("proposalId", "==", proposalId)
        .where("tenantId", "==", tenantId)
        .limit(10)
        .get();

      const now = new Date();
      const existingInternalDoc = existingSnapshot.docs.find((docSnap) => {
        const data = docSnap.data() as SharedProposal;
        const purpose = String(data.purpose || "");
        if (purpose !== "system_pdf_render") return false;
        const expiresAt = new Date(String(data.expiresAt || ""));
        return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
      });

      if (existingInternalDoc) {
        const data = existingInternalDoc.data() as SharedProposal;
        return {
          shareUrl: this.buildShareUrl(data.token),
          token: data.token,
          expiresAt: String(data.expiresAt),
        };
      }

      const token = uuidv4();
      const expiresAt = this.getInternalRenderExpirationDate();

      const sharedProposal: Omit<SharedProposal, "id"> = {
        proposalId,
        tenantId,
        token,
        createdAt: new Date().toISOString(),
        createdBy: userId,
        expiresAt: expiresAt.toISOString(),
        purpose: "system_pdf_render",
        viewerInfo: [],
      };

      await db.collection(SHARED_PROPOSALS_COLLECTION).add(sharedProposal);

      return {
        shareUrl: this.buildShareUrl(token),
        token,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      console.error("Error creating internal render link:", error);
      throw new Error("Failed to create internal render link");
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
