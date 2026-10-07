import { Request, Response } from "express";
import { z } from "zod";
import { db } from "../../init";
import { hasPagePermission } from "../../lib/auth-helpers";

/**
 * Anotações da ficha do contato (`client_notes`). Seguem a permissão de
 * contatos: quem vê o contato lê, quem edita o contato escreve e apaga.
 * Todos os planos: é o histórico do relacionamento, não um módulo pago.
 */
const COLLECTION = "client_notes";
const MAX_NOTES_LISTED = 100;

const CreateNoteSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Escreva a anotação.")
      .max(2000, "A anotação passou de 2.000 caracteres."),
  })
  .strict();

async function loadClientOfTenant(clientId: string, tenantId: string) {
  const snap = await db.collection("clients").doc(clientId).get();
  if (!snap.exists || snap.data()?.tenantId !== tenantId) return null;
  return snap;
}

/** GET /v1/clients/:id/notes */
export async function listClientNotes(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "clients", "canView"))) {
      return res.status(403).json({ message: "Sem permissão para ver contatos." });
    }
    if (!(await loadClientOfTenant(req.params.id, tenantId))) {
      return res.status(404).json({ message: "Contato não encontrado." });
    }

    const snap = await db
      .collection(COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("clientId", "==", req.params.id)
      .orderBy("createdAt", "desc")
      .limit(MAX_NOTES_LISTED)
      .get();

    return res.json({
      notes: snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          authorId: data.authorId,
          authorName: data.authorName ?? null,
          createdAt: data.createdAt,
        };
      }),
    });
  } catch (error) {
    console.error("listClientNotes Error:", error);
    return res.status(500).json({ message: "Erro ao carregar anotações." });
  }
}

/** POST /v1/clients/:id/notes */
export async function createClientNote(req: Request, res: Response) {
  const parsed = CreateNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message || "Dados inválidos." });
  }

  try {
    const tenantId = req.user?.tenantId;
    const uid = req.user?.uid;
    if (!tenantId || !uid) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "clients", "canEdit"))) {
      return res.status(403).json({ message: "Sem permissão para editar contatos." });
    }
    if (!(await loadClientOfTenant(req.params.id, tenantId))) {
      return res.status(404).json({ message: "Contato não encontrado." });
    }

    const author = await db.collection("users").doc(uid).get();
    const note = {
      tenantId,
      clientId: req.params.id,
      text: parsed.data.text,
      authorId: uid,
      authorName: (author.data()?.name as string | undefined) ?? null,
      createdAt: new Date().toISOString(),
    };
    const ref = await db.collection(COLLECTION).add(note);

    return res.status(201).json({
      note: {
        id: ref.id,
        text: note.text,
        authorId: note.authorId,
        authorName: note.authorName,
        createdAt: note.createdAt,
      },
    });
  } catch (error) {
    console.error("createClientNote Error:", error);
    return res.status(500).json({ message: "Erro ao salvar a anotação." });
  }
}

/**
 * DELETE /v1/clients/:id/notes/:noteId
 *
 * Excluir é "Excluir" em Contatos; quem só edita apaga só a própria anotação.
 */
export async function deleteClientNote(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    const canDelete = await hasPagePermission(req.user, "clients", "canDelete");
    if (!canDelete && !(await hasPagePermission(req.user, "clients", "canEdit"))) {
      return res.status(403).json({ message: "Sem permissão para editar contatos." });
    }

    const ref = db.collection(COLLECTION).doc(req.params.noteId);
    const snap = await ref.get();
    const data = snap.data();
    if (!snap.exists || data?.tenantId !== tenantId || data?.clientId !== req.params.id) {
      return res.status(404).json({ message: "Anotação não encontrada." });
    }
    if (!canDelete && data?.authorId !== req.user?.uid) {
      return res.status(403).json({ message: "Você só exclui as anotações que escreveu." });
    }

    await ref.delete();
    return res.json({ success: true });
  } catch (error) {
    console.error("deleteClientNote Error:", error);
    return res.status(500).json({ message: "Erro ao excluir a anotação." });
  }
}
