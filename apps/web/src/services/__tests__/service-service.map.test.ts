import { describe, expect, it, vi } from "vitest";

// O módulo importa a instância do Firebase no topo; o mapeamento em si é puro.
vi.mock("@/lib/firebase", () => ({ db: {} }));

import { mapServiceDoc } from "../service-service";

/**
 * O mapeamento de serviço é **explícito** — diferente do de produto e do de
 * cliente, que usam `...data` e deixam campo novo passar sozinho. Aqui, campo
 * que não estiver listado some em silêncio.
 *
 * Foi o que aconteceu com os campos fiscais: eles eram gravados corretamente,
 * mas `getServiceById` tinha uma **segunda cópia** deste mapeamento, sem eles.
 * Salvar funcionava; reabrir o cadastro mostrava tudo vazio, sem erro nenhum.
 */

const snapshot = (data: Record<string, unknown>) =>
  ({ id: "svc-1", data: () => data }) as never;

describe("mapServiceDoc", () => {
  it("preserva os campos fiscais", () => {
    const service = mapServiceDoc(
      snapshot({
        tenantId: "t1",
        name: "Instalação",
        codigoLc116: "31.01",
        codigoTributacaoNacional: "310102",
        aliquotaIss: 0,
      }),
    );

    expect(service.codigoLc116).toBe("31.01");
    expect(service.codigoTributacaoNacional).toBe("310102");
    // Zero é alíquota válida no Simples Nacional — tratá-lo como ausente
    // esvaziaria o campo do primeiro emitente real toda vez que ele reabrisse.
    expect(service.aliquotaIss).toBe(0);
  });

  it("deixa os fiscais indefinidos quando o documento não os tem", () => {
    const service = mapServiceDoc(snapshot({ tenantId: "t1", name: "Serviço" }));

    expect(service.codigoLc116).toBeUndefined();
    expect(service.aliquotaIss).toBeUndefined();
  });

  it("ignora alíquota que não seja número", () => {
    const service = mapServiceDoc(
      snapshot({ tenantId: "t1", name: "X", aliquotaIss: "3" }),
    );
    expect(service.aliquotaIss).toBeUndefined();
  });

  it("aceita snapshot sem dados sem quebrar", () => {
    expect(mapServiceDoc({ id: "svc-1", data: () => undefined } as never).id).toBe(
      "svc-1",
    );
  });
});
