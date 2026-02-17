import axios from "axios";

const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID || "";
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET || "";
const PLUGGY_BASE_URL = "https://api.pluggy.ai";

let cachedApiKey: string | null = null;
let cachedApiKeyExpiresAt = 0;

/**
 * Service to interact with the Pluggy API using REST calls (no SDK dependency).
 */
export class PluggyService {
  /**
   * Authenticates with the Pluggy API and returns an API key.
   * The key is cached until it expires.
   */
  private static async getApiKey(): Promise<string> {
    const now = Date.now();
    if (cachedApiKey && cachedApiKeyExpiresAt > now) {
      return cachedApiKey;
    }

    const { data } = await axios.post(`${PLUGGY_BASE_URL}/auth`, {
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET,
    });

    cachedApiKey = data.apiKey;
    // Cache for 50 minutes (Pluggy keys last ~1 hour)
    cachedApiKeyExpiresAt = now + 50 * 60 * 1000;
    return data.apiKey;
  }

  /**
   * Creates a Connect Token for the Pluggy Widget.
   * This token allows the frontend to initialize the widget securely.
   */
  static async createConnectToken(itemId?: string): Promise<string> {
    try {
      const apiKey = await this.getApiKey();
      const body: Record<string, string> = {};
      if (itemId) body.itemId = itemId;

      const { data } = await axios.post(
        `${PLUGGY_BASE_URL}/connect_token`,
        body,
        { headers: { "X-API-KEY": apiKey } },
      );

      return data.accessToken;
    } catch (error) {
      console.error("Error creating Pluggy Connect Token:", error);
      throw new Error("Failed to create connect token");
    }
  }

  /**
   * Fetches the latest transactions for a specific account.
   * Used by the sync job.
   */
  static async getTransactions(accountId: string, fromDate?: string) {
    try {
      const apiKey = await this.getApiKey();
      const from =
        fromDate ||
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];

      const { data } = await axios.get(
        `${PLUGGY_BASE_URL}/transactions`,
        {
          params: { accountId, from },
          headers: { "X-API-KEY": apiKey },
        },
      );

      return data.results;
    } catch (error) {
      console.error(`Error fetching transactions for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Fetches account details (balance, number, etc.)
   */
  static async getAccounts(itemId: string) {
    try {
      const apiKey = await this.getApiKey();
      const { data } = await axios.get(
        `${PLUGGY_BASE_URL}/accounts`,
        {
          params: { itemId },
          headers: { "X-API-KEY": apiKey },
        },
      );
      return data.results;
    } catch (error) {
      console.error(`Error fetching accounts for item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Fetches item details (connection status, connector info, etc.)
   */
  static async getItem(itemId: string) {
    try {
      const apiKey = await this.getApiKey();
      const { data } = await axios.get(
        `${PLUGGY_BASE_URL}/items/${itemId}`,
        { headers: { "X-API-KEY": apiKey } },
      );
      return data;
      return data;
    } catch (error) {
      console.error(`Error fetching item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * PIS: Creates a Payment Request
   * Returns the paymentUrl for the user to authorize the payment.
   */
  static async createPaymentRequest(payload: {
    amount: number;
    description: string;
    callbackUrl?: string; // Where Pluggy redirects after success/fail
    receiver: {
      name: string;
      cpf: string;
      taxNumber?: string; // CNPJ or CPF
      bankAccount?: {
        bankId: string; // ISPB
        branch: string;
        number: string;
        accountType: "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT";
      };
      pixKey?: string;
    };
  }) {
    try {
      const apiKey = await this.getApiKey();
      
      // Determine receiver details (Pix or Manual Transfer)
      // For now, let's focus on PIX which is simpler and most common.
      
      const body: any = {
        // Pluggy API usually takes amount in standard currency (e.g. 10.50)
        // Let's verify documentation or assume standard float.
        // Update: Pluggy usually expects amount as a number (float).
        amount: payload.amount,
        currency: "BRL",
        description: payload.description,
        callbackUrl: payload.callbackUrl,
        receiver: {
          name: payload.receiver.name,
          taxNumber: payload.receiver.taxNumber || payload.receiver.cpf,
          personType: payload.receiver.taxNumber?.length === 14 ? "LEGAL" : "NATURAL",
        },
      };

      if (payload.receiver.pixKey) {
        body.receiver.pixKey = payload.receiver.pixKey;
        body.paymentMethod = "PIX";
      } else if (payload.receiver.bankAccount) {
        body.receiver.bankAccount = payload.receiver.bankAccount;
        body.paymentMethod = "TED"; // or DOC/TEF
      }

      console.log("Creating Payment Request:", body);

      const { data } = await axios.post(
        `${PLUGGY_BASE_URL}/payments`,
        body,
        { headers: { "X-API-KEY": apiKey } },
      );

      return {
        id: data.id,
        paymentUrl: data.paymentUrl,
        status: data.status,
      };
    } catch (error: any) {
      console.error("Error creating payment request:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(error.response?.data?.message || "Failed to create payment request");
    }
  }
}
