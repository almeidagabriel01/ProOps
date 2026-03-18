"use client";

import * as React from "react";
import {
  CheckCircle2,
  FileText,
  Package,
  Receipt,
  ScrollText,
  UserRound,
} from "lucide-react";
import { Proposal, ProposalProduct } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { ProposalSistema } from "@/types/automation";
import { ProposalStatus } from "@/types/proposal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  KanbanService,
  KanbanStatusColumn,
  getDefaultProposalColumns,
} from "@/services/kanban-service";
import { useTenant } from "@/providers/tenant-provider";
import {
  defaultPdfSettings,
  PdfDisplaySettings,
} from "./pdf-display-options-section";
import {
  MobileFieldShell,
  MobileDisclosure,
  MobileMetric,
  MobilePanel,
  formatCurrency,
  formatDateLabel,
  getProposalDownPaymentValue,
} from "./mobile/shared";

const statusOptions: { value: ProposalStatus; label: string }[] = [
  { value: "draft", label: "Rascunho" },
  { value: "in_progress", label: "Em aberto" },
  { value: "sent", label: "Enviada" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
];

const pdfSettingLabels: Record<keyof PdfDisplaySettings, string> = {
  showProductImages: "Imagens",
  showProductDescriptions: "Descricoes",
  showProductPrices: "Precos unitarios",
  showSubtotals: "Subtotal por solucao",
  showEnvironmentSubtotals: "Subtotal por ambiente",
  showPaymentTerms: "Condicoes de pagamento",
  showLogo: "Logo",
  showValidUntil: "Validade",
  showNotes: "Observacoes",
};

interface ProposalSummaryMobileSectionProps {
  formData: Partial<Proposal>;
  selectedProducts: ProposalProduct[];
  selectedSistemas: ProposalSistema[];
  extraProducts?: ProposalProduct[];
  isAutomacaoNiche: boolean;
  products?: Array<Product | Service>;
  calculateSubtotal: () => number;
  calculateDiscount: () => number;
  calculateTotal: () => number;
  onFormChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
}

export function ProposalSummaryMobileSection({
  formData,
  selectedProducts,
  selectedSistemas,
  extraProducts = [],
  isAutomacaoNiche,
  products = [],
  calculateSubtotal,
  calculateDiscount,
  calculateTotal,
  onFormChange,
}: ProposalSummaryMobileSectionProps) {
  const { tenant } = useTenant();
  const [dynamicStatusOptions, setDynamicStatusOptions] = React.useState<
    {
      value: string;
      label: string;
      mappedStatus?: string;
    }[]
  >([...statusOptions.filter((option) => option.value !== "draft")]);

  React.useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;

    KanbanService.getStatuses(tenant.id)
      .then((columns) => {
        if (cancelled) return;

        let activeColumns = columns;
        if (activeColumns.length === 0) {
          activeColumns = getDefaultProposalColumns().map(
            (column, index) =>
              ({ ...column, id: `default_${index}` }) as KanbanStatusColumn,
          );
        }

        const nextOptions = activeColumns.map((column) => ({
          value:
            column.id.startsWith("default_") && column.mappedStatus
              ? column.mappedStatus
              : column.id,
          label: column.label,
          mappedStatus: column.mappedStatus,
        }));

        if (
          formData.status &&
          formData.status !== "draft" &&
          !nextOptions.some((option) => option.value === formData.status)
        ) {
          const mappedColumn = activeColumns.find(
            (column) =>
              column.mappedStatus === formData.status ||
              column.id === formData.status,
          );

          if (mappedColumn) {
            const actualValue =
              mappedColumn.id.startsWith("default_") && mappedColumn.mappedStatus
                ? mappedColumn.mappedStatus
                : mappedColumn.id;

            onFormChange({
              target: {
                name: "status",
                value: actualValue,
              },
            } as React.ChangeEvent<HTMLSelectElement>);
          } else {
            const fallback = statusOptions.find(
              (option) => option.value === formData.status,
            );

            nextOptions.push({
              value: formData.status,
              label: fallback ? `${fallback.label} (antigo)` : "Status antigo",
              mappedStatus: fallback?.value,
            });
          }
        }

        setDynamicStatusOptions(nextOptions);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [tenant?.id, formData.status, onFormChange]);

  const displayProducts = React.useMemo(
    () => selectedProducts.filter((product) => (product.quantity || 0) > 0),
    [selectedProducts],
  );

  const subtotal = calculateSubtotal();
  const discount = calculateDiscount();
  const total = calculateTotal();
  const totalCost = displayProducts.reduce((sum, product) => {
    if ((product.itemType || "product") === "service") {
      return sum;
    }

    return sum + product.unitPrice * product.quantity;
  }, 0);
  const totalProfit = displayProducts.reduce((sum, product) => {
    if ((product.itemType || "product") === "service") {
      return sum;
    }

    return (
      sum +
      product.unitPrice * product.quantity * ((product.markup || 0) / 100)
    );
  }, 0);
  const extraExpense = formData.extraExpense || 0;
  const downPaymentValue = getProposalDownPaymentValue(formData, total);
  const rawTotal = subtotal + extraExpense;
  const combinedValue = Number(formData.closedValue) || 0;
  const commercialDiscount =
    combinedValue > 0 ? Math.max(0, rawTotal - combinedValue) : discount;
  const effectiveTotal = combinedValue > 0 ? combinedValue : total;
  const pdfSettings: PdfDisplaySettings = {
    ...defaultPdfSettings,
    ...(formData.pdfSettings as Partial<PdfDisplaySettings>),
  };

  const enabledPdfOptions = Object.entries(pdfSettings)
    .filter(([, value]) => value)
    .map(([key]) => pdfSettingLabels[key as keyof PdfDisplaySettings]);

  const displayExtraProducts = React.useMemo(
    () => extraProducts.filter((product) => (product.quantity || 0) > 0),
    [extraProducts],
  );

  const groupedBySystem = React.useMemo(() => {
    if (!isAutomacaoNiche) {
      return [] as Array<{
        key: string;
        title: string;
        subtitle: string;
        products: ProposalProduct[];
        subtotal: number;
      }>;
    }

    const groups: Array<{
      key: string;
      title: string;
      subtitle: string;
      products: ProposalProduct[];
      subtotal: number;
    }> = [];

    selectedSistemas.forEach((sistema, sistemaIndex) => {
      const ambientes =
        sistema.ambientes && sistema.ambientes.length > 0
          ? sistema.ambientes
          : sistema.ambienteId
            ? [
                {
                  ambienteId: sistema.ambienteId,
                  ambienteName: sistema.ambienteName || "Ambiente",
                },
              ]
            : [];

      ambientes.forEach((ambiente, ambienteIndex) => {
        const instanceId = `${sistema.sistemaId}-${ambiente.ambienteId}`;
        const environmentProducts = displayProducts.filter(
          (product) => product.systemInstanceId === instanceId,
        );

        if (environmentProducts.length === 0) {
          return;
        }

        groups.push({
          key: `${sistemaIndex}-${ambienteIndex}-${instanceId}`,
          title: sistema.sistemaName,
          subtitle: ambiente.ambienteName,
          products: environmentProducts,
          subtotal: environmentProducts.reduce(
            (sum, product) => sum + product.total,
            0,
          ),
        });
      });
    });

    return groups;
  }, [displayProducts, isAutomacaoNiche, selectedSistemas]);

  const isProductInactive = React.useCallback(
    (product: ProposalProduct) => {
      const catalogProduct = products.find((item) => item.id === product.productId);
      return (
        catalogProduct?.status === "inactive" || product.status === "inactive"
      );
    },
    [products],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        <MobileMetric
          label="Total"
          value={formatCurrency(effectiveTotal)}
          hint="valor final da proposta"
          accent="emerald"
        />
        <MobileMetric
          label="Itens"
          value={`${displayProducts.length}`}
          hint="linhas com quantidade maior que zero"
          accent="sky"
        />
        <MobileMetric
          label="Status"
          value={statusLabel(formData.status || "draft")}
          hint="ajustavel antes de salvar"
          accent="amber"
          className="col-span-2"
        />
      </div>

      <MobilePanel
        eyebrow="Leitura geral"
        title="Resumo da proposta"
        description="Os dados principais ficam visiveis de imediato e o restante entra sob demanda."
        icon={ScrollText}
        tone="accent"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryTile label="Titulo" value={formData.title || "Nao definido"} />
          <SummaryTile
            label="Validade"
            value={formatDateLabel(formData.validUntil)}
          />
          <SummaryTile
            label="Contato"
            value={formData.clientName || "Nao definido"}
          />
          <SummaryTile
            label="Telefone"
            value={formData.clientPhone || "Nao informado"}
          />
          <SummaryTile
            label="Status"
            value={statusLabel(formData.status || "draft")}
          />
          <SummaryTile
            label="Pagamento"
            value={
              formData.installmentsEnabled
                ? `${formData.installmentsCount || 1}x`
                : "A vista"
            }
          />
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserRound className="h-4 w-4 text-sky-700 dark:text-sky-300" />
            Dados do cliente
          </div>
          <p className="mt-2 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            {formData.clientEmail || "Sem email cadastrado"}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            {formData.clientAddress || "Sem endereco informado"}
          </p>
        </div>
      </MobilePanel>

      <MobilePanel
        eyebrow="Financeiro"
        title="Totais comerciais"
        description="Total final e pagamento aparecem primeiro; o detalhamento continua disponivel."
        icon={Receipt}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          <SummaryTile label="Subtotal" value={formatCurrency(subtotal)} />
          <SummaryTile
            label={
              combinedValue > 0 ? "Desconto comercial" : "Desconto aplicado"
            }
            value={formatCurrency(commercialDiscount)}
          />
          <SummaryTile
            label="Total final"
            value={formatCurrency(effectiveTotal)}
          />
          <SummaryTile
            label="Entrada"
            value={
              formData.downPaymentEnabled && downPaymentValue > 0
                ? formatCurrency(downPaymentValue)
                : "Nao usada"
            }
          />
        </div>

        <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Receipt className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
            Pagamento consolidado
          </div>

          {formData.downPaymentEnabled && downPaymentValue > 0 ? (
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              Entrada: <strong>{formatCurrency(downPaymentValue)}</strong>
              {formData.downPaymentDueDate
                ? ` / venc. ${formatDateLabel(formData.downPaymentDueDate)}`
                : ""}
            </p>
          ) : null}

          {formData.installmentsEnabled ? (
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Parcelamento:{" "}
              <strong>
                {formData.installmentsCount || 1}x de{" "}
                {formatCurrency(formData.installmentValue || 0)}
              </strong>
              {formData.firstInstallmentDate
                ? ` / primeira ${formatDateLabel(formData.firstInstallmentDate)}`
                : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              Saldo a vista:{" "}
              <strong>
                {formatCurrency(Math.max(0, effectiveTotal - downPaymentValue))}
              </strong>
            </p>
          )}
        </div>

        <MobileDisclosure
          title="Ver detalhamento financeiro"
          description="Custos, lucro, extras e leitura comercial completa."
          meta={formatCurrency(effectiveTotal)}
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            <SummaryTile label="Custo bruto" value={formatCurrency(totalCost)} />
            <SummaryTile label="Lucro" value={formatCurrency(totalProfit)} />
            <SummaryTile
              label="Custos extras"
              value={formatCurrency(extraExpense)}
            />
            <SummaryTile
              label="Saldo restante"
              value={formatCurrency(Math.max(0, effectiveTotal - downPaymentValue))}
            />
          </div>

          {combinedValue > 0 ? (
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/8 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Receipt className="h-4 w-4 text-violet-700 dark:text-violet-300" />
                Valor combinado com o cliente
              </div>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                Valor fechado: <strong>{formatCurrency(combinedValue)}</strong>
              </p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Desconto comercial consolidado:{" "}
                <strong>{formatCurrency(commercialDiscount)}</strong>
              </p>
            </div>
          ) : null}
        </MobileDisclosure>
      </MobilePanel>

      <MobilePanel
        eyebrow="Escopo"
        title="Itens incluidos"
        description="A leitura abre por bloco para evitar uma lista longa no mobile."
        icon={Package}
      >
        {displayProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum item com quantidade maior que zero.
          </div>
        ) : isAutomacaoNiche ? (
          <div className="space-y-3">
            {groupedBySystem.map((group) => (
              <MobileDisclosure
                key={group.key}
                title={group.title}
                description={group.subtitle}
                meta={`${group.products.length} item(ns)`}
              >
                <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Subtotal
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(group.subtotal)}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.products.map((product, index) => (
                    <ProductSummaryRow
                      key={`${group.key}-${product.productId}-${index}`}
                      product={product}
                      inactive={isProductInactive(product)}
                    />
                  ))}
                </div>
              </MobileDisclosure>
            ))}

            {displayExtraProducts.length > 0 ? (
              <MobileDisclosure
                title="Itens extras fora dos sistemas"
                description="Produtos e servicos adicionados diretamente na proposta."
                meta={`${displayExtraProducts.length} item(ns)`}
                className="border-sky-500/20 bg-sky-500/8"
              >
                <div className="space-y-2">
                  {displayExtraProducts.map((product, index) => (
                    <ProductSummaryRow
                      key={`extra-${product.productId}-${index}`}
                      product={product}
                      inactive={isProductInactive(product)}
                    />
                  ))}
                </div>
              </MobileDisclosure>
            ) : null}
          </div>
        ) : (
          <MobileDisclosure
            title="Itens selecionados"
            description="Lista completa da proposta."
            meta={`${displayProducts.length} item(ns)`}
            defaultOpen
          >
            <div className="space-y-2">
              {displayProducts.map((product, index) => (
                <ProductSummaryRow
                  key={`${product.productId}-${index}`}
                  product={product}
                  inactive={isProductInactive(product)}
                />
              ))}
            </div>
          </MobileDisclosure>
        )}
      </MobilePanel>

      <MobilePanel
        eyebrow="Fechamento"
        title="Status, observacoes e PDF"
        description="Ajuste o fechamento comercial e confira o que vai para o documento."
        icon={CheckCircle2}
        tone="warning"
      >
        <MobileDisclosure
          title="Opcoes ativas no PDF"
          description="Resumo do que sera exibido no arquivo final."
          meta={`${enabledPdfOptions.length} ativa(s)`}
        >
          <div className="flex flex-wrap gap-2">
            {enabledPdfOptions.map((label) => (
              <span
                key={label}
                className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300"
              >
                <span className="[overflow-wrap:anywhere]">{label}</span>
              </span>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-sky-700 dark:text-sky-300" />
              Leitura atual
            </div>
            <p className="mt-2 text-sm leading-5 text-muted-foreground">
              {pdfSettings.showProductPrices
                ? "Preco unitario visivel no PDF."
                : "PDF com valores consolidados."}
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {pdfSettings.showPaymentTerms
                ? "Pagamento incluido no documento."
                : "Pagamento fora do PDF."}
            </p>
          </div>
        </MobileDisclosure>

        <MobileFieldShell label="Status da proposta">
          <Select
            id="status"
            name="status"
            value={formData.status || "draft"}
            onChange={onFormChange}
          >
            {dynamicStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </MobileFieldShell>

        <MobileFieldShell label="Observacoes">
          <Textarea
            id="customNotes"
            name="customNotes"
            value={formData.customNotes || ""}
            onChange={onFormChange}
            placeholder="Condicoes comerciais, observacoes internas ou recados para o cliente"
            rows={4}
            className="min-h-[120px] rounded-2xl border-2 border-border/60 bg-background/80 px-4 py-3 text-sm shadow-sm transition-[border-color,box-shadow] duration-200 focus:border-primary focus:shadow-lg focus:shadow-primary/10"
          />
        </MobileFieldShell>
      </MobilePanel>
    </div>
  );
}

function ProductSummaryRow({
  product,
  inactive,
}: {
  product: ProposalProduct;
  inactive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
              {product.productName}
            </p>
            {product.isExtra ? (
              <span className="rounded-full bg-sky-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                Extra
              </span>
            ) : null}
            {inactive ? (
              <span className="rounded-full bg-amber-500/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                Inativo
              </span>
            ) : null}
          </div>
          {product.productDescription ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              {product.productDescription}
            </p>
          ) : null}
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {product.quantity}x / {formatCurrency(product.unitPrice)}
          </p>
        </div>

        <span className="shrink-0 text-xs font-semibold text-foreground sm:text-right">
          {formatCurrency(product.total)}
        </span>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-foreground [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

function statusLabel(status: string) {
  const fallback = statusOptions.find((option) => option.value === status);
  return fallback?.label || status;
}
