import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import path from "path";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

/**
 * `calendar_events` é a coleção mais sutil das regras e não tinha teste nenhum.
 *
 * O calendário é UM calendário do tenant: o master conecta a conta Google da
 * empresa e todo membro com acesso ao Calendário vê os mesmos dados, com o que
 * um marca aparecendo para os outros. A regra restringia o membro aos eventos
 * de que ele era dono (`ownerUserId == uid`) enquanto
 * `GET /v1/calendar/events` sempre devolveu o tenant inteiro — as duas camadas
 * discordavam sobre o modelo do produto.
 *
 * Quem pode ver o Calendário é decidido pela permissão `calendar` na tela de
 * Equipe, que a API cobra. Aqui a regra é de tenant, como nas outras coleções.
 */

let testEnv: RulesTestEnvironment;

const ALPHA = "tenant-alpha";
const BETA = "tenant-beta";

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-proops-calendar",
    firestore: {
      rules: readFileSync(
        path.resolve(__dirname, "../../firebase/firestore.rules"),
        "utf8",
      ),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await setDoc(doc(db, "tenants", ALPHA), {
      name: "Alpha",
      subscriptionStatus: "active",
    });
    await setDoc(doc(db, "tenants", BETA), {
      name: "Beta",
      subscriptionStatus: "active",
    });

    // Evento criado pelo MASTER do tenant alpha
    await setDoc(doc(db, "calendar_events", "ev-master"), {
      tenantId: ALPHA,
      ownerUserId: "master-alpha",
      title: "Visita técnica",
      startMs: 1,
      endMs: 2,
    });

    // Evento criado por OUTRO membro do tenant alpha
    await setDoc(doc(db, "calendar_events", "ev-colega"), {
      tenantId: ALPHA,
      ownerUserId: "member-outro",
      title: "Instalação",
      startMs: 3,
      endMs: 4,
    });

    // Evento de outro tenant
    await setDoc(doc(db, "calendar_events", "ev-beta"), {
      tenantId: BETA,
      ownerUserId: "master-beta",
      title: "Reunião Beta",
      startMs: 5,
      endMs: 6,
    });
  });
});

function memberAlpha() {
  return testEnv
    .authenticatedContext("member-alpha", {
      role: "MEMBER",
      tenantId: ALPHA,
      masterId: "master-alpha",
      subscriptionStatus: "active",
    })
    .firestore();
}

function masterAlpha() {
  return testEnv
    .authenticatedContext("master-alpha", {
      role: "MASTER",
      tenantId: ALPHA,
      subscriptionStatus: "active",
    })
    .firestore();
}

describe("calendário compartilhado do tenant", () => {
  it("membro lê o evento do master — é o mesmo calendário", async () => {
    await assertSucceeds(
      getDoc(doc(memberAlpha(), "calendar_events", "ev-master")),
    );
  });

  it("membro lê o evento de um colega", async () => {
    await assertSucceeds(
      getDoc(doc(memberAlpha(), "calendar_events", "ev-colega")),
    );
  });

  it("master lê evento criado por um membro", async () => {
    await assertSucceeds(
      getDoc(doc(masterAlpha(), "calendar_events", "ev-colega")),
    );
  });
});

describe("isolamento entre empresas", () => {
  it("membro do alpha NÃO lê evento do beta", async () => {
    await assertFails(
      getDoc(doc(memberAlpha(), "calendar_events", "ev-beta")),
    );
  });

  it("master do alpha NÃO lê evento do beta", async () => {
    await assertFails(
      getDoc(doc(masterAlpha(), "calendar_events", "ev-beta")),
    );
  });

  it("anônimo não lê nada", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "calendar_events", "ev-master")));
  });
});

describe("escrita é exclusiva das Cloud Functions", () => {
  it("membro não cria evento pelo SDK", async () => {
    await assertFails(
      setDoc(doc(memberAlpha(), "calendar_events", "novo"), {
        tenantId: ALPHA,
        ownerUserId: "member-alpha",
        title: "Direto no Firestore",
      }),
    );
  });

  it("master não edita evento pelo SDK", async () => {
    await assertFails(
      setDoc(doc(masterAlpha(), "calendar_events", "ev-master"), {
        tenantId: ALPHA,
        title: "Alterado",
      }),
    );
  });

  it("master não apaga evento pelo SDK", async () => {
    await assertFails(
      deleteDoc(doc(masterAlpha(), "calendar_events", "ev-master")),
    );
  });
});
