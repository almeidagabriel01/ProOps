"use client";

import * as React from "react";
import { Hash, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import {
  buildProposalCodePreview,
  normalizePraca,
} from "@/lib/proposal-numbering";
import {
  ProposalNumberingService,
  type ProposalNumberingConfig,
} from "@/services/proposal-numbering-service";

interface ProposalNumberingCardProps {
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Configuração da numeração de proposta.
 *
 * A tela existe porque o formato é de UMA empresa, não do produto: quem pediu
 * usa `0018926SP_casa_do_mauricio`, e quem não pediu não pode ganhar um código
 * no título sem escolher. Por isso a chave-mestra nasce desligada e nada
 * aparece na proposta enquanto ela estiver assim.
 *
 * O campo perigoso é o "próximo número". Ele é editável de propósito, porque
 * quem já emitia propostas fora do ERP precisa continuar a sequência dele — e
 * é justamente por ser editável que a tela avisa que voltar atrás repete um
 * código já entregue a um cliente.
 */
export function ProposalNumberingCard({
  onLoadingChange,
}: ProposalNumberingCardProps) {
  const [config, setConfig] = React.useState<ProposalNumberingConfig | null>(
    null,
  );
  const [novaPraca, setNovaPraca] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const atual = await ProposalNumberingService.get();
        if (ativo) setConfig(atual);
      } catch {
        if (ativo) {
          toast.error("Não foi possível carregar a numeração das propostas.");
        }
      } finally {
        if (ativo) onLoadingChange?.(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [onLoadingChange]);

  if (!config) return null;

  const patch = (mudanca: Partial<ProposalNumberingConfig>) =>
    setConfig((atual) => (atual ? { ...atual, ...mudanca } : atual));

  const adicionarPraca = () => {
    const praca = normalizePraca(novaPraca);
    if (!praca) return;
    if (config.pracas.includes(praca)) {
      setNovaPraca("");
      return;
    }
    patch({
      pracas: [...config.pracas, praca],
      defaultPraca: config.defaultPraca ?? praca,
    });
    setNovaPraca("");
  };

  const removerPraca = (praca: string) => {
    const pracas = config.pracas.filter((p) => p !== praca);
    patch({
      pracas,
      // Praça padrão fora da lista viraria um código com sigla que a própria
      // empresa não reconhece; o backend descarta, e a tela precisa concordar.
      defaultPraca: config.defaultPraca === praca ? null : config.defaultPraca,
    });
  };

  const salvar = async () => {
    setIsSaving(true);
    try {
      const salvo = await ProposalNumberingService.update(config);
      setConfig(salvo);
      toast.success("Numeração salva.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a numeração.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const preview = buildProposalCodePreview({
    number: config.nextNumber,
    year: config.resetYearly ? config.year : new Date().getFullYear(),
    praca: config.defaultPraca,
    digits: config.digits,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" />
              Numeração das propostas
            </CardTitle>
            <CardDescription>
              Dá a cada proposta um código sequencial, como
              {" "}
              <span className="font-mono">0018926SP</span>. Aparece na lista de
              propostas e no nome do arquivo entregue no Drive.
            </CardDescription>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(enabled) => patch({ enabled })}
            aria-label="Ativar numeração das propostas"
          />
        </div>
      </CardHeader>

      {config.enabled && (
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              A próxima proposta receberá
            </p>
            <p className="font-mono text-2xl font-semibold mt-1">{preview}</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="numbering-next"
                className="text-sm font-medium text-foreground"
              >
                Próximo número
              </label>
              <Input
                id="numbering-next"
                type="number"
                min={1}
                value={config.nextNumber}
                onChange={(e) =>
                  patch({ nextNumber: Math.max(1, Number(e.target.value) || 1) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Já numera fora do sistema? Comece daqui. Voltar atrás repete um
                código que já foi entregue a um cliente.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="numbering-digits"
                className="text-sm font-medium text-foreground"
              >
                Dígitos do sequencial
              </label>
              <Input
                id="numbering-digits"
                type="number"
                min={1}
                max={10}
                value={config.digits}
                onChange={(e) =>
                  patch({
                    digits: Math.min(
                      10,
                      Math.max(1, Number(e.target.value) || 5),
                    ),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Quantos zeros à esquerda o número ocupa.
              </p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Reiniciar a cada ano</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ligado, a contagem volta para 1 em janeiro e o ano no código é
                o que separa. Desligado, a sequência atravessa o ano.
              </p>
            </div>
            <Switch
              checked={config.resetYearly}
              onCheckedChange={(resetYearly) => patch({ resetYearly })}
              aria-label="Reiniciar a numeração a cada ano"
            />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Praças</p>
              <p className="text-xs text-muted-foreground mt-1">
                A sigla da cidade ou filial que entra no fim do código, para
                saber quantas propostas saíram de cada uma. Sem praça nenhuma, o
                código fica só com o número e o ano.
              </p>
            </div>

            {config.pracas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.pracas.map((praca) => (
                  <Badge
                    key={praca}
                    variant="secondary"
                    className="gap-1.5 py-1 pl-2.5 pr-1.5 font-mono"
                  >
                    {praca}
                    <button
                      type="button"
                      onClick={() => removerPraca(praca)}
                      aria-label={`Remover praça ${praca}`}
                      className="rounded-full p-0.5 hover:bg-foreground/10 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={novaPraca}
                onChange={(e) => setNovaPraca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  adicionarPraca();
                }}
                placeholder="SP"
                maxLength={8}
                aria-label="Nova praça"
                className="font-mono uppercase sm:max-w-40"
              />
              <Button
                type="button"
                variant="outline"
                onClick={adicionarPraca}
                disabled={!normalizePraca(novaPraca)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Adicionar
              </Button>
            </div>

            {config.pracas.length > 0 && (
              <div className="space-y-2 pt-1">
                <label className="text-sm font-medium text-foreground">
                  Praça sugerida na proposta nova
                </label>
                <Select
                  value={config.defaultPraca ?? ""}
                  onChange={(e) =>
                    patch({ defaultPraca: e.target.value || null })
                  }
                  className="sm:max-w-60"
                  disableSort
                >
                  <option value="">Nenhuma</option>
                  {config.pracas.map((praca) => (
                    <option key={praca} value={praca}>
                      {praca}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      )}

      <CardContent className="pt-0">
        <Button onClick={() => void salvar()} disabled={isSaving}>
          {isSaving && <Loader className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
