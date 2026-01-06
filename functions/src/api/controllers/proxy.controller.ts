import { Request, Response } from "express";
import axios from "axios";

export const proxyImage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const imageUrl = req.query.url as string;

    if (!imageUrl) {
      return res.status(400).send("URL parameter is required.");
    }

    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const contentType = response.headers["content-type"];

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    return res.send(response.data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error proxying image.";
    console.error("Error proxying image:", message);
    return res.status(500).send("Error proxying image.");
  }
};
