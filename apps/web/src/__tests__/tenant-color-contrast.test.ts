import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A cor da empresa (`tenant.primaryColor`) é escolhida livremente, e nada
 * impede que seja preto ou branco. Pintada crua na tela do ERP ela some: preto
 * sobre o tema escuro, branco sobre o tema claro. Foi o que aconteceu no
 * formulário de proposta com uma empresa em #0a0a0a — título da solução, tag do
 * ambiente e "Valor Final" ficaram ilegíveis.
 *
 * Tela lê a cor por `useThemePrimaryColor()` (ou `useThemeAdjustedColor(cor)`
 * quando a cor não é a do tenant logado), e texto sobre um fundo da cor usa
 * `computePrimaryForeground(fundo)`, nunca `text-white` fixo.
 *
 * O PDF é a exceção legítima: ele é impresso em papel branco e precisa da cor
 * exata da marca. Formulários que editam a cor e as amostras também leem crua.
 */

const SRC = path.resolve(__dirname, "..");

/** Quem pode ler a cor crua, e por quê. */
const RAW_COLOR_ALLOWLIST = [
  "components/pdf/", // documento impresso em papel branco
  "providers/tenant-provider.tsx", // gera --primary já ajustado por tema
  "hooks/useThemePrimaryColor.ts", // o próprio ajuste
  "services/", // leitura e gravação do dado
  "components/profile/organization-form.tsx", // formulário da cor
  "components/admin/tenant-dialog.tsx", // formulário da cor (superadmin)
  "app/admin/_utils/tenant-save-plan.ts", // diff do formulário
  "app/admin/_components/tenant-card.tsx", // passa por useThemeAdjustedColor
  "app/share/", // botão com fundo da marca e texto calculado
  "app/proposals/[id]/view/page.tsx", // template do PDF
  "app/proposals/[id]/edit-pdf/page.tsx", // amostra da cor da empresa
  "components/features/proposal/edit-pdf/use-edit-pdf-page.ts", // cor do documento
  "components/features/proposal/pdf-generator.tsx", // cor do documento
  "components/features/proposal/template/template-preview.tsx", // prévia do documento
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(full, out);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function rel(file: string): string {
  return path.relative(SRC, file).split(path.sep).join("/");
}

describe("cor da empresa com contraste na tela", () => {
  it("só a allowlist lê tenant.primaryColor cru", () => {
    const infratores = walk(SRC)
      .filter((file) => {
        const r = rel(file);
        return !RAW_COLOR_ALLOWLIST.some((allowed) => r.startsWith(allowed));
      })
      .filter((file) =>
        /\btenant(Data)?\??\.primaryColor\b/.test(fs.readFileSync(file, "utf8")),
      )
      .map(rel);

    expect(infratores).toEqual([]);
  });

  /**
   * `--primary` guarda hex ou oklch, não um trio HSL, então
   * `hsl(var(--primary))` é CSS inválido e a declaração inteira é descartada.
   */
  it("ninguém embrulha as variáveis de cor em hsl()", () => {
    const infratores = walk(SRC)
      .filter((file) =>
        /hsl\(var\(--(primary|primary-foreground)\)\)/.test(
          fs.readFileSync(file, "utf8"),
        ),
      )
      .map(rel);

    expect(infratores).toEqual([]);
  });
});
