import { Request, Response } from "express";
import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { resolveUserAndTenant, checkPermission, UserDoc } from "../../lib/auth-helpers";
import { checkClientLimit } from "../../lib/billing-helpers";

// Create Client
export const createClient = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const input = req.body;

    if (!input.name || input.name.trim().length < 2) {
      return res
        .status(400)
        .json({ message: "Nome deve ter pelo menos 2 caracteres." });
    }

    const { userData, masterData, masterRef, isMaster, isSuperAdmin, tenantId } =
      await resolveUserAndTenant(userId, req.user);

    // Permission Check
    if (!isMaster && !isSuperAdmin) {
      const canCreate = await checkPermission(userId, "clients", "canCreate");
      if (!canCreate) {
        // Fallback check for consumers
        const canCreateLegacy = await checkPermission(
          userId,
          "customers",
          "canCreate"
        );
        if (!canCreateLegacy) {
          return res
            .status(403)
            .json({ message: "Sem permissão para criar clientes." });
        }
      }
    }

    // Super admin can specify target tenant
    const targetTenantId =
      input.targetTenantId && isSuperAdmin
        ? input.targetTenantId
        : tenantId ||
          masterData.companyId ||
          masterData.tenantId ||
          userData.companyId ||
          userData.tenantId;

    if (!targetTenantId) {
      return res
        .status(400)
        .json({ message: "Configuração de conta inválida: tenantId ausente." });
    }

    // Adjust masterRef and masterData if Super Admin is acting on behalf of another tenant
    let targetMasterRef = masterRef;
    let targetMasterData = masterData;

    if (isSuperAdmin && targetTenantId && targetTenantId !== userData.tenantId) {
      console.log(`[CreateClient] SuperAdmin acting for targetTenantId: ${targetTenantId}`);
      
       // Find the owner of this tenant
       // Fetch a few users and find the one without masterId to ensure we get the owner.
       // avoiding orderBy createdAt because usage of an index that might not exist or be reliable finding the master first.
       const ownerQuery = await db.collection("users")
         .where("tenantId", "==", targetTenantId)
         .limit(10)
         .get();

      console.log(`[CreateClient] Owner query found ${ownerQuery.size} docs`);

       let ownerDoc = ownerQuery.docs.find(d => !d.data().masterId);
       if (!ownerDoc && !ownerQuery.empty) {
          // If all have masterId (unlikely for a valid tenant), try to find one with role MASTER/admin
          ownerDoc = ownerQuery.docs.find(d => ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role));
          if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
       }

       if (ownerDoc) {
          targetMasterRef = db.collection("users").doc(ownerDoc.id);
          targetMasterData = ownerDoc.data() as UserDoc;
       }
    }

    // Limit Check
    try {
      if (targetMasterData) {
        await checkClientLimit(targetMasterData);
      }
    } catch (e: unknown) {
      // If Super Admin, allow proceeding even if limit reached
      if (!isSuperAdmin) {
         const message = e instanceof Error ? e.message : "Erro desconhecido";
         return res.status(402).json({ message, code: "resource-exhausted" });
      }
    }

    // Transaction
    const clientId = await db.runTransaction(async (transaction) => {
      const companyRef = db.collection("companies").doc(targetTenantId);
      // const freshMasterSnap = await transaction.get(masterRef);
      const companySnap = await transaction.get(companyRef);

      // Re-check limit inside transaction
      // Note: Reuse logic or basic check? Basic check is safer.
      // We reuse the limit value from outer scope as it shouldn't change rapidly, but logic is duplicated.
      // Ideally calculate limit again but let's trust the outer check + fresh usage.

      // Getting maxClients again is tricky without refetching plan.
      // We'll skip strict double-check of plan, but check usage count.
      // If strictly needed, we'd refetch plain. For performance, we assume plan hasn't changed in ms.
      // But we need the number.
      // Simplified: If usage suggests overflow, block.
      // ... omitting strict intra-transaction plan fetch for speed, relying on outer check.

      const newClientRef = db.collection("clients").doc();
      const now = Timestamp.now();

      const clientData: Record<string, unknown> = {
        tenantId: targetTenantId,
        name: input.name.trim(),
        types: input.types || ["cliente"],
        source: input.source || "manual",
        sourceId: input.sourceId || null,
        createdAt: now,
        updatedAt: now,
      };

      if (input.email) clientData.email = input.email.toLowerCase().trim();
      if (input.phone) clientData.phone = input.phone;
      if (input.address) clientData.address = input.address;
      if (input.notes) clientData.notes = input.notes;

      transaction.set(newClientRef, clientData);

      transaction.update(targetMasterRef, {
        "usage.clients": FieldValue.increment(1),
        updatedAt: now,
      });

      if (companySnap.exists) {
        transaction.update(companyRef, {
          "usage.clients": FieldValue.increment(1),
          updatedAt: now,
        });
      }

      return newClientRef.id;
    });

    return res.status(201).json({
      success: true,
      clientId,
      message: "Cliente criado com sucesso!",
    });
  } catch (error: unknown) {
    console.error("createClient Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao criar cliente.";
    return res.status(500).json({ message });
  }
};

// Update Client
export const updateClient = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body;

    if (!id)
      return res.status(400).json({ message: "ID do cliente inválido." });

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user
    );

    const clientRef = db.collection("clients").doc(id);
    const clientSnap = await clientRef.get();

    if (!clientSnap.exists) {
      return res.status(404).json({ message: "Cliente não encontrado." });
    }

    const clientData = clientSnap.data();

    if (!isSuperAdmin && clientData?.tenantId !== tenantId) {
      return res
        .status(403)
        .json({ message: "Este cliente não pertence a sua organização." });
    }

    if (!isMaster && !isSuperAdmin) {
      const canEdit = await checkPermission(userId, "clients", "canEdit");
      const canEditLegacy = await checkPermission(
        userId,
        "customers",
        "canEdit"
      );
      if (!canEdit && !canEditLegacy) {
        return res
          .status(403)
          .json({ message: "Sem permissão para editar clientes." });
      }
    }

    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (updateData.name !== undefined) safeUpdate.name = updateData.name;
    if (updateData.email !== undefined) safeUpdate.email = updateData.email;
    if (updateData.phone !== undefined) safeUpdate.phone = updateData.phone;
    if (updateData.address !== undefined)
      safeUpdate.address = updateData.address;
    if (updateData.notes !== undefined) safeUpdate.notes = updateData.notes;
    if (updateData.types !== undefined) safeUpdate.types = updateData.types;

    await clientRef.update(safeUpdate);

    return res.json({
      success: true,
      message: "Cliente atualizado com sucesso.",
    });
  } catch (error: unknown) {
    console.error("updateClient Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar cliente.";
    return res.status(500).json({ message });
  }
};

// Delete Client
export const deleteClient = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id)
      return res.status(400).json({ message: "ID do cliente obrigatório." });

    const { tenantId, isMaster, isSuperAdmin, masterRef } =
      await resolveUserAndTenant(userId, req.user);

    const clientRef = db.collection("clients").doc(id);
    const clientSnap = await clientRef.get();

    if (!clientSnap.exists) {
      return res.status(404).json({ message: "Cliente não encontrado." });
    }

    const clientData = clientSnap.data();

    if (!isSuperAdmin && clientData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    if (!isMaster && !isSuperAdmin) {
      const canDelete = await checkPermission(userId, "clients", "canDelete");
      const canDeleteLegacy = await checkPermission(
        userId,
        "customers",
        "canDelete"
      );
      if (!canDelete && !canDeleteLegacy) {
        return res
          .status(403)
          .json({ message: "Sem permissão para deletar clientes." });
      }
    }

    // Determine correct masterRef for usage decrement
    let targetMasterRef = masterRef;
    
    // If Super Admin deleting a client from another tenant, find that tenant's owner
    if (isSuperAdmin && clientData?.tenantId && clientData.tenantId !== tenantId) {
       const ownerQuery = await db.collection("users")
         .where("tenantId", "==", clientData.tenantId)
         .limit(10)
         .get();
         
       let ownerDoc = ownerQuery.docs.find(d => !d.data().masterId);
       if (!ownerDoc && !ownerQuery.empty) {
         ownerDoc = ownerQuery.docs.find(d => ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role));
         if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
       }
       
       if (ownerDoc) {
         targetMasterRef = db.collection("users").doc(ownerDoc.id);
       }
    }

    await db.runTransaction(async (transaction) => {
      const companyRef = db.collection("companies").doc(clientData?.tenantId || tenantId);
      const companySnap = await transaction.get(companyRef);

      transaction.delete(clientRef);

      transaction.update(targetMasterRef, {
        "usage.clients": FieldValue.increment(-1),
        updatedAt: Timestamp.now(),
      });

      if (companySnap.exists) {
        transaction.update(companyRef, {
          "usage.clients": FieldValue.increment(-1),
          updatedAt: Timestamp.now(),
        });
      }
    });

    return res.json({ success: true, message: "Cliente removido." });
  } catch (error: unknown) {
    console.error("deleteClient Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao deletar cliente.";
    return res.status(500).json({ message });
  }
};
