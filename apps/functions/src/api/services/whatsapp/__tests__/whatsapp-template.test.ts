/**
 * Unit tests for sendWhatsAppTemplate — asserts the Graph API payload shape
 * (type:"template") and error handling. global.fetch is mocked.
 */

import { sendWhatsAppTemplate } from "../whatsapp.api";

const originalEnv = { ...process.env };
let fetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.WHATSAPP_ACCESS_TOKEN = "test-access-token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
  fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function okResponse() {
  return {
    ok: true,
    json: async () => ({ messages: [{ id: "wamid.123", message_status: "accepted" }] }),
  } as unknown as Response;
}

describe("sendWhatsAppTemplate", () => {
  it("POSTs a type:template payload to the Graph API", async () => {
    fetchMock.mockResolvedValue(okResponse());

    const components = [
      { type: "body", parameters: [{ type: "text", text: "123456" }] },
    ];
    await sendWhatsAppTemplate("5511999998888", "otp_template", "pt_BR", components);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v18.0/123456789/messages");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-access-token");

    const body = JSON.parse(init.body as string);
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.type).toBe("template");
    expect(body.template).toEqual({
      name: "otp_template",
      language: { code: "pt_BR" },
      components,
    });
    // formatOutboundNumber keeps a full 13-digit BR number as-is.
    expect(body.to).toBe("5511999998888");
  });

  it("throws when the Graph API returns a non-ok response", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      text: async () => "template not approved",
    } as unknown as Response);

    await expect(
      sendWhatsAppTemplate("5511999998888", "otp_template", "pt_BR", []),
    ).rejects.toThrow(/Meta API Error/);
  });

  it("returns silently (no fetch) when WhatsApp config is missing", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    await sendWhatsAppTemplate("5511999998888", "otp_template", "pt_BR", []);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
