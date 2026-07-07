import { onRequest } from "firebase-functions/v2/https";
import { PDF_OPTIONS } from "./deploymentConfig";
import { pdfApp } from "./pdfApp";

export const pdf = onRequest(PDF_OPTIONS, pdfApp);
