"use client";

import { collection, getDocs, limit, query, where, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { callApi } from "@/lib/api-client";
import { sortResponsibles } from "@/lib/field-service/technical-responsibles";
import type { ArtFile, Council, TechnicalResponsible, TechnicalResponsibleInput } from "@/types/field-service";

const COLLECTION = "technical_responsibles";

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function toTechnicalResponsible(id: string, data: DocumentData): TechnicalResponsible {
  const file = data.artFile as Partial<ArtFile> | null | undefined;
  return {
    id,
    tenantId: String(data.tenantId ?? ""),
    name: String(data.name ?? ""),
    profession: String(data.profession ?? ""),
    council: (["CREA", "CFT", "CAU"].includes(data.council) ? data.council : "CREA") as Council,
    registryNumber: String(data.registryNumber ?? ""),
    artNumber: str(data.artNumber),
    artValidUntil: str(data.artValidUntil),
    artFile:
      file && typeof file.url === "string"
        ? {
            path: String(file.path ?? ""),
            url: file.url,
            name: String(file.name ?? "art.pdf"),
            size: Number(file.size ?? 0),
            uploadedAt: String(file.uploadedAt ?? ""),
          }
        : null,
    active: data.active !== false,
  };
}

/** Lê direto no Firestore (as rules deixam a empresa ler); grava pela API, só dono e admins. */
export const TechnicalResponsiblesService = {
  async list(tenantId: string): Promise<TechnicalResponsible[]> {
    if (!tenantId) return [];
    const snap = await getDocs(query(collection(db, COLLECTION), where("tenantId", "==", tenantId), limit(50)));
    return sortResponsibles(snap.docs.map((d) => toTechnicalResponsible(d.id, d.data())));
  },
  create: (input: TechnicalResponsibleInput) =>
    callApi<{ id: string }>("/v1/technical-responsibles", "POST", input),
  update: (id: string, input: Partial<TechnicalResponsibleInput>) =>
    callApi(`/v1/technical-responsibles/${id}`, "PUT", input),
  remove: (id: string) => callApi(`/v1/technical-responsibles/${id}`, "DELETE"),
  uploadArt: (id: string, dataUrl: string, fileName: string) =>
    callApi<{ artFile: ArtFile }>(`/v1/technical-responsibles/${id}/art`, "POST", { dataUrl, fileName }),
  removeArt: (id: string) => callApi(`/v1/technical-responsibles/${id}/art`, "DELETE"),
};
