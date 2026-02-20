import { WhatsAppSendApiResponse } from "./whatsapp.types";
import { formatOutboundNumber, getWhatsAppApiConfig } from "./whatsapp.utils";

export async function sendWhatsAppMessage(to: string, body: string) {
  const formattedTo = formatOutboundNumber(to);
  console.log(`[WhatsApp] Sending to ${formattedTo}: ${body}`);

  const config = getWhatsAppApiConfig();
  if (!config) {
    return;
  }
  const { token, phoneNumberId, tokenDiagnostics } = config;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedTo,
          type: "text",
          text: {
            preview_url: false,
            body: body,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error(
        `[WhatsApp] Meta API Error sending message to ${formattedTo}:`,
        errorData,
        {
          phoneNumberId,
          tokenDiagnostics,
        },
      );
    } else {
      const successData = (await response
        .json()
        .catch(() => null)) as WhatsAppSendApiResponse | null;
      const messageId = successData?.messages?.[0]?.id;
      const messageStatus = successData?.messages?.[0]?.message_status;
      console.log(
        `[WhatsApp] Successfully sent text message to ${formattedTo}`,
        {
          messageId,
          messageStatus,
        },
      );
    }
  } catch (error) {
    console.error(
      `[WhatsApp] Exception sending message to ${formattedTo}:`,
      error,
    );
  }
}

export async function uploadMediaToWhatsApp(
  buffer: Buffer,
  token: string,
  phoneNumberId: string,
): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
      "proposta.pdf",
    );
    formData.append("type", "application/pdf");
    formData.append("messaging_product", "whatsapp");

    const uploadResponse = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
    );

    if (!uploadResponse.ok) {
      const err = await uploadResponse.text();
      console.error(`[WhatsApp] Failed to upload media:`, err);
      return null;
    }

    const data = (await uploadResponse.json()) as { id: string };
    return data.id;
  } catch (error) {
    console.error(`[WhatsApp] Exception in uploadMediaToWhatsApp:`, error);
    return null;
  }
}

export async function sendWhatsAppPdf(
  to: string,
  pdfBuffer: Buffer,
  fallbackLink: string,
  caption: string,
) {
  const formattedTo = formatOutboundNumber(to);
  console.log(`[WhatsApp] Sending PDF to ${formattedTo} with media upload`);

  const config = getWhatsAppApiConfig();
  if (!config) {
    return;
  }
  const { token, phoneNumberId, tokenDiagnostics } = config;

  try {
    const mediaId = await uploadMediaToWhatsApp(
      pdfBuffer,
      token,
      phoneNumberId,
    );

    const documentPayload = mediaId
      ? { id: mediaId, caption, filename: "proposta.pdf" }
      : { link: fallbackLink, caption, filename: "proposta.pdf" };

    if (!mediaId) {
      console.warn(
        `[WhatsApp] Media upload failed, falling back to sending via Link: ${fallbackLink}`,
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedTo,
          type: "document",
          document: documentPayload,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error(
        `[WhatsApp] Meta API Error sending PDF to ${formattedTo}:`,
        errorData,
        {
          phoneNumberId,
          tokenDiagnostics,
        },
      );
      throw new Error(`Meta API Error: ${errorData}`);
    } else {
      const successData = (await response
        .json()
        .catch(() => null)) as WhatsAppSendApiResponse | null;
      const messageId = successData?.messages?.[0]?.id;
      const messageStatus = successData?.messages?.[0]?.message_status;
      console.log(
        `[WhatsApp] Successfully sent PDF message to ${formattedTo}`,
        {
          messageId,
          messageStatus,
        },
      );
    }
  } catch (error) {
    console.error(`[WhatsApp] Exception sending PDF to ${formattedTo}:`, error);
  }
}
