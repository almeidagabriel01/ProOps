"use client";

import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { FormGroup, FormItem } from "@/components/ui/form-components";
import { StepNavigation } from "@/components/ui/step-wizard";
import { validarSerieNfse } from "@/lib/fiscal/serie-dps";
import type { FiscalFormState } from "@/lib/fiscal/settings-payload";
import type { FiscalNfsePadrao } from "@/services/fiscal-service";
import type { FiscalErrors, SetFiscalField } from "./types";

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

interface DocumentosStepProps {
  form: FiscalFormState;
  errors: FiscalErrors;
  setField: SetFiscalField;
  /** Hoje no fuso local — teto da data de início de recebimento. */
  hoje: string;
  dataRecebimentoBloqueada: boolean;
  onBeforeNext?: () => boolean;
  /**
   * Conta demo: o conteúdo do passo fica inerte, a navegação NÃO. O `inert`
   * vive aqui e não no `FormStepCard` porque este passo é um componente só —
   * o `contentDisabled` do card separa os filhos por posição (conteúdo, nav) e,
   * com um único filho, não isolaria nada.
   */
  contentDisabled?: boolean;
}

export function DocumentosStep({
  form,
  errors,
  setField,
  hoje,
  dataRecebimentoBloqueada,
  onBeforeNext,
  contentDisabled,
}: DocumentosStepProps) {
  /**
   * A série identifica o SISTEMA emissor perante o Ambiente Nacional, e cada
   * tipo tem faixa reservada — série fora dela é rejeição E0010. Avisar aqui
   * evita a viagem até o fisco para descobrir.
   */
  const serieNfseErro = validarSerieNfse(form.serieNfse);
  /**
   * O `max` do `DatePicker` só chega ao input escondido — o calendário não o
   * aplica, e input escondido o navegador não valida. Sem este aviso a troca
   * pelo componente padrão teria perdido a trava em silêncio, e aqui uma data
   * futura é permanente: o provedor não deixa corrigir depois.
   */
  const dataRecebimentoFutura = form.dataInicioRecebimento > hoje;

  return (
    <>
      <div className="space-y-6" inert={contentDisabled || undefined}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Documentos e numeração</h3>
            <p className="text-sm text-muted-foreground">
              A numeração precisa continuar de onde a empresa parou, senão o
              fisco recusa por duplicidade
            </p>
          </div>
        </div>

        {errors.documentos && (
          <p className="text-sm text-destructive">{errors.documentos}</p>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div>
              <p className="text-sm font-medium">NF-e: nota de produto</p>
              <p className="text-xs text-muted-foreground">
                Mercadoria, com ICMS.
              </p>
            </div>
            <Switch
              aria-label="NF-e: nota de produto"
              checked={form.habilitaNfe}
              onCheckedChange={(checked) => setField("habilitaNfe", checked)}
            />
          </div>

          {form.habilitaNfe && (
            <>
              <FormItem
                label="Inscrição estadual"
                htmlFor="fiscal-ie"
                hint="Obrigatória para NF-e"
              >
                <Input
                  id="fiscal-ie"
                  value={form.inscricaoEstadual}
                  onChange={(e) => setField("inscricaoEstadual", e.target.value)}
                />
              </FormItem>

              <FormGroup>
                <FormItem label="Série da NF-e" htmlFor="fiscal-serie-nfe">
                  <Input
                    id="fiscal-serie-nfe"
                    value={form.serieNfe}
                    onChange={(e) =>
                      setField("serieNfe", digits(e.target.value))
                    }
                    inputMode="numeric"
                  />
                </FormItem>
                <FormItem
                  label="Próximo número da NF-e"
                  htmlFor="fiscal-num-nfe"
                >
                  <Input
                    id="fiscal-num-nfe"
                    value={form.proximoNumeroNfe}
                    onChange={(e) =>
                      setField("proximoNumeroNfe", digits(e.target.value))
                    }
                    inputMode="numeric"
                  />
                </FormItem>
              </FormGroup>
            </>
          )}

          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div>
              <p className="text-sm font-medium">NFS-e: nota de serviço</p>
              <p className="text-xs text-muted-foreground">
                Instalação e mão de obra, com ISS.
              </p>
            </div>
            <Switch
              aria-label="NFS-e: nota de serviço"
              checked={form.habilitaNfse}
              onCheckedChange={(checked) => setField("habilitaNfse", checked)}
            />
          </div>

          {form.habilitaNfse && (
            <>
              <FormItem label="Padrão da NFS-e" htmlFor="fiscal-padrao-nfse">
                <Select
                  id="fiscal-padrao-nfse"
                  value={form.padraoNfse}
                  onChange={(e) =>
                    setField("padraoNfse", e.target.value as FiscalNfsePadrao)
                  }
                >
                  <option value="nacional">
                    Nacional: portal nfse.gov.br
                  </option>
                  <option value="municipal">
                    Municipal: sistema próprio da prefeitura
                  </option>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Na dúvida, olhe uma nota que a empresa já emitiu: se o rodapé
                  diz &quot;DANFSe&quot; e aponta para o portal nacional, é
                  Nacional.
                </p>
              </FormItem>

              <FormItem
                label="Inscrição municipal"
                htmlFor="fiscal-im"
                required
                error={errors.inscricaoMunicipal}
                hint="Obrigatória para NFS-e"
              >
                <Input
                  id="fiscal-im"
                  value={form.inscricaoMunicipal}
                  onChange={(e) => setField("inscricaoMunicipal", e.target.value)}
                />
              </FormItem>

              <FormGroup>
                <FormItem label="Série da NFS-e" htmlFor="fiscal-serie-nfse">
                  <Input
                    id="fiscal-serie-nfse"
                    value={form.serieNfse}
                    onChange={(e) => setField("serieNfse", e.target.value)}
                  />
                  {serieNfseErro && (
                    <p className="text-xs text-amber-600">{serieNfseErro}</p>
                  )}
                </FormItem>
                <FormItem
                  label="Próximo número da NFS-e"
                  htmlFor="fiscal-num-nfse"
                >
                  <Input
                    id="fiscal-num-nfse"
                    value={form.proximoNumeroNfse}
                    onChange={(e) =>
                      setField("proximoNumeroNfse", digits(e.target.value))
                    }
                    inputMode="numeric"
                  />
                </FormItem>
              </FormGroup>
            </>
          )}

          {/* Recepção fica junto da emissão porque são as duas metades do mesmo
              módulo — mas desligada por padrão, e com o custo dito na frente:
              cada nota recebida consome uma unidade do pacote mensal do
              provedor, do mesmo jeito que uma emitida. Ligar isso sem saber
              disso seria descobrir na fatura. */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 p-4">
            <div>
              <p className="text-sm font-medium">
                Receber notas dos fornecedores
              </p>
              <p className="text-xs text-muted-foreground">
                Traz as notas emitidas contra o seu CNPJ e permite se manifestar
                sobre elas. Cada nota recebida consome uma unidade do seu pacote,
                inclusive as que seus fornecedores já emitiram antes de você
                ligar isto.
              </p>
            </div>
            <Switch
              aria-label="Receber notas dos fornecedores"
              checked={form.habilitaManifestacao}
              onCheckedChange={(checked) => {
                setField("habilitaManifestacao", checked);
                // Hoje como padrão: em branco o provedor puxa TODO o histórico
                // e cobra por nota. Quem quiser o histórico escolhe a data —
                // ninguém deve pagar por ele sem ter pedido.
                if (checked && !form.dataInicioRecebimento) {
                  setField("dataInicioRecebimento", hoje);
                }
              }}
            />
          </div>

          {form.habilitaManifestacao && (
            <div className="flex flex-col gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
              <Label htmlFor="fiscal-data-inicio-recebimento">
                Buscar notas emitidas a partir de
              </Label>
              <DatePicker
                id="fiscal-data-inicio-recebimento"
                clearable={false}
                className="sm:max-w-[220px]"
                value={form.dataInicioRecebimento}
                max={hoje}
                disabled={dataRecebimentoBloqueada}
                onChange={(e) =>
                  setField("dataInicioRecebimento", e.target.value)
                }
              />
              {dataRecebimentoFutura && (
                <p className="text-xs text-amber-600">
                  Data no futuro: nenhuma nota será recebida até lá, e esta
                  escolha não poderá ser desfeita.
                </p>
              )}
              {dataRecebimentoBloqueada ? (
                <p className="text-xs text-muted-foreground">
                  Esta data já foi registrada no provedor fiscal e não pode mais
                  ser alterada.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Notas emitidas antes desta data são descartadas e{" "}
                  <strong className="text-foreground">não são cobradas</strong>.
                  Recuar a data traz o histórico do fornecedor, útil para
                  aproveitar os NCM de compras antigas, mas{" "}
                  <strong className="text-foreground">
                    cada nota trazida consome uma unidade do seu pacote
                  </strong>
                  . Depois de enviar o certificado,{" "}
                  <strong className="text-foreground">
                    esta data não pode mais ser alterada
                  </strong>
                  .
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <StepNavigation onBeforeNext={onBeforeNext} />
    </>
  );
}
