/**
 * One-shot opcional: libera a tela de Tarefas para os membros que já existiam
 * quando ela nasceu.
 *
 * Membro novo recebe `users/{uid}/permissions/tasks` pelo preset da tela de
 * Equipe. Os antigos não têm o documento, e membro sem documento é negado:
 * até o dono marcar um por um, ninguém da equipe pode receber tarefa (o
 * responsável precisa abrir a tela). Este script grava o documento para quem
 * ainda não tem, com ver, criar, editar e excluir; excluir continua valendo
 * só para as tarefas que a própria pessoa criou.
 *
 * Quem já tem o documento (o dono marcou algo, inclusive "não") é pulado.
 *
 * Run manually (dry-run por padrão):
 *   cd apps/functions
 *   npx tsx src/scripts/grant-tasks-permission.ts
 *   npx tsx src/scripts/grant-tasks-permission.ts --apply
 */
import { db } from "../init";

const PAGE_SIZE = 300;
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  console.log(`--- grant-tasks-permission (${APPLY ? "APLICANDO" : "dry-run"}) ---`);

  let members = 0;
  let granted = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  for (;;) {
    let query = db.collection("users").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      if (String(doc.data().role || "").toUpperCase() !== "MEMBER") continue;
      members += 1;
      const ref = doc.ref.collection("permissions").doc("tasks");
      if ((await ref.get()).exists) continue;
      if (APPLY) {
        await ref.set({ canView: true, canCreate: true, canEdit: true, canDelete: true });
      }
      granted += 1;
    }

    if (snap.size < PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1];
  }

  console.log(`membros=${members} ${APPLY ? "liberados" : "a liberar"}=${granted}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
