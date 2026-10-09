"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Package, Receipt, Truck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "@/components/ui/form-components";
import { ClientSelect } from "@/components/features/client-select";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { notifyIssueError } from "@/hooks/use-issue-invoice";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useTenant } from "@/providers/tenant-provider";
import {
  addChave,
  EMPTY_TRANSPORTE,
  isBlankLine,
  linesFromSource,
  manualRequest,
  newManualLine,
  parseChaves,
  proposalRequest,
  type ManualLineForm,
  type NfeFormState,
  type ProposalLineForm,
} from "@/lib/fiscal/nfe-form";
import {
  FiscalService,
  type FiscalGap,
  type FiscalIssuePreview,
  type FiscalNatureza,
  type FiscalSourceDocument,
} from "@/services/fiscal-service";
import { ProductService, type Product } from "@/services/product-service";
import { Field } from "./field";
import { InvoiceReviewSummary } from "./invoice-review-summary";
import { ManualLinesEditor } from "./manual-lines-editor";
import { ProposalLinesReview } from "./proposal-lines-review";
import { ReferencedKeysField } from "./referenced-keys-field";
import { SourceDocumentDialog, type SourceSelection } from "./source-document-dialog";
import { TransportFields } from "./transport-fields";

interface InvoiceFormProps {
  /** Com proposta: revisa a nota da venda. Sem: nota avulsa (remessa, devolução). */
  proposalId?: string;
}

const PREVIEW_DEBOUNCE_MS = 400;

/** Mensagem de uma prévia que falhou: entrada inválida volta 400 com o motivo. */
function previewErrorMessage(error: unknown): string {
  const data = error instanceof ApiError ? (error.data as { message?: string } | null) : null;
  return data?.message || "Não foi possível montar a prévia da nota.";
}

/**
 * O formulário de emissão da NF-e, para as duas origens.
 *
 * Toda regra da nota (CFOP, ICMS pela operação, IPI, total, o que falta) vem
 * da prévia do backend, chamada a cada mudança: a tela só junta o que a
 * pessoa escolheu. Assim a nota avulsa e a da proposta não ganham uma segunda
 * implementação da regra que poderia divergir da emissão.
 */
export function InvoiceForm({ proposalId }: InvoiceFormProps) {
  const router = useRouter();
  const { tenant } = useTenant();
  const { hasFiscalReceiving } = usePlanLimits();
  const isProposal = Boolean(proposalId);

  const [naturezas, setNaturezas] = React.useState<FiscalNatureza[]>([]);
  const [form, setForm] = React.useState<NfeFormState>({
    naturezaOperacao: isProposal ? "venda_mercadoria_terceiros" : "remessa_conserto",
    observacoes: null,
    chavesTexto: "",
    transporte: EMPTY_TRANSPORTE,
  });
  const [client, setClient] = React.useState<{ id?: string; name: string }>({ name: "" });
  const [lines, setLines] = React.useState<ManualLineForm[]>(() => [newManualLine()]);
  const [proposalEdits, setProposalEdits] = React.useState<ProposalLineForm[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [sourceOpen, setSourceOpen] = React.useState(false);

  const [preview, setPreview] = React.useState<FiscalIssuePreview | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [issueGaps, setIssueGaps] = React.useState<FiscalGap[] | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    FiscalService.listNaturezas()
      .then(({ naturezas: lista }) => setNaturezas(lista))
      .catch(() => setNaturezas([]));
  }, []);

  React.useEffect(() => {
    if (isProposal || !tenant?.id) return;
    ProductService.getProducts(tenant.id)
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [isProposal, tenant?.id]);

  const requestBody = React.useMemo(() => {
    if (proposalId) return proposalRequest(form, proposalEdits);
    if (!client.id) return null;
    return manualRequest(client.id, form, lines);
  }, [proposalId, form, proposalEdits, client.id, lines]);
  const requestKey = requestBody ? JSON.stringify(requestBody) : "";

  // Prévia a cada mudança, com espera curta e descartando resposta velha.
  const previewSeq = React.useRef(0);
  React.useEffect(() => {
    setIssueGaps(null);
    if (!requestKey) {
      setPreview(null);
      return;
    }
    const seq = ++previewSeq.current;
    setLoadingPreview(true);
    const timer = window.setTimeout(() => {
      const body = JSON.parse(requestKey) as Record<string, unknown>;
      const call = proposalId
        ? FiscalService.previewFromProposalEdited(proposalId, body)
        : FiscalService.previewManual(body);
      call
        .then((result) => {
          if (seq !== previewSeq.current) return;
          setPreview(result);
          setPreviewError(null);
        })
        .catch((error: unknown) => {
          if (seq !== previewSeq.current) return;
          setPreviewError(previewErrorMessage(error));
        })
        .finally(() => {
          if (seq === previewSeq.current) setLoadingPreview(false);
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [requestKey, proposalId]);

  const nfeView = preview?.documentos.find((doc) => doc.type === "nfe")?.nfe;
  // Antes da primeira prévia o seletor não sabe o regime; o painel de
  // impostos fica travado até ela chegar, então o padrão aqui não chega a valer.
  const icmsKind = nfeView?.icmsKind ?? "csosn";
  const natureza = naturezas.find((item) => item.id === form.naturezaOperacao);
  const chavesInvalidas = parseChaves(form.chavesTexto).invalidas.length > 0;

  /**
   * A nota de origem escolhida: a chave entra na referência e, na nota
   * avulsa, os itens escolhidos viram linhas (somando às que a pessoa já
   * digitou, ou no lugar da linha em branco).
   */
  const applySource = (doc: FiscalSourceDocument, escolhidos: SourceSelection[]) => {
    setForm((prev) => ({ ...prev, chavesTexto: addChave(prev.chavesTexto, doc.chave) }));
    if (isProposal || escolhidos.length === 0) return;
    const novas = linesFromSource(doc, escolhidos, {
      devolucao: natureza?.finalidade === "devolucao",
      icmsKind,
    });
    setLines((prev) => [...prev.filter((line) => !isBlankLine(line)), ...novas]);
    toast.success(novas.length === 1 ? "1 item trazido da nota" : `${novas.length} itens trazidos da nota`);
  };

  const submit = async () => {
    if (!requestBody) return;
    setSubmitting(true);
    setIssueGaps(null);
    try {
      const result = proposalId
        ? await FiscalService.issueFromProposal(proposalId, requestBody)
        : await FiscalService.issueManual(requestBody);
      const count = result.invoices.length;
      toast.success(count > 1 ? `${count} notas enviadas` : "Nota enviada", {
        // A autorização é assíncrona: prometer "emitida" aqui seria mentira.
        description: "A autorização chega em alguns instantes. Acompanhe em Notas Fiscais.",
      });
      router.push("/invoices");
    } catch (error) {
      const gaps = notifyIssueError(error);
      if (gaps) setIssueGaps(gaps);
    } finally {
      setSubmitting(false);
    }
  };

  const documentos = preview?.documentos.length ?? 0;
  const submitLabel =
    (preview?.jaEmitidas.length ?? 0) > 0
      ? "Emitir mesmo assim"
      : documentos > 1
        ? `Emitir as ${documentos} notas`
        : "Emitir nota";
  const canSubmit =
    Boolean(requestBody) &&
    !submitting &&
    !loadingPreview &&
    !previewError &&
    !chavesInvalidas &&
    preview?.canIssue === true;

  return (
    <div className="flex flex-col gap-6">
      {!isProposal && (
        <FormSection
          title="Destinatário"
          description="Para quem a mercadoria vai: o cliente, o fornecedor da devolução ou a assistência técnica."
          icon={User}
        >
          <Field label="Contato" htmlFor="nota-destinatario">
            <ClientSelect
              value={client.name}
              clientId={client.id}
              disabled={submitting}
              onChange={(data) =>
                setClient({ id: data.isNew ? undefined : data.clientId, name: data.clientName })
              }
            />
          </Field>
          {client.name && !client.id && (
            <p className="text-sm text-muted-foreground">
              Escolha um contato já cadastrado. A nota de produto precisa do endereço fiscal
              dele, que fica no cadastro do contato.
            </p>
          )}
        </FormSection>
      )}

      <FormSection
        title="Operação"
        description="Decide o CFOP, a finalidade da nota e como o ICMS sai."
        icon={Receipt}
      >
        <Field
          label="Natureza da operação"
          htmlFor="nota-natureza"
          hint={
            natureza
              ? `CFOP ${natureza.cfopDentroEstado} dentro do estado, ${natureza.cfopForaEstado} para outro estado.${natureza.tributada ? "" : " Sem a tributação da venda."}`
              : undefined
          }
        >
          <Select
            id="nota-natureza"
            value={form.naturezaOperacao}
            disabled={submitting}
            disableSort
            onChange={(e) => setForm((prev) => ({ ...prev, naturezaOperacao: e.target.value }))}
          >
            {naturezas.length === 0 && (
              <option value={form.naturezaOperacao}>Carregando as operações</option>
            )}
            {naturezas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.descricao}
              </option>
            ))}
          </Select>
        </Field>

        {natureza && natureza.referencia !== "nao_se_aplica" && (
          <ReferencedKeysField
            value={form.chavesTexto}
            required={natureza.referencia === "obrigatoria"}
            disabled={submitting}
            onChange={(chavesTexto) => setForm((prev) => ({ ...prev, chavesTexto }))}
            onOpenSource={() => setSourceOpen(true)}
          />
        )}
      </FormSection>

      <FormSection
        title="Itens"
        description={
          isProposal
            ? "Os itens e valores são os da proposta. Aqui você ajusta os impostos de cada um."
            : "Do catálogo, digitados na hora ou trazidos da nota de origem."
        }
        icon={Package}
      >
        {isProposal ? (
          nfeView ? (
            <ProposalLinesReview
              previewLines={nfeView.linhas}
              edits={proposalEdits}
              onChange={setProposalEdits}
              icmsKind={icmsKind}
              disabled={submitting}
            />
          ) : preview ? (
            <p className="text-sm text-muted-foreground">
              Esta proposta não tem mercadoria: sai só a nota de serviço.
            </p>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader size="sm" /> Montando a nota da proposta
            </div>
          )
        ) : (
          <ManualLinesEditor
            lines={lines}
            onChange={setLines}
            products={products}
            previewLines={nfeView?.linhas}
            icmsKind={icmsKind}
            disabled={submitting}
          />
        )}
      </FormSection>

      {(!isProposal || nfeView) && (
        <FormSection
          title="Transporte"
          description="Frete, transportadora, volumes e peso, como saem no DANFE."
          icon={Truck}
          collapsible
          defaultOpen={false}
        >
          <TransportFields
            value={form.transporte}
            disabled={submitting}
            onChange={(transporte) => setForm((prev) => ({ ...prev, transporte }))}
          />
        </FormSection>
      )}

      {(!isProposal || nfeView) && (
        <FormSection
          title="Informações complementares"
          description="O texto do campo de observações da nota. O padrão do contato já vem preenchido."
          icon={FileText}
        >
          <Field label="Observações" htmlFor="nota-observacoes">
            <Textarea
              id="nota-observacoes"
              className="min-h-[96px]"
              maxLength={2000}
              disabled={submitting}
              value={form.observacoes ?? nfeView?.observacoes ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
            />
          </Field>
          {(nfeView?.mensagensLegais.length ?? 0) > 0 && (
            <div className="rounded-lg bg-muted/40 p-3 text-sm" data-testid="mensagens-legais">
              <p className="font-medium">Vai junto, depois da observação</p>
              <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
                {nfeView?.mensagensLegais.map((mensagem) => <li key={mensagem}>{mensagem}</li>)}
              </ul>
            </div>
          )}
        </FormSection>
      )}

      <SourceDocumentDialog
        open={sourceOpen}
        onOpenChange={setSourceOpen}
        canPickReceived={hasFiscalReceiving}
        selectItems={!isProposal}
        onConfirm={applySource}
      />

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:p-6">
        {previewError && <p className="text-sm text-destructive">{previewError}</p>}
        {preview?.reason === "FISCAL_COTA_MENSAL_ATINGIDA" && (
          <p className="text-sm text-destructive">
            O limite de notas do mês acabou. Ele renova no dia 1.
          </p>
        )}
        <InvoiceReviewSummary
          preview={preview}
          gaps={issueGaps}
          clientId={client.id}
          loading={loadingPreview}
        />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => router.back()}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={() => void submit()}>
            {submitting && <Loader size="sm" variant="button" className="mr-2" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
