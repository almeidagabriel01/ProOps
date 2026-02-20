import crypto from "crypto";

const BASE_URL = "http://localhost:3000/api/whatsapp";
const PHONE_NUMBER = "5511999999999";
const APP_SECRET = "test_secret";

async function sendWebhook(text: string, phoneNumber = PHONE_NUMBER) {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15555555555",
                phone_number_id: "PHONE_NUMBER_ID",
              },
              contacts: [
                {
                  profile: {
                    name: "Test User",
                  },
                  wa_id: phoneNumber,
                },
              ],
              messages: [
                {
                  from: phoneNumber,
                  id: "wamid." + Date.now(),
                  timestamp: Date.now().toString(),
                  text: {
                    body: text,
                  },
                  type: "text",
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };

  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", APP_SECRET)
    .update(payloadString)
    .digest("hex");

  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": `sha256=${signature}`,
      },
      body: payloadString,
    });

    console.log(`Sent: "${text}" | Status: ${response.status}`);
    const data = await response.text();
    console.log("Response:", data);
  } catch (error) {
    console.error("Error sending webhook:", error);
  }
}

async function runTests() {
  console.log("--- Starting Stateful WhatsApp Webhook Tests ---");

  // 1. Start Session / List Proposals (Sets awaiting_proposal_selection)
  console.log("\n1. List Proposals (Set Session)");
  await sendWebhook("Listar propostas");

  // 2. Select Proposal by Index (Contextual)
  console.log("\n2. Select Proposal #1");
  await sendWebhook("1");

  // 3. Test Financial (Check Role) - Assuming user is Admin
  console.log("\n3. Financial Summary");
  await sendWebhook("Financeiro de hoje");

  // 4. Test Balance
  console.log("\n4. Balance");
  await sendWebhook("Saldo atual");

  console.log("--- Tests Completed ---");
}

runTests();
