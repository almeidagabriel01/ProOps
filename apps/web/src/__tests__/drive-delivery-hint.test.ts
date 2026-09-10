import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  DRIVE_DELIVERY_PENDING_HINT,
  DRIVE_NOT_CONNECTED_HINT,
} from "@/lib/proposal-payment";

/**
 * A tela promete um prazo para o PDF chegar ao Drive, e esse prazo não é uma
 * escolha de texto: é o intervalo do cron `processDriveDeliveries`, que hoje
 * roda a cada 3 minutos.
 *
 * O texto e o agendamento vivem em apps diferentes, então nada obriga os dois a
 * andarem juntos. Trocar a cadência do cron (por custo de leitura do Firestore,
 * que foi exatamente a discussão que definiu os 3 minutos) deixaria a tela
 * prometendo um prazo que não existe mais, e o usuário concluindo que a entrega
 * falhou quando ela só estava dentro do novo intervalo.
 */

const CRON = path.resolve(
  __dirname,
  "../../../functions/src/processDriveDeliveries.ts",
);

function minutosDoCron(): number {
  const source = fs.readFileSync(CRON, "utf8");
  const match = source.match(/schedule:\s*"every (\d+) minutes"/);
  if (!match) {
    throw new Error(
      "Nao foi possivel ler o agendamento de processDriveDeliveries. " +
        "Se o formato do `schedule` mudou, ajuste este guard junto.",
    );
  }
  return Number(match[1]);
}

describe("aviso de entrega no Drive", () => {
  it("promete o mesmo prazo que o cron pratica", () => {
    expect(DRIVE_DELIVERY_PENDING_HINT).toContain(`${minutosDoCron()} minutos`);
  });

  it("fala de tempo, nao de vaguidade", () => {
    // "em instantes" mandava a pessoa abrir a pasta, nao achar nada e concluir
    // que falhou.
    expect(DRIVE_DELIVERY_PENDING_HINT).not.toMatch(/em instantes/i);
    expect(DRIVE_DELIVERY_PENDING_HINT).toMatch(/em até \d+ minutos/);
  });

  it("o convite para conectar diz onde conectar", () => {
    expect(DRIVE_NOT_CONNECTED_HINT).toMatch(/Configurações/);
    expect(DRIVE_NOT_CONNECTED_HINT).toMatch(/Google Drive/);
  });

  it("os dois avisos sao distintos", () => {
    // Um promete entrega, o outro diz que ela nao vai acontecer. Trocar um pelo
    // outro num call site seria a pior versao possivel deste aviso.
    expect(DRIVE_DELIVERY_PENDING_HINT).not.toBe(DRIVE_NOT_CONNECTED_HINT);
  });
});
