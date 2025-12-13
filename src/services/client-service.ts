"use client";

import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
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
            return querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Client[];
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
                return { id: docSnap.id, ...docSnap.data() } as Client;
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

    createClient: async (client: Omit<Client, "id">): Promise<Client> => {
        try {
            // Filter out undefined values - Firestore doesn't accept undefined
            const clientData: Record<string, unknown> = {
                tenantId: client.tenantId,
                name: client.name,
                source: client.source,
                createdAt: client.createdAt,
                updatedAt: client.updatedAt,
            };
            
            // Only add optional fields if they have values
            if (client.email) clientData.email = client.email.toLowerCase().trim();
            if (client.phone) clientData.phone = client.phone;
            if (client.address) clientData.address = client.address;
            if (client.notes) clientData.notes = client.notes;
            if (client.sourceId) clientData.sourceId = client.sourceId;

            const docRef = await addDoc(collection(db, COLLECTION_NAME), clientData);
            return { id: docRef.id, ...clientData } as Client;
        } catch (error) {
            console.error("Error creating client:", error);
            throw error;
        }
    },

    updateClient: async (id: string, updates: Partial<Omit<Client, "id">>) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const updatedData = {
                ...updates,
                email: updates.email?.toLowerCase().trim(),
                updatedAt: new Date().toISOString(),
            };
            await updateDoc(docRef, updatedData);
            return { id, ...updatedData };
        } catch (error) {
            console.error("Error updating client:", error);
            throw error;
        }
    },

    deleteClient: async (id: string) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
            return true;
        } catch (error) {
            console.error("Error deleting client:", error);
            throw error;
        }
    },

    /**
     * Find an existing client or create a new one.
     * Searches by email first (if provided), then by name.
     * Used for automatic client creation from proposals and financial module.
     */
    findOrCreateClient: async (
        tenantId: string,
        clientData: {
            name: string;
            email?: string;
            phone?: string;
            address?: string;
        },
        source: ClientSource,
        sourceId?: string
    ): Promise<{ client: Client; created: boolean }> => {
        try {
            // First, try to find by email (more reliable identifier)
            if (clientData.email) {
                const existingByEmail = await ClientService.getClientByEmail(
                    tenantId,
                    clientData.email
                );
                if (existingByEmail) {
                    return { client: existingByEmail, created: false };
                }
            }

            // If no email or not found, try by exact name match
            const existingByName = await ClientService.getClientByName(
                tenantId,
                clientData.name
            );
            if (existingByName) {
                return { client: existingByName, created: false };
            }

            // Create new client
            const now = new Date().toISOString();
            const newClient = await ClientService.createClient({
                tenantId,
                name: clientData.name.trim(),
                email: clientData.email,
                phone: clientData.phone,
                address: clientData.address,
                source,
                sourceId,
                createdAt: now,
                updatedAt: now,
            });

            return { client: newClient, created: true };
        } catch (error) {
            console.error("Error in findOrCreateClient:", error);
            throw error;
        }
    },
};
