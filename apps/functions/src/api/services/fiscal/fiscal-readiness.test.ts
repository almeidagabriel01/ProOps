import {
  checkIssueReadiness,
  checkIssuerReadinessForType,
  checkProductReadiness,
  checkRecipientReadiness,
  checkServiceReadiness,
  type IssuerReadinessInput,
  type RecipientReadinessInput,
} from "./fiscal-readiness";

const issuer: IssuerReadinessInput = {
  cnpj: "12345678000123",
  razaoSocial: "Automacao Residencial Ltda",
  inscricaoEstadual: "1234567",
  inscricaoMunicipal: "98765",
  regimeTributario: 1,
  percentualTotalTributosSimplesNacional: 6,
  endereco: {
    logradouro: "Rua Joao da Silva",
    numero: "153",
    bairro: "Vila Isabel",
    municipio: "Curitiba",
    codigoIbge: "4106902",
    uf: "PR",
    cep: "80210000",
  },
};

const recipient: RecipientReadinessInput = {
  id: "cli-1",
  nome: "Maria Compradora",
  documento: "98765432100",
  indicadorIe: "nao_contribuinte",
  endereco: {
    logradouro: "Av das Cortinas",
    numero: "1000",
    bairro: "Centro",
    municipio: "Sao Paulo",
    codigoIbge: "3550308",
    uf: "SP",
    cep: "01310100",
  },
};

const fieldsOf = (gaps: Array<{ field: string }>) => gaps.map((g) => g.field);

describe("checkIssuerReadinessForType", () => {
  it("aprova um emitente completo", () => {
    expect(checkIssuerReadinessForType(issuer, "nfe")).toHaveLength(0);
    expect(checkIssuerReadinessForType(issuer, "nfse")).toHaveLength(0);
  });

  it("exige inscrição estadual só para NF-e", () => {
    const semIe = { ...issuer, inscricaoEstadual: "" };
    expect(fieldsOf(checkIssuerReadinessForType(semIe, "nfe"))).toContain("inscricaoEstadual");
    expect(fieldsOf(checkIssuerReadinessForType(semIe, "nfse"))).not.toContain(
      "inscricaoEstadual",
    );
  });

  it("exige inscrição municipal só para NFS-e", () => {
    const semIm = { ...issuer, inscricaoMunicipal: "" };
    expect(fieldsOf(checkIssuerReadinessForType(semIm, "nfse"))).toContain(
      "inscricaoMunicipal",
    );
    expect(fieldsOf(checkIssuerReadinessForType(semIm, "nfe"))).not.toContain(
      "inscricaoMunicipal",
    );
  });

  it("cobra o código IBGE do emitente", () => {
    const gaps = checkIssuerReadinessForType(
      { ...issuer, endereco: { ...issuer.endereco, codigoIbge: "" } },
      "nfe",
    );
    expect(fieldsOf(gaps)).toContain("endereco.codigoIbge");
  });

  it("reporta todas as lacunas de uma vez, não só a primeira", () => {
    // A UI mostra uma checklist completa; parar no primeiro erro faria o
    // usuário descobrir os problemas um a um.
    const gaps = checkIssuerReadinessForType(
      { cnpj: "", razaoSocial: "", regimeTributario: undefined, endereco: undefined },
      "nfe",
    );
    expect(gaps.length).toBeGreaterThanOrEqual(4);
    expect(fieldsOf(gaps)).toEqual(
      expect.arrayContaining(["cnpj", "razaoSocial", "regimeTributario", "endereco"]),
    );
  });
});

describe("alíquota do Simples na NFS-e", () => {
  it("cobra o percentual de ME/EPP emitindo nota de serviço", () => {
    // Sem ele a DPS sai sem `totTrib` válido e volta com E0712 — uma sigla,
    // minutos depois, longe do campo que resolve.
    const semPercentual = { ...issuer };
    delete semPercentual.percentualTotalTributosSimplesNacional;

    const gaps = checkIssuerReadinessForType(semPercentual, "nfse");

    expect(gaps.map((gap) => gap.field)).toContain(
      "percentualTotalTributosSimplesNacional",
    );
  });

  it("aceita zero — 0% é uma alíquota informada", () => {
    const gaps = checkIssuerReadinessForType(
      { ...issuer, percentualTotalTributosSimplesNacional: 0 },
      "nfse",
    );

    expect(gaps).toHaveLength(0);
  });

  it("não cobra na NF-e — a regra é do Ambiente Nacional, não da SEFAZ", () => {
    const semPercentual = { ...issuer, inscricaoEstadual: "123456789" };
    delete semPercentual.percentualTotalTributosSimplesNacional;

    const gaps = checkIssuerReadinessForType(semPercentual, "nfe");

    expect(gaps.map((gap) => gap.field)).not.toContain(
      "percentualTotalTributosSimplesNacional",
    );
  });

  it("não cobra de quem não é do Simples — lá vale o indicador", () => {
    const regimeNormal = { ...issuer, regimeTributario: 3 as const };
    delete regimeNormal.percentualTotalTributosSimplesNacional;

    expect(checkIssuerReadinessForType(regimeNormal, "nfse")).toHaveLength(0);
  });

  it("não cobra de MEI", () => {
    const mei = { ...issuer, regimeTributario: 4 as const };
    delete mei.percentualTotalTributosSimplesNacional;

    expect(checkIssuerReadinessForType(mei, "nfse")).toHaveLength(0);
  });
});

describe("checkRecipientReadiness", () => {
  it("aprova um destinatário completo", () => {
    expect(checkRecipientReadiness(recipient, "nfe")).toHaveLength(0);
  });

  it('recusa pessoa física marcada como "isento" — rejeição 805', () => {
    // A SEFAZ do destinatário recusa "contribuinte isento" para quem
    // simplesmente não é contribuinte de ICMS.
    const gaps = checkRecipientReadiness({ ...recipient, indicadorIe: "isento" }, "nfe");
    expect(fieldsOf(gaps)).toContain("indicadorIe");
    expect(gaps[0].message).toContain("não contribuinte");
  });

  it("aceita isento para pessoa jurídica", () => {
    const gaps = checkRecipientReadiness(
      { ...recipient, documento: "11222333000181", indicadorIe: "isento" },
      "nfe",
    );
    expect(fieldsOf(gaps)).not.toContain("indicadorIe");
  });

  it("exige inscrição estadual de quem foi marcado como contribuinte", () => {
    const gaps = checkRecipientReadiness(
      { ...recipient, documento: "11222333000181", indicadorIe: "contribuinte" },
      "nfe",
    );
    expect(fieldsOf(gaps)).toContain("inscricaoEstadual");
  });

  it("exige endereço para NF-e mas não para NFS-e", () => {
    // NF-e documenta entrega física e a SEFAZ valida o destino contra a
    // tabela do IBGE; NFS-e é bem mais permissiva.
    const semEndereco = { ...recipient, endereco: undefined };
    expect(fieldsOf(checkRecipientReadiness(semEndereco, "nfe"))).toContain("endereco");
    expect(checkRecipientReadiness(semEndereco, "nfse")).toHaveLength(0);
  });

  it("recusa documento que não é CPF nem CNPJ", () => {
    expect(fieldsOf(checkRecipientReadiness({ ...recipient, documento: "123" }, "nfse"))).toContain(
      "documento",
    );
  });

  it("identifica o cliente na lacuna para a UI poder linkar", () => {
    const gaps = checkRecipientReadiness({ ...recipient, nome: "" }, "nfse");
    expect(gaps[0].entityId).toBe("cli-1");
    expect(gaps[0].scope).toBe("cliente");
  });
});

describe("checkProductReadiness", () => {
  it("aprova produto com NCM de 8 dígitos, com ou sem pontuação", () => {
    expect(
      checkProductReadiness([{ id: "p1", name: "Cortina", ncm: "6303.92.00" }]),
    ).toHaveLength(0);
  });

  it("cobra NCM ausente e sugere onde encontrá-lo", () => {
    // O NCM vem na nota de entrada do fornecedor — dizer isso economiza uma
    // ligação para o contador.
    const gaps = checkProductReadiness([{ id: "p1", name: "Cortina motorizada" }]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].field).toBe("ncm");
    expect(gaps[0].message).toContain("Cortina motorizada");
    expect(gaps[0].message).toContain("fornecedor");
  });

  it("distingue NCM ausente de NCM malformado", () => {
    const gaps = checkProductReadiness([{ id: "p1", name: "Motor", ncm: "1234" }]);
    expect(gaps[0].message).toContain("8 dígitos");
    expect(gaps[0].message).not.toContain("fornecedor");
  });

  it("reporta um item por produto incompleto", () => {
    const gaps = checkProductReadiness([
      { id: "p1", name: "Cortina", ncm: "63039200" },
      { id: "p2", name: "Motor" },
      { id: "p3", name: "Trilho" },
    ]);
    expect(gaps).toHaveLength(2);
    expect(gaps.map((g) => g.entityId)).toEqual(["p2", "p3"]);
  });
});

describe("checkServiceReadiness", () => {
  it("aprova serviço com código, alíquota e tributação nacional", () => {
    expect(
      checkServiceReadiness({
        id: "s1",
        name: "Instalacao",
        codigoLc116: "31.01",
        aliquotaIss: 3,
        codigoTributacaoNacional: "310102",
      }),
    ).toHaveLength(0);
  });

  it("aceita alíquota zero", () => {
    // Zero é válido em alguns municípios e regimes — no Simples Nacional o ISS
    // sai no DAS e a nota vem sem alíquota. Tratá-lo como ausente bloquearia
    // emissão legítima, e é o caso do primeiro emitente real do módulo.
    expect(
      checkServiceReadiness({
        id: "s1",
        name: "Instalacao",
        codigoLc116: "31.01",
        aliquotaIss: 0,
        codigoTributacaoNacional: "310102",
      }),
    ).toHaveLength(0);
  });

  it("cobra o código de tributação nacional no padrão nacional", () => {
    // Não dá para derivar do item da LC 116: o código nacional tem um desdobro
    // que a lista antiga não carrega (31.01 sozinho não diz se é .01 ou .02).
    const gaps = checkServiceReadiness({
      id: "s1",
      name: "Instalacao",
      codigoLc116: "31.01",
      aliquotaIss: 3,
    });
    expect(fieldsOf(gaps)).toEqual(["codigoTributacaoNacional"]);
  });

  it("não cobra o código nacional no padrão municipal", () => {
    expect(
      checkServiceReadiness(
        { id: "s1", name: "Instalacao", codigoLc116: "14.06", aliquotaIss: 3 },
        "municipal",
      ),
    ).toHaveLength(0);
  });

  it("cobra código LC 116 e alíquota quando faltam", () => {
    const gaps = checkServiceReadiness({ id: "s1", name: "Instalacao" }, "municipal");
    expect(fieldsOf(gaps)).toEqual(["codigoLc116", "aliquotaIss"]);
  });

  it("recusa alíquota fora da faixa", () => {
    expect(
      fieldsOf(
        checkServiceReadiness({ id: "s1", codigoLc116: "14.06", aliquotaIss: 150 }),
      ),
    ).toContain("aliquotaIss");
  });
});

describe("checkIssueReadiness", () => {
  it("libera uma NF-e completa", () => {
    const report = checkIssueReadiness({
      type: "nfe",
      issuer,
      recipient,
      products: [{ id: "p1", name: "Cortina", ncm: "63039200" }],
    });
    expect(report).toEqual({ ready: true, gaps: [] });
  });

  it("bloqueia NF-e sem itens", () => {
    const report = checkIssueReadiness({ type: "nfe", issuer, recipient, products: [] });
    expect(report.ready).toBe(false);
    expect(fieldsOf(report.gaps)).toContain("items");
  });

  it("bloqueia NFS-e sem serviço descrito", () => {
    const report = checkIssueReadiness({ type: "nfse", issuer, recipient });
    expect(report.ready).toBe(false);
    expect(fieldsOf(report.gaps)).toContain("servico");
  });

  it("agrega lacunas de emitente, cliente e itens numa checklist só", () => {
    const report = checkIssueReadiness({
      type: "nfe",
      issuer: { ...issuer, inscricaoEstadual: "" },
      recipient: { ...recipient, endereco: undefined },
      products: [{ id: "p1", name: "Cortina" }],
    });

    expect(report.ready).toBe(false);
    const scopes = new Set(report.gaps.map((g) => g.scope));
    expect(scopes).toEqual(new Set(["emitente", "cliente", "produto"]));
  });

  it("ordena emitente antes de cliente e cliente antes de itens", () => {
    // É a ordem em que o usuário consegue resolver: configura a empresa uma
    // vez, depois o cliente, depois o catálogo.
    const report = checkIssueReadiness({
      type: "nfe",
      issuer: { ...issuer, razaoSocial: "" },
      recipient: { ...recipient, nome: "" },
      products: [{ id: "p1", name: "Cortina" }],
    });

    expect(report.gaps.map((g) => g.scope)).toEqual(["emitente", "cliente", "produto"]);
  });

  it("libera NFS-e sem endereço do cliente", () => {
    const report = checkIssueReadiness({
      type: "nfse",
      issuer,
      recipient: { ...recipient, endereco: undefined },
      service: {
        id: "s1",
        name: "Instalacao",
        codigoLc116: "31.01",
        aliquotaIss: 3,
        codigoTributacaoNacional: "310102",
      },
    });
    expect(report.ready).toBe(true);
  });
});
