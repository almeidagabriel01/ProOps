"use client";

import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDocs,
    query,
    where,
    getDoc,
} from "firebase/firestore";

export type ClientSource = 'manual' | 'proposal' | 'financial';

export type Client = {
    id: string;
    tenantId: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    source: ClientSource;
    sourceId?: string; // ID of the proposal or financial transaction that created this client
    createdAt: string;
    updatedAt: string;
};

const COLLECTION_NAME = "clients";

export const ClientService = {
    getClients: async (tenantId: string): Promise<Client[]> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
                };
            }) as Client[];
        } catch (error) {
            console.error("Error fetching clients:", error);
            throw error;
        }
    },

    getClientById: async (id: string): Promise<Client | null> => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                return { 
                    id: docSnap.id, 
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
                } as Client;
            }
            return null;
        } catch (error) {
            console.error("Error fetching client:", error);
            throw error;
        }
    },

    getClientByEmail: async (tenantId: string, email: string): Promise<Client | null> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId),
                where("email", "==", email.toLowerCase().trim())
            );
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                return null;
            }
            
            const doc = querySnapshot.docs[0];
            return { id: doc.id, ...doc.data() } as Client;
        } catch (error) {
            console.error("Error fetching client by email:", error);
            throw error;
        }
    },

    getClientByName: async (tenantId: string, name: string): Promise<Client | null> => {
        try {
            const q = query(
                collection(db, COLLECTION_NAME),
                where("tenantId", "==", tenantId),
                where("name", "==", name.trim())
            );
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                return null;
            }
            
            const doc = querySnapshot.docs[0];
            return { id: doc.id, ...doc.data() } as Client;
        } catch (error) {
            console.error("Error fetching client by name:", error);
            throw error;
        }
    },

    updateClient: async (id: string, data: Partial<Client>): Promise<void> => {
        try {
            const { getFunctions, httpsCallable } = await import("firebase/functions");
            const functions = getFunctions(undefined, 'southamerica-east1');
            const updateFunc = httpsCallable(functions, 'updateClient');
            await updateFunc({ clientId: id, ...data });
        } catch (error) {
            console.error("Error updating client:", error);
            throw error;
        }
    },
};
