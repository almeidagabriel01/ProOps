import { callApi } from "@/lib/api-client";

export interface ClientNote {
  id: string;
  text: string;
  authorId: string;
  authorName: string | null;
  createdAt: string;
}

/** Anotações da ficha do contato. Gravadas só pelo backend (`client_notes`). */
export const ClientNotesService = {
  list: async (clientId: string): Promise<ClientNote[]> => {
    const res = await callApi<{ notes: ClientNote[] }>(`/v1/clients/${clientId}/notes`, "GET");
    return res.notes;
  },

  create: async (clientId: string, text: string): Promise<ClientNote> => {
    const res = await callApi<{ note: ClientNote }>(`/v1/clients/${clientId}/notes`, "POST", {
      text,
    });
    return res.note;
  },

  remove: async (clientId: string, noteId: string): Promise<void> => {
    await callApi(`/v1/clients/${clientId}/notes/${noteId}`, "DELETE");
  },
};
