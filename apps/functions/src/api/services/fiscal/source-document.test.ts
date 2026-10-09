import { isChaveAcessoValida, parseSourceDocumentXml, SOURCE_XML_MAX_LENGTH } from "./source-document";

const AWA = "53967423000141";
const FORNECEDOR = "27133259000167";
const CHAVE = "42251027133259000167550010000123451000123450";

function det(n: number, inner: string): string {
  return `<det nItem="${n}">${inner}</det>`;
}

const ITEM_IPI = det(
  1,
  `<prod><cProd>AMP-5000</cProd><cEAN>SEM GTIN</cEAN><xProd>Amplificador 70V GR 5000 BT</xProd><NCM>85437019</NCM><CFOP>6101</CFOP><uCom>un</uCom><qCom>5.0000</qCom><vUnCom>2090.0000000000</vUnCom><vProd>10450.00</vProd></prod>
   <imposto>
     <ICMS><ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>10450.00</vBC><pICMS>12.00</pICMS><vICMS>1254.00</vICMS></ICMS00></ICMS>
     <IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>10450.00</vBC><pIPI>5.00</pIPI><vIPI>522.50</vIPI></IPITrib></IPI>
   </imposto>`,
);

const ITEM_SIMPLES = det(
  2,
  `<prod><cProd>CX-01</cProd><xProd>Caixa de som 6&quot; &amp; suporte</xProd><NCM>85182100</NCM><CEST>2100100</CEST><CFOP>6102</CFOP><uCom>PC</uCom><qCom>2</qCom><vUnCom>150</vUnCom><vProd>300.00</vProd></prod>
   <imposto><ICMS><ICMSSN102><orig>2</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS><IPI><cEnq>999</cEnq><IPINT><CST>53</CST></IPINT></IPI></imposto>`,
);

function nfeProc(dets: string, options: { dest?: string; emit?: string } = {}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${CHAVE}" versao="4.00">
      <ide><cUF>42</cUF><natOp>Venda de producao do estabelecimento</natOp><mod>55</mod><serie>1</serie><nNF>12345</nNF><dhEmi>2025-10-02T09:15:00-03:00</dhEmi></ide>
      <emit><CNPJ>${options.emit ?? FORNECEDOR}</CNPJ><xNome>Audiofrahm Industria</xNome></emit>
      <dest><CNPJ>${options.dest ?? AWA}</CNPJ><xNome>AWA Servicos de Automacao Ltda</xNome></dest>
      ${dets}
      <total><ICMSTot><vProd>10750.00</vProd><vIPI>522.50</vIPI><vNF>11272.50</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00"><infProt><chNFe>${CHAVE}</chNFe><nProt>142250000012345</nProt></infProt></protNFe>
</nfeProc>`;
}

describe("isChaveAcessoValida", () => {
  it("confere o dígito verificador", () => {
    expect(isChaveAcessoValida(CHAVE)).toBe(true);
    expect(isChaveAcessoValida(`${CHAVE.slice(0, 43)}1`)).toBe(false);
    expect(isChaveAcessoValida(CHAVE.slice(0, 43))).toBe(false);
  });
});

describe("parseSourceDocumentXml", () => {
  it("lê a nota de compra com os itens, impostos e a relação com a empresa", () => {
    const doc = parseSourceDocumentXml(nfeProc(ITEM_IPI + ITEM_SIMPLES), AWA);

    expect(doc).toMatchObject({
      chave: CHAVE,
      numero: "12345",
      serie: "1",
      dataEmissao: "2025-10-02T09:15:00-03:00",
      emitente: { documento: FORNECEDOR, nome: "Audiofrahm Industria" },
      destinatario: { documento: AWA },
      valorTotal: 11272.5,
      relacao: "recebida",
    });
    expect(doc.itens).toEqual([
      {
        numero: 1,
        codigo: "AMP-5000",
        descricao: "Amplificador 70V GR 5000 BT",
        ncm: "85437019",
        cfop: "6101",
        unidade: "UN",
        quantidade: 5,
        valorUnitario: 2090,
        valorTotal: 10450,
        origem: 0,
        icms: { situacao: "00", baseCalculo: 10450, aliquota: 12, valor: 1254 },
        ipi: { cst: "50", baseCalculo: 10450, aliquota: 5, valor: 522.5 },
      },
      {
        numero: 2,
        codigo: "CX-01",
        // Entidades padrão do XML são decodificadas.
        descricao: 'Caixa de som 6" & suporte',
        ncm: "85182100",
        cest: "2100100",
        cfop: "6102",
        unidade: "PC",
        quantidade: 2,
        valorUnitario: 150,
        valorTotal: 300,
        origem: 2,
        icms: { situacao: "102" },
        ipi: { cst: "53" },
      },
    ]);
  });

  it("aceita um item só e o XML sem o protocolo (só o NFe)", () => {
    const semProc = nfeProc(ITEM_SIMPLES)
      .replace(/<nfeProc[^>]*>/, "")
      .replace(/<protNFe[\s\S]*<\/protNFe>/, "")
      .replace("</nfeProc>", "");
    const doc = parseSourceDocumentXml(semProc, AWA);
    expect(doc.chave).toBe(CHAVE);
    expect(doc.itens).toHaveLength(1);
  });

  it("aceita o prefixo de namespace", () => {
    const prefixado = nfeProc(ITEM_SIMPLES).replace(/<(\/?)(\w)/g, "<$1nfe:$2").replace("<nfe:?xml", "<?xml");
    expect(parseSourceDocumentXml(prefixado, AWA).itens[0].codigo).toBe("CX-01");
  });

  it("diz quando a nota foi emitida pela própria empresa ou é de terceiros", () => {
    expect(parseSourceDocumentXml(nfeProc(ITEM_SIMPLES, { emit: AWA, dest: FORNECEDOR }), AWA).relacao).toBe(
      "emitida",
    );
    expect(parseSourceDocumentXml(nfeProc(ITEM_SIMPLES), "11222333000181").relacao).toBe("outra");
  });

  it.each([
    ["DOCTYPE (entidade externa)", `<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]>${nfeProc(ITEM_SIMPLES)}`, "XML_COM_DOCTYPE"],
    ["XML quebrado", "<nfeProc><NFe><infNFe>", "XML_NAO_E_NFE"],
    ["NFS-e", "<CompNfse><Nfse><InfNfse/></Nfse></CompNfse>", "XML_NAO_E_NFE"],
    ["chave adulterada", nfeProc(ITEM_SIMPLES).split(CHAVE).join(`${CHAVE.slice(0, 43)}9`), "XML_CHAVE_INVALIDA"],
    ["nota sem itens", nfeProc(""), "XML_SEM_ITENS"],
    ["arquivo grande demais", "x".repeat(SOURCE_XML_MAX_LENGTH + 1), "XML_GRANDE_DEMAIS"],
  ])("recusa %s", (_caso, xml, erro) => {
    expect(() => parseSourceDocumentXml(xml, AWA)).toThrow(erro);
  });
});
