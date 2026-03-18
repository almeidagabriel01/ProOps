"use client";

import * as React from "react";
import { AlertCircle, ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Proposal } from "@/services/proposal-service";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { ClientType } from "@/services/client-service";
import { ProposalSistema } from "@/types/automation";
import { MasterDataAction } from "@/hooks/proposal/useMasterDataTransaction";
import { SistemaSelectorProps } from "@/components/features/automation/sistema-selector";
import { ProposalMobileClientStep } from "./proposal-mobile-client-step";
import { ProposalMobileProductsStep } from "./proposal-mobile-products-step";
import { ProposalMobilePaymentStep } from "./proposal-mobile-payment-step";
import { ProposalMobilePdfStep } from "./proposal-mobile-pdf-step";
import { ProposalSystemsMobileSection } from "../proposal-systems-mobile-section";
import { ProposalSummaryMobileSection } from "../proposal-summary-mobile-section";
import { formatCurrency, formatDateLabel } from "./shared";

interface StepDefinition {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

interface ProposalMobileFormProps {
  proposalId?: string;
  steps: StepDefinition[];
  mobileStep: number;
  isSaving: boolean;
  isDirty: boolean;
  isAutomacaoNiche: boolean;
  formData: Partial<Proposal>;
  selectedClientId?: string;
  clientTypes: ClientType[];
  isNewClient: boolean;
  errors: Record<string, string>;
  products: Array<Product | Service>;
  selectedProducts: Proposal["products"];
  visibleProducts: Proposal["products"];
  extraProducts: Proposal["products"];
  selectedSistemas: ProposalSistema[];
  systemProductIds: Set<string>;
  primaryColor: string;
  selectorKey: number;
  mergedAmbientes?: ProposalSystemsMobileSectionProps["ambientes"];
  mergedSistemas?: ProposalSystemsMobileSectionProps["sistemas"];
  onBack: () => void;
  onStepChange: (targetStep: number) => void | Promise<void>;
  onPrevious: () => void;
  onNext: () => void | Promise<void>;
  onSubmit: () => void | Promise<boolean>;
  onFormChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  onSetFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
  onClientTypesChange: (types: ClientType[]) => void;
  onClientChange: (data: {
    clientId?: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    isNew: boolean;
  }) => void;
  onToggleProduct: (product: Product | Service) => void;
  onNavigateToProducts: () => void;
  onUpdateProductQuantity: (
    productId: string,
    delta: number,
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductMarkup: (
    productId: string,
    markup: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onUpdateProductPrice: (
    productId: string,
    newPrice: number,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  onAddExtraProductToSystem: (
    product: Product | Service,
    sistemaIndex: number,
    systemInstanceId: string,
  ) => void;
  onAddNewSystem: (sistema: ProposalSistema) => void;
  onRemoveSystem: (index: number, systemInstanceId: string) => void;
  onRemoveProduct: (
    productId: string,
    systemInstanceId: string,
    itemType?: "product" | "service",
  ) => void;
  SistemaSelectorComponent: React.ComponentType<SistemaSelectorProps>;
  onToggleStatus?: (
    productId: string,
    newStatus: "active" | "inactive",
    systemInstanceId?: string,
    itemType?: "product" | "service",
  ) => Promise<void>;
  onDataUpdate: () => void;
  onAmbienteAction?: (action: MasterDataAction) => void;
  onSistemaAction?: (action: MasterDataAction) => void;
  onRemoveAmbiente: (sistemaIndex: number, ambienteId: string) => void;
  calculateSubtotal: () => number;
  calculateDiscount: () => number;
  calculateTotal: () => number;
  onPaymentToggle: (field: string, value: boolean) => void;
  onExtraExpenseChange: (value: number) => void;
}

type ProposalSystemsMobileSectionProps = React.ComponentProps<
  typeof ProposalSystemsMobileSection
>;

export function ProposalMobileForm({
  proposalId,
  steps,
  mobileStep,
  isSaving,
  isDirty,
  isAutomacaoNiche,
  formData,
  selectedClientId,
  clientTypes,
  isNewClient,
  errors,
  products,
  selectedProducts,
  visibleProducts,
  extraProducts,
  selectedSistemas,
  systemProductIds,
  primaryColor,
  selectorKey,
  mergedAmbientes,
  mergedSistemas,
  onBack,
  onStepChange,
  onPrevious,
  onNext,
  onSubmit,
  onFormChange,
  onSetFormData,
  onClientTypesChange,
  onClientChange,
  onToggleProduct,
  onNavigateToProducts,
  onUpdateProductQuantity,
  onUpdateProductMarkup,
  onUpdateProductPrice,
  onAddExtraProductToSystem,
  onAddNewSystem,
  onRemoveSystem,
  onRemoveProduct,
  SistemaSelectorComponent,
  onToggleStatus,
  onDataUpdate,
  onAmbienteAction,
  onSistemaAction,
  onRemoveAmbiente,
  calculateSubtotal,
  calculateDiscount,
  calculateTotal,
  onPaymentToggle,
  onExtraExpenseChange,
}: ProposalMobileFormProps) {
  const progress = Math.round(((mobileStep + 1) / steps.length) * 100);
  const currentStep = steps[mobileStep];
  const totalItems = visibleProducts.reduce(
    (sum, product) => sum + (product.quantity || 0),
    0,
  );

  const stepContent = (
    <>
      {mobileStep === 0 ? (
        <ProposalMobileClientStep
          formData={formData}
          selectedClientId={selectedClientId}
          errors={errors}
          isNewClient={isNewClient}
          clientTypes={clientTypes}
          onClientTypesChange={onClientTypesChange}
          onFormChange={onFormChange}
          onClientChange={onClientChange}
        />
      ) : null}

      {mobileStep === 1 ? (
        <div className="space-y-4">
          {isAutomacaoNiche ? (
            <ProposalSystemsMobileSection
              selectedSistemas={selectedSistemas}
              selectedProducts={selectedProducts}
              products={products}
              primaryColor={primaryColor}
              selectorKey={selectorKey}
              onRemoveSystem={onRemoveSystem}
              onUpdateProductQuantity={onUpdateProductQuantity}
              onUpdateProductMarkup={onUpdateProductMarkup}
              onUpdateProductPrice={onUpdateProductPrice}
              onAddExtraProductToSystem={onAddExtraProductToSystem}
              onAddNewSystem={onAddNewSystem}
              onRemoveProduct={onRemoveProduct}
              SistemaSelectorComponent={SistemaSelectorComponent}
              onToggleStatus={onToggleStatus}
              onDataUpdate={onDataUpdate}
              ambientes={mergedAmbientes}
              sistemas={mergedSistemas}
              onAmbienteAction={onAmbienteAction}
              onSistemaAction={onSistemaAction}
              onRemoveAmbiente={onRemoveAmbiente}
              proposalStorageKey={proposalId}
            />
          ) : (
            <ProposalMobileProductsStep
              products={products}
              extraProducts={extraProducts}
              systemProductIds={systemProductIds}
              onToggleProduct={onToggleProduct}
              onUpdateQuantity={onUpdateProductQuantity}
              onNavigateToProducts={onNavigateToProducts}
              onToggleStatus={onToggleStatus}
            />
          )}

          {errors.sistemas ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.sistemas}</AlertDescription>
            </Alert>
          ) : null}

          {errors.products ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.products}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      {mobileStep === 2 ? (
        <ProposalMobilePaymentStep
          formData={formData}
          selectedProducts={visibleProducts}
          calculateTotal={calculateTotal}
          onFormChange={onFormChange}
          onPaymentToggle={onPaymentToggle}
          onExtraExpenseChange={onExtraExpenseChange}
          errors={errors}
        />
      ) : null}

      {mobileStep === 3 ? (
        <ProposalMobilePdfStep
          formData={formData}
          setFormData={onSetFormData}
        />
      ) : null}

      {mobileStep === 4 ? (
        <ProposalSummaryMobileSection
          formData={formData}
          selectedProducts={visibleProducts}
          selectedSistemas={selectedSistemas}
          extraProducts={extraProducts}
          isAutomacaoNiche={isAutomacaoNiche}
          products={products}
          calculateSubtotal={calculateSubtotal}
          calculateDiscount={calculateDiscount}
          calculateTotal={calculateTotal}
          onFormChange={onFormChange}
        />
      ) : null}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="-mx-4 sm:-mx-6 lg:-mx-8">
        <div className="sticky top-0 z-30 bg-background/96 px-4 pb-4 pt-2 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="rounded-[24px] border border-border/60 bg-background/96 p-3 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.4)] backdrop-blur-xl">
            <div className="flex items-start gap-3 rounded-[20px] border border-slate-200/70 bg-linear-to-br from-white via-slate-50 to-sky-50 p-3.5 dark:border-white/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
              <button
                type="button"
                onClick={onBack}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/8 dark:text-white"
                aria-label="Voltar para propostas"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
                      Proposta
                    </p>
                    <h1 className="mt-1 break-words text-base font-semibold leading-6 text-slate-950 dark:text-white">
                      {formData.title ||
                        (proposalId ? "Editar proposta" : "Nova proposta")}
                    </h1>
                    <p className="mt-1 break-words text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {formData.clientName || "Contato pendente"} •{" "}
                      {formatDateLabel(formData.validUntil)}
                    </p>
                  </div>

                  <QuickTopMetric label="Progresso" value={`${progress}%`} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <QuickTopMetric label="Itens" value={String(totalItems)} />
                  <QuickTopMetric
                    label="Solucoes"
                    value={String(selectedSistemas.length)}
                  />
                  <QuickTopMetric
                    label="Total"
                    value={formatCurrency(calculateTotal())}
                  />
                </div>

                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-sky-400 via-cyan-300 to-emerald-300 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const canClick = proposalId ? true : index <= mobileStep;
                const isCurrent = index === mobileStep;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => canClick && onStepChange(index)}
                    disabled={!canClick}
                    className={`min-h-[58px] min-w-[116px] shrink-0 rounded-[18px] border px-3 py-2.5 text-left transition-all ${
                      isCurrent
                        ? "border-sky-500/30 bg-sky-500/10 shadow-[0_18px_40px_-30px_rgba(14,165,233,0.75)]"
                        : "border-border/60 bg-card/95"
                    } ${canClick ? "opacity-100" : "opacity-45"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-2xl ${
                          isCurrent
                            ? "bg-sky-500/14 text-sky-700 dark:text-sky-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-foreground">
                          {step.title}
                        </p>
                        <p className="mt-0.5 line-clamp-1 break-words text-[11px] leading-4 text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-border/60 bg-card px-3 py-4 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] sm:px-4">
        <div className="mb-4 border-b border-border/50 pb-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Etapa {mobileStep + 1} de {steps.length}
            </p>
            <h2 className="break-words text-lg font-semibold text-foreground">
              {currentStep.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentStep.description}
            </p>
          </div>
        </div>

        {stepContent}
      </div>

      <div className="-mx-4 mt-2 sm:-mx-6 lg:-mx-8">
        <footer className="sticky bottom-0 z-20 bg-background/96 px-4 pb-4 pt-2 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="rounded-[24px] border border-border/60 bg-background/96 p-3 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="mx-auto flex w-full max-w-xl gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-12 flex-1 rounded-2xl"
                onClick={onPrevious}
                disabled={mobileStep === 0}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>

              {mobileStep < steps.length - 1 ? (
                <Button
                  type="button"
                  className="min-h-12 flex-1 rounded-2xl"
                  onClick={onNext}
                >
                  Proximo
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  className="min-h-12 flex-1 rounded-2xl"
                  onClick={onSubmit}
                  disabled={isSaving || (!!proposalId && !isDirty)}
                >
                  {isSaving
                    ? "Salvando..."
                    : proposalId
                      ? "Salvar proposta"
                      : "Criar proposta"}
                </Button>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function QuickTopMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/8 ${className ?? ""}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-5 [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}
