import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import {
  SpreadsheetData,
  SpreadsheetDataFormat,
  UniverWorkbookData,
} from "@/types";
import { PaginatedResult } from "./client-service";
import { callApi } from "@/lib/api-client";

export type Spreadsheet = {
  id: string;
  tenantId: string;
  name: string;
  data: SpreadsheetData;
  dataFormat?: SpreadsheetDataFormat;
  dataJson?: string; // Stored as JSON string in Firestore
  createdAt?: string;
  updatedAt?: string;
};

const COLLECTION_NAME = "spreadsheets";
const DEFAULT_UNIVER_WORKBOOK: UniverWorkbookData = {
  name: "Planilha 1",
};

const isUniverWorkbookData = (value: unknown): value is UniverWorkbookData => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseRawSpreadsheetData = (
  dataJson: unknown,
  fallbackData: unknown,
): unknown => {
  if (typeof dataJson === "string") {
    try {
      return JSON.parse(dataJson);
    } catch (e) {
      console.error("Error parsing spreadsheet data", e);
    }
  }

  return fallbackData;
};

const resolveWorkbookName = (
  workbookData: UniverWorkbookData,
  fallbackName?: string,
): string => {
  if (
    typeof workbookData.name === "string" &&
    workbookData.name.trim().length > 0
  ) {
    return workbookData.name.trim();
  }

  if (typeof fallbackName === "string" && fallbackName.trim().length > 0) {
    return fallbackName.trim();
  }

  return DEFAULT_UNIVER_WORKBOOK.name ?? "Planilha 1";
};

const normalizeWorkbookData = (
  parsedData: unknown,
  fallbackName?: string,
): SpreadsheetData => {
  const baseData = isUniverWorkbookData(parsedData) ? parsedData : {};
  const normalized: SpreadsheetData = {
    ...DEFAULT_UNIVER_WORKBOOK,
    ...baseData,
  };
  normalized.name = resolveWorkbookName(normalized, fallbackName);
  return normalized;
};

const serializeSpreadsheetData = (
  payload: SpreadsheetData | undefined,
  fallbackName?: string,
): { dataJson: string; dataFormat: SpreadsheetDataFormat } => {
  const normalized = normalizeWorkbookData(payload, fallbackName);
  return {
    dataJson: JSON.stringify(normalized),
    dataFormat: "univer",
  };
};

function mapSpreadsheetDoc(
  d: QueryDocumentSnapshot<DocumentData>,
): Spreadsheet {
  const data = d.data();
  const rawParsedData = parseRawSpreadsheetData(data.dataJson, data.data);
  const normalizedData = normalizeWorkbookData(rawParsedData, data.name);

  return {
    id: d.id,
    ...data,
    dataFormat: "univer",
    data: normalizedData,
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate().toISOString()
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt,
  } as Spreadsheet;
}

export const SpreadsheetService = {
  getSpreadsheets: async (tenantId: string): Promise<Spreadsheet[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId),
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(mapSpreadsheetDoc);
    } catch (error) {
      console.error("Error fetching spreadsheets:", error);
      throw error;
    }
  },

  getSpreadsheetsPaginated: async (
    tenantId: string,
    pageSize: number = 12,
    cursor?: QueryDocumentSnapshot<DocumentData> | null,
    sortConfig?: { key: string; direction: "asc" | "desc" } | null,
  ): Promise<PaginatedResult<Spreadsheet>> => {
    try {
      const sortField = sortConfig?.key || "updatedAt";
      const sortDirection = sortConfig?.direction || "desc";

      const q = cursor
        ? query(
            collection(db, COLLECTION_NAME),
            where("tenantId", "==", tenantId),
            orderBy(sortField, sortDirection),
            startAfter(cursor),
            limit(pageSize + 1),
          )
        : query(
            collection(db, COLLECTION_NAME),
            where("tenantId", "==", tenantId),
            orderBy(sortField, sortDirection),
            limit(pageSize + 1),
          );

      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs;
      const hasMore = docs.length > pageSize;
      const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

      return {
        data: pageDocs.map(mapSpreadsheetDoc),
        lastDoc: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
        hasMore,
      };
    } catch (error) {
      console.error("Error fetching spreadsheets paginated:", error);
      throw error;
    }
  },

  getSpreadsheetById: async (id: string): Promise<Spreadsheet | null> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const rawParsedData = parseRawSpreadsheetData(data.dataJson, data.data);
        const normalizedData = normalizeWorkbookData(rawParsedData, data.name);

        return {
          id: docSnap.id,
          ...data,
          dataFormat: "univer",
          data: normalizedData,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt,
        } as Spreadsheet;
      }
      return null;
    } catch (error) {
      console.error("Error fetching spreadsheet:", error);
      throw error;
    }
  },

  createSpreadsheet: async (
    data: Omit<Spreadsheet, "id" | "createdAt" | "updatedAt">,
  ): Promise<string> => {
    try {
      // Persist data in dataJson and keep format for runtime decoding.
      const { data: sheetData, ...rest } = data;
      const tenantId = String(rest.tenantId || "").trim();
      if (!tenantId) {
        throw new Error("tenantId is required to create spreadsheet");
      }
      const { dataJson, dataFormat } = serializeSpreadsheetData(
        sheetData,
        rest.name,
      );
      try {
        const response = await callApi<{ id?: string; spreadsheetId?: string }>(
          "/v1/spreadsheets",
          "POST",
          {
            ...rest,
            tenantId,
            dataJson,
            dataFormat,
          },
        );
        const createdId = response.id || response.spreadsheetId;
        if (!createdId) {
          throw new Error("Spreadsheet API response missing id");
        }
        return createdId;
      } catch (apiError) {
        // Non-production fallback keeps local preview/dev productive.
        if (process.env.NODE_ENV === "production") {
          throw apiError;
        }
        console.warn(
          "Falling back to direct Firestore spreadsheet create in non-production:",
          apiError,
        );
      }

      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...rest,
        tenantId,
        dataJson,
        dataFormat,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating spreadsheet:", error);
      throw error;
    }
  },

  updateSpreadsheet: async (
    id: string,
    data: Partial<Spreadsheet>,
  ): Promise<void> => {
    try {
      const updateData: Partial<Spreadsheet> & {
        dataJson?: string;
        dataFormat?: SpreadsheetDataFormat;
      } = {
        ...data,
      };

      // tenantId is immutable once created.
      delete updateData.tenantId;
      delete updateData.createdAt;
      delete updateData.id;

      // If we are updating contents, serialize according to payload shape.
      if (Object.prototype.hasOwnProperty.call(data, "data")) {
        const { dataJson, dataFormat } = serializeSpreadsheetData(
          data.data,
          data.name,
        );
        updateData.dataJson = dataJson;
        updateData.dataFormat = dataFormat;
        delete updateData.data; // Don't save raw array
      }

      try {
        await callApi(`/v1/spreadsheets/${id}`, "PUT", updateData);
        return;
      } catch (apiError) {
        if (process.env.NODE_ENV === "production") {
          throw apiError;
        }
        console.warn(
          "Falling back to direct Firestore spreadsheet update in non-production:",
          apiError,
        );
      }

      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating spreadsheet:", error);
      throw error;
    }
  },

  deleteSpreadsheet: async (id: string): Promise<void> => {
    try {
      try {
        await callApi(`/v1/spreadsheets/${id}`, "DELETE");
        return;
      } catch (apiError) {
        if (process.env.NODE_ENV === "production") {
          throw apiError;
        }
        console.warn(
          "Falling back to direct Firestore spreadsheet delete in non-production:",
          apiError,
        );
      }

      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error("Error deleting spreadsheet:", error);
      throw error;
    }
  },
};
