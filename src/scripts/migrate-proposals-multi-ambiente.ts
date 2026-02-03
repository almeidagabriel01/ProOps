import { ProposalSistema, SistemaProduct } from "../types/automation";

/**
 * MIGRATION SCRIPT REFERENCE
 * 
 * This script demonstrates the logic required to migrate existing proposals in the database
 * from the legacy single-ambiente structure to the new multi-ambiente structure.
 * 
 * Target Transformation:
 * ProposalSistema {
 *   ambienteId: "A1",
 *   products: [P1, P2]
 * }
 * 
 * BECOMES ->
 * 
 * ProposalSistema {
 *   ambientes: [
 *     {
 *       ambienteId: "A1",
 *       products: [P1, P2]
 *     }
 *   ]
 * }
 */

interface LegacyHelper {
  ambienteId?: string;
  ambienteName?: string;
  products?: SistemaProduct[];
}

export function migrateProposalSistema(sistema: ProposalSistema & LegacyHelper): ProposalSistema {
  // If already migrated, return as is
  if (sistema.ambientes && sistema.ambientes.length > 0) {
    return sistema;
  }

  // If it has legacy data, migrate it
  if (sistema.ambienteId || sistema.products?.length) {
    return {
      ...sistema,
      ambientes: [
        {
          ambienteId: sistema.ambienteId || 'unknown',
          ambienteName: sistema.ambienteName || 'Ambiente Desconhecido',
          products: sistema.products || []
        }
      ],
      // Optional: keep legacy fields for a while or remove them depending on strategy
      // ambienteId: undefined,
      // products: undefined
    };
  }

  // If no data, return empty structure
  return {
    ...sistema,
    ambientes: []
  };
}

/**
 * Example usage for a Firestore migration function
 */
/*
async function migrateAllProposals() {
  const proposalsRef = db.collection('proposals');
  const snapshot = await proposalsRef.get();

  const batch = db.batch();
  let counter = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.sistemas) continue;

    const migratedSistemas = data.sistemas.map((sys: any) => migrateProposalSistema(sys));

    batch.update(doc.ref, { sistemas: migratedSistemas });
    counter++;

    if (counter >= 400) {
      await batch.commit();
      counter = 0;
    }
  }

  if (counter > 0) await batch.commit();
}
*/
