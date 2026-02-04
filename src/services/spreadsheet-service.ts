
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
} from "firebase/firestore";

export type Spreadsheet = {
  id: string;
  tenantId: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]; // FortuneSheet data structure (runtime)
  dataJson?: string; // Stored as JSON string in Firestore
  createdAt?: string;
  updatedAt?: string;
};

const COLLECTION_NAME = "spreadsheets";

export const SpreadsheetService = {
  getSpreadsheets: async (tenantId: string): Promise<Spreadsheet[]> => {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("tenantId", "==", tenantId)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        let parsedData = [];
        try {
          // Fallback for older documents that might store data directly (if any worked)
          // or use the new dataJson field
          if (data.dataJson) {
            parsedData = JSON.parse(data.dataJson);
          } else if (data.data) {
             parsedData = data.data;
          }
        } catch (e) {
            console.error("Error parsing spreadsheet data", e);
        }

        return {
          id: doc.id,
          ...data,
          data: parsedData,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate().toISOString()
            : data.createdAt,
          updatedAt: data.updatedAt?.toDate
            ? data.updatedAt.toDate().toISOString()
            : data.updatedAt,
        } as Spreadsheet;
      });
    } catch (error) {
      console.error("Error fetching spreadsheets:", error);
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
            console.log("SpreadsheetService: Found dataJson. Length:", data.dataJson.length);
            parsedData = JSON.parse(data.dataJson);
          } else if (data.data) {
             console.log("SpreadsheetService: Found legacy data array.");
             parsedData = data.data;
          } else {
             console.log("SpreadsheetService: No data found in document.");
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

  createSpreadsheet: async (data: Omit<Spreadsheet, "id" | "createdAt" | "updatedAt">): Promise<string> => {
    try {
      // Prepare data for Firestore: remove 'data' array, use 'dataJson' string
      const { data: sheetData, ...rest } = data;
      // Default to one sheet if none provided, to ensure structure is valid
      const initialData = (sheetData && sheetData.length > 0) ? sheetData : [{ name: "Planilha 1" }];
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

  updateSpreadsheet: async (id: string, data: Partial<Spreadsheet>): Promise<void> => {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      
      const updateData: Record<string, unknown> = { ...data };
      
      // If we are updating contents, serialize them
      if (data.data) {
         console.log("SpreadsheetService: Serializing data for update...");
         
         // Deep inspection logging
         if (Array.isArray(data.data)) {
            data.data.forEach((sheet, index) => {
                console.log(`Sheet ${index} (${sheet.name}) has data grid?`, !!sheet.data);
                if (sheet.data && Array.isArray(sheet.data)) {
                    let foundVal = false;
                    for (let r = 0; r < Math.min(sheet.data.length, 20); r++) {
                        if (foundVal) break;
                        for (let c = 0; c < Math.min(sheet.data[r].length, 20); c++) {
                            const cell = sheet.data[r][c];
                            if (cell !== null && cell !== undefined) {
                                console.log(`Sheet ${index} Sample Cell [${r},${c}]:`, JSON.stringify(cell));
                                foundVal = true;
                                break;
                            }
                        }
                    }
                    if (!foundVal) console.log(`Sheet ${index}: First 20x20 cells appear empty.`);
                }
            });
         }

         const dataJson = JSON.stringify(data.data);
         console.log("SpreadsheetService: Serialized data size (chars):", dataJson.length);
         updateData.dataJson = dataJson;
         delete updateData.data; // Don't save raw array
      }

      console.log("SpreadsheetService: Updating doc", id, "with fields:", Object.keys(updateData));
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp(),
      });
      console.log("SpreadsheetService: Update successful");
      
      // VERIFY THE WRITE IMMEDIATELY
      const verifySnap = await getDoc(docRef);
      const verifyData = verifySnap.data();
      if (verifySnap.exists() && verifyData?.dataJson) {
          console.log("SpreadsheetService: VERIFICATION READ - dataJson length in DB:", verifyData.dataJson.length);
          if (verifyData.dataJson.length !== (updateData.dataJson as string).length) {
              console.error("SpreadsheetService: CRITICAL - Write verification failed! Length mismatch.");
          } else {
              console.log("SpreadsheetService: Write verification PASSED.");
          }
      } else {
          console.error("SpreadsheetService: CRITICAL - Write verification failed! Document or field not found.");
      }

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
