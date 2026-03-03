import { db } from "../../init";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import { NotificationService } from "./notification.service";
import { resolveFrontendAppUrl } from "../../lib/frontend-app-url";

const SHARED_TRANSACTIONS_COLLECTION = "shared_transactions";
const SHARED_LINK_EXPIRATION_DAYS = 30;

export interface SharedTransaction {
  id: string;
  transactionId: string;
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

export class SharedTransactionService {
  private static getBaseAppUrl(): string {
    return resolveFrontendAppUrl();
  }

  private static getExpirationDate(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SHARED_LINK_EXPIRATION_DAYS);
    return expiresAt;
  }

  private static buildShareUrl(token: string): string {
    return new URL(`/share/transaction/${token}`, this.getBaseAppUrl()).toString();
  }

  private static assertNotExpired(expiresAtIso: string): void {
    const expiresAt = new Date(expiresAtIso);
    if (expiresAt < new Date()) {
      throw new Error("EXPIRED_LINK");
    }
  }

  static async createShareLink(
    transactionId: string,
    tenantId: string,
    userId: string,
  ): Promise<ShareLinkResponse> {
    try {
      // Verificar se já existe um link compartilhado para esta transação
      const existingSnapshot = await db
        .collection(SHARED_TRANSACTIONS_COLLECTION)
        .where("transactionId", "==", transactionId)
        .where("tenantId", "==", tenantId)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        const doc = existingSnapshot.docs[0];
        const data = doc.data() as SharedTransaction;
        
        // Renovar a data de expiração
        const expiresAt = this.getExpirationDate();
        await doc.ref.update({ expiresAt: expiresAt.toISOString() });

        return {
          shareUrl: this.buildShareUrl(data.token),
          token: data.token,
          expiresAt: expiresAt.toISOString(),
        };
      }

      const token = uuidv4();
      const expiresAt = this.getExpirationDate();

      const sharedTransaction: Omit<SharedTransaction, "id"> = {
        transactionId,
        tenantId,
        token,
        createdAt: new Date().toISOString(),
        createdBy: userId,
        expiresAt: expiresAt.toISOString(),
        viewerInfo: [],
      };

      await db.collection(SHARED_TRANSACTIONS_COLLECTION).add(sharedTransaction);

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

  static async getSharedTransaction(token: string): Promise<SharedTransaction | null> {
    try {
      const snapshot = await db
        .collection(SHARED_TRANSACTIONS_COLLECTION)
        .where("token", "==", token)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data() as Omit<SharedTransaction, "id">;
      this.assertNotExpired(data.expiresAt);

      return {
        id: doc.id,
        ...data,
      };
    } catch (error) {
      if (error instanceof Error && error.message === "EXPIRED_LINK") {
        throw error;
      }
      console.error("Error getting shared transaction:", error);
      throw new Error("Failed to get shared transaction");
    }
  }

  static async recordView(
    sharedTransactionId: string,
    tenantId: string,
    transactionId: string,
    viewerData: {
      ip?: string;
      userAgent?: string;
    },
    transactionDescription?: string,
  ): Promise<void> {
    try {
      const viewerInfo: ViewerInfo = {
        ip: this.anonymizeIP(viewerData.ip),
        userAgent: this.sanitizeUserAgent(viewerData.userAgent),
        timestamp: new Date().toISOString(),
      };

      const docRef = db.collection(SHARED_TRANSACTIONS_COLLECTION).doc(sharedTransactionId);

      const description = transactionDescription || "Lançamento";

      await Promise.all([
        docRef.update({
          viewedAt: new Date().toISOString(),
          viewerInfo: FieldValue.arrayUnion(viewerInfo),
        }),
        NotificationService.createNotification({
          tenantId,
          type: "transaction_viewed",
          title: "Lançamento Visualizado",
          message: `O lançamento "${description}" foi visualizado.`,
          transactionId,
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
