import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ler carteira pelo SDK exige ver o financeiro.
 *
 * As rules de `wallets` deixam ler o documento (que traz o SALDO) só quem tem
 * "Ver" em Lançamentos ou em Carteiras. Até 2026-10 qualquer membro lia, e o
 * seletor de carteira da proposta e o do contrato usavam isso: um vendedor ou
 * um técnico sem acesso ao financeiro carregava o saldo de todas as carteiras
 * para montar uma proposta.
 *
 * Tela que só precisa ESCOLHER uma carteira usa `useWalletOptions()` (ou
 * `WalletService.getWalletOptions()`), que passa pela API e devolve só o nome.
 * Ler a carteira inteira fica nas telas abaixo, todas atrás da permissão do
 * financeiro. Para acrescentar uma, confira que ela só abre para quem vê
 * Lançamentos ou Carteiras.
 */

const WEB_SRC = path.resolve(__dirname, "..");

const FULL_WALLET_READ = /\bWalletService\.(getWallets|getWalletById|getSummary)\s*\(|\buseWalletsData\s*\(/;

const ALLOWED_PREFIXES = [
  "app/wallets/",
  "app/transactions/",
  "app/cash-flow/",
  "services/wallet-service.ts",
  // Cards financeiros: só buscam com "Ver" em Lançamentos ou Carteiras.
  "hooks/useDashboardData.ts",
  // Modal do lançamento no CRM: a aba só abre com "Ver" em Lançamentos.
  "hooks/useWalletLabel.ts",
  // Lançar a OS no financeiro exige criar lançamento.
  "app/service-orders/_components/launch-transaction-dialog.tsx",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("leitura da carteira inteira só onde o financeiro já é exigido", () => {
  it("nenhuma tela fora da lista lê a carteira pelo SDK", () => {
    const offenders = walk(WEB_SRC)
      .map((file) => path.relative(WEB_SRC, file).split(path.sep).join("/"))
      .filter((rel) => !ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix)))
      .filter((rel) => FULL_WALLET_READ.test(fs.readFileSync(path.join(WEB_SRC, rel), "utf8")));

    expect(offenders).toEqual([]);
  });

  it("os seletores da proposta e do contrato usam as opções sem saldo", () => {
    for (const rel of [
      "components/features/wallet-select.tsx",
      "hooks/proposal/useProposalForm.core.ts",
      "components/features/field-service/contract-form.tsx",
    ]) {
      const source = fs.readFileSync(path.join(WEB_SRC, rel), "utf8");
      expect(source, rel).toMatch(/useWalletOptions\(|getWalletOptions\(/);
    }
  });
});
