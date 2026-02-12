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
import { SheetData, RowData, CellStyle } from "@/types";
import { PaginatedResult } from "./client-service";

export type Spreadsheet = {
  id: string;
  tenantId: string;
  name: string;
  data: SheetData[]; // FortuneSheet data structure (runtime)
  dataJson?: string; // Stored as JSON string in Firestore
  createdAt?: string;
  updatedAt?: string;
};

const COLLECTION_NAME = "spreadsheets";

/**
 * Convert expanded data format (2D array) to compact celldata format
 * Only stores cells that have content, ignoring null/empty cells
 */
const convertToCelldata = (sheetData: SheetData[]): SheetData[] => {
  return sheetData.map((sheet) => {
    // If already has celldata, prefer that
    if (sheet.celldata && Array.isArray(sheet.celldata)) {
      return {
        ...sheet,
        data: undefined,
      };
    }

    // Convert data array to celldata
    const celldata: Array<{
      r: number;
      c: number;
      v: unknown;
    }> = [];

    if (sheet.data && Array.isArray(sheet.data)) {
      sheet.data.forEach((row, rowIndex) => {
        if (Array.isArray(row)) {
          row.forEach((cell, colIndex) => {
            // Only save cells with actual content
            if (cell !== null && cell !== undefined) {
              celldata.push({
                r: rowIndex,
                c: colIndex,
                v: cell,
              });
            }
          });
        }
      });
    }

    // Return sheet with celldata format, removing expanded data array
    return {
      ...sheet,
      celldata: celldata.length > 0 ? celldata : undefined,
      data: undefined,
    };
  });
};

/**
 * Expand celldata format back to 2D data array for FortuneSheet rendering
 * Reverse operation of convertToCelldata
 */
const expandCelldata = (sheetData: SheetData[]): SheetData[] => {
  return sheetData.map((sheet) => {
    // If already has expanded data array, return as is
    if (sheet.data && Array.isArray(sheet.data) && sheet.data.length > 0) {
      return sheet;
    }

    // If has celldata, expand it to data array
    if (
      sheet.celldata &&
      Array.isArray(sheet.celldata) &&
      sheet.celldata.length > 0
    ) {
      // Determine grid size from celldata
      let maxRow = 0;
      let maxCol = 0;

      (sheet.celldata as Array<{ r: number; c: number }>).forEach((cell) => {
        if (cell.r > maxRow) maxRow = cell.r;
        if (cell.c > maxCol) maxCol = cell.c;
      });

      // Create empty 2D array with appropriate size
      // Add some padding to ensure we have enough space
      const rows = Math.max(maxRow + 1, sheet.row || 100);
      const cols = Math.max(maxCol + 1, sheet.column || 60);

      const dataArray: RowData[] = [];
      for (let r = 0; r < rows; r++) {
        const row: (CellStyle | null)[] = [];
        for (let c = 0; c < cols; c++) {
          row.push(null);
        }
        dataArray.push(row);
      }

      // Fill in the cells from celldata
      (sheet.celldata as Array<{ r: number; c: number; v: unknown }>).forEach(
        (cell) => {
          if (cell.r < rows && cell.c < cols) {
            dataArray[cell.r][cell.c] = cell.v as CellStyle | null;
          }
        },
      );

      return {
        ...sheet,
        data: dataArray,
        // Keep celldata for compatibility but data takes precedence for rendering
      };
    }

    // Empty sheet - return with minimal structure
    return {
      ...sheet,
      data: sheet.data || [],
    };
  });
};

function mapSpreadsheetDoc(
  d: QueryDocumentSnapshot<DocumentData>,
): Spreadsheet {
  const data = d.data();
  let parsedData: SheetData[] = [];
  try {
    if (data.dataJson) {
      parsedData = JSON.parse(data.dataJson);
      parsedData = expandCelldata(parsedData);
    } else if (data.data) {
      parsedData = data.data;
    }
  } catch (e) {
    console.error("Error parsing spreadsheet data", e);
  }

  return {
    id: d.id,
    ...data,
    data: parsedData,
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
        let parsedData = [];
        try {
          if (data.dataJson) {
            parsedData = JSON.parse(data.dataJson);
            // Expand celldata to data array for FortuneSheet rendering
            parsedData = expandCelldata(parsedData);
          } else if (data.data) {
            parsedData = data.data;
          }
        } catch (e) {
          console.error("Error parsing spreadsheet data", e);
        }

        return {
          id: docSnap.id,
          ...data,
          data: parsedData,
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
      // Prepare data for Firestore: remove 'data' array, use 'dataJson' string
      const { data: sheetData, ...rest } = data;
      // Default to one sheet if none provided, using celldata format
      const initialData =
        sheetData && sheetData.length > 0
          ? convertToCelldata(sheetData)
          : [{ name: "Planilha 1", celldata: [] }];
      const dataJson = JSON.stringify(initialData);

      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...rest,
        dataJson,
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
      const docRef = doc(db, COLLECTION_NAME, id);

      const updateData: Partial<Spreadsheet> & { dataJson?: string } = {
        ...data,
      };

      // If we are updating contents, convert to compact format and serialize
      if (data.data) {
        const compactData = convertToCelldata(data.data);
        const dataJson = JSON.stringify(compactData);
        updateData.dataJson = dataJson;
        delete updateData.data; // Don't save raw array
      }

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
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (error) {
      console.error("Error deleting spreadsheet:", error);
      throw error;
    }
  },
};
