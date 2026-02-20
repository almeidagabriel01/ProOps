import { Timestamp } from "firebase-admin/firestore";

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text: {
    body: string;
  };
  type: string;
}

export interface WhatsAppStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: {
      details?: string;
    };
  }>;
}

export interface WhatsAppSendApiResponse {
  messaging_product?: string;
  contacts?: Array<{
    input?: string;
    wa_id?: string;
  }>;
  messages?: Array<{
    id?: string;
    message_status?: string;
  }>;
}

export interface WebhookPayload {
  object: string;
  entry: {
    id: string;
    changes: {
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts: {
          profile: {
            name: string;
          };
          wa_id: string;
        }[];
        messages?: WhatsAppMessage[];
        statuses?: WhatsAppStatus[];
      };
      field: string;
    }[];
  }[];
}

export interface SessionData {
  phoneNumber: string;
  userId: string;
  lastAction: "idle" | "awaiting_proposal_selection";
  proposalsShown?: { id: string; index: number }[];
  expiresAt: number | Timestamp;
}

export type ProposalListItem = {
  id: string;
  title: string;
  clientName: string;
  totalValue: number;
  updatedAt: Date | null;
};

export type NormalizedTransaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
};
