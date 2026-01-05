import * as functions from "firebase-functions";

export const proxyImage = functions
  .region("southamerica-east1")
  .runWith({ memory: "256MB" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  .https.onCall(async (data: any) => {
    // Handle both direct data and wrapped data if needed, but standard V1 onCall passes data directly
    const url = data?.url || data;

    if (!url || typeof url !== "string") {
      throw new functions.https.HttpsError("invalid-argument", "Missing URL");
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          `Failed to fetch image: ${response.status} ${response.statusText}`
        );
        throw new functions.https.HttpsError(
          "internal",
          `Failed to fetch image: ${response.statusText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const mimeType = response.headers.get("content-type") || "image/png";

      return {
        success: true,
        dataUrl: `data:${mimeType};base64,${base64}`,
      };
    } catch (error: unknown) {
      console.error("Proxy image error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error proxying image";
      throw new functions.https.HttpsError("internal", errorMessage);
    }
  });
