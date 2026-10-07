"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileSignature, HardHat, Receipt, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ClientSelect } from "@/components/features/client-select";
import { ItemsEditor } from "@/components/features/field-service/items-editor";
import { PmocItemsEditor } from "@/components/features/field-service/pmoc-items-editor";
import { useTenant } from "@/providers/tenant-provider";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePermission, useSensitiveData } from "@/hooks/usePermission";
import { toast } from "@/lib/toast";
import { FormContainer, FormHeader } from "@/components/ui/form-components";
import { FormStepCard } from "@/components/ui/form-step-card";
import { StepNavigation, StepWizard } from "@/components/ui/step-wizard";
import {
  BILLING_DAYS,
  CONTRACT_TYPE_LABELS,
  VISIT_INTERVAL_OPTIONS,
} from "@/lib/field-service/contracts";
import { buildPmocItems, type PmocItem } from "@/lib/field-service/pmoc";
import { parseOptionalNumber, validatePmocForm, type PmocFormErrors } from "@/lib/field-service/pmoc-form";
import { FieldService } from "@/services/field-service-service";
import { TechnicalResponsiblesService } from "@/services/technical-responsibles-service";
import { WalletService, type WalletOption } from "@/services/wallet-service";
import type {
  ContractLine,
  ContractType,
  CustomerEquipment,
  ServiceContract,
  ServiceContractInput,
  ServiceOrderItem,
  TechnicalResponsible,
} from "@/types/field-service";

interface ContractFormProps {
  /** Ausente: contrato novo. */
  contract?: ServiceContract | null;
}

const STEPS = [
  { id: "contract", title: "Contrato", description: "Cliente e itens", icon: FileSignature },
  { id: "billing", title: "Cobrança", description: "Vencimento e carteira", icon: Receipt },
  { id: "visits", title: "Visitas", description: "Preventivas e equipamentos", icon: Wrench },
];

// O PMOC mora no terceiro passo, junto das visitas que ele organiza: a trilha
// tem o mesmo tamanho nos dois tipos (guard step-wizard-children-parity).
const PMOC_STEPS = [
  { id: "contract", title: "Contrato", description: "Cliente e itens", icon: FileSignature },
  { id: "billing", title: "Cobrança", description: "Vencimento e carteira", icon: Receipt },
  { id: "visits", title: "Visitas e PMOC", description: "Plano, prédio e responsável", icon: HardHat },
];

interface FormState {
  clientId: string;
  clientName: string;
  title: string;
  type: ContractType;
  items: ServiceOrderItem[];
  billingDay: number;
  wallet: string;
  issueNfse: boolean;
  endDate: string;
  equipmentIds: string[];
  visitsEnabled: boolean;
  intervalMonths: number;
  technicianId: string;
  checklistText: string;
  notes: string;
  responsibleId: string;
  buildingName: string;
  buildingAddress: string;
  occupants: string;
  climatizedArea: string;
  buildingUse: string;
  pmocItems: PmocItem[];
}

function toItems(lines: ContractLine[]): ServiceOrderItem[] {
  return lines.map((line) => ({ ...line, fromStock: false }));
}

function toLines(items: ServiceOrderItem[]): ContractLine[] {
  return items.map(({ id, kind, refId, name, quantity, unitPrice }) => ({
    id,
    kind,
    refId,
    name: name.trim() || "Item",
    quantity,
    unitPrice,
  }));
}

function initialState(
  contract: ServiceContract | null | undefined,
  defaults: { type: ContractType; checklist: string[] },
): FormState {
  return {
    clientId: contract?.clientId ?? "",
    clientName: contract?.clientName ?? "",
    title: contract?.title ?? "",
    type: contract?.type ?? defaults.type,
    items: toItems(contract?.lines ?? []),
    billingDay: contract?.billingDay ?? 10,
    wallet: contract?.wallet ?? "",
    issueNfse: contract?.issueNfse ?? false,
    endDate: contract?.endDate ?? "",
    equipmentIds: contract?.equipmentIds ?? [],
    visitsEnabled: contract?.visitPlan.enabled ?? false,
    intervalMonths: contract?.visitPlan.intervalMonths ?? 3,
    technicianId: contract?.visitPlan.technicianId ?? "",
    checklistText: (contract ? contract.visitPlan.checklist : defaults.checklist).join("\n"),
    notes: contract?.notes ?? "",
    responsibleId: contract?.pmoc?.responsibleId ?? "",
    buildingName: contract?.pmoc?.building.name ?? "",
    buildingAddress: contract?.pmoc?.building.address ?? "",
    occupants: contract?.pmoc?.building.occupants != null ? String(contract.pmoc.building.occupants) : "",
    climatizedArea:
      contract?.pmoc?.building.climatizedArea != null ? String(contract.pmoc.building.climatizedArea) : "",
    buildingUse: contract?.pmoc?.building.use ?? "",
    pmocItems: contract?.pmoc?.items ?? [],
  };
}

/**
 * O contrato de manutenção: o que se cobra todo mês, em que dia, em qual
 * carteira, e as visitas preventivas que ele promete. Nasce rascunho; a
 * cobrança começa ao ativar, na tela do contrato.
 *
 * Página em etapas, e não janela: com os itens, a cobrança e as visitas, o
 * formulário passava da altura da tela e a janela precisava rolar por dentro.
 */
export function ContractForm({ contract }: ContractFormProps) {
  const router = useRouter();
  const { tenant } = useTenant();
  const niche = useCurrentNicheConfig();
  const { hasFiscal } = usePlanLimits();
  const { canSeeContractValues } = useSensitiveData();
  // "Editar a cobrança": num contrato que já cobra, linhas, dia, carteira e
  // NFS-e ficam só leitura sem ela (o rascunho não cobra, então segue livre).
  const canEditBilling = usePermission("contracts", "editBilling");
  const billingLocked = Boolean(contract && contract.status !== "draft" && !canEditBilling);
  const defaults = React.useMemo(
    () => ({ type: niche.fieldService.defaultContractType, checklist: niche.fieldService.preventiveChecklist }),
    [niche.fieldService.defaultContractType, niche.fieldService.preventiveChecklist],
  );
  const [form, setForm] = React.useState<FormState>(() => initialState(contract, defaults));
  const [saving, setSaving] = React.useState(false);
  const [wallets, setWallets] = React.useState<WalletOption[]>([]);
  const [equipment, setEquipment] = React.useState<CustomerEquipment[]>([]);
  const [technicians, setTechnicians] = React.useState<{ id: string; name: string }[]>([]);
  const [responsibles, setResponsibles] = React.useState<TechnicalResponsible[]>([]);
  const [pmocErrors, setPmocErrors] = React.useState<PmocFormErrors>({});
  const isPmoc = form.type === "pmoc";
  const steps = form.type === "pmoc" ? PMOC_STEPS : STEPS;
  // O tipo PMOC só existe no nicho que o liga; um contrato que já é PMOC
  // continua editável mesmo assim.
  const typeOptions = (Object.keys(CONTRACT_TYPE_LABELS) as ContractType[]).filter(
    (type) => type !== "pmoc" || niche.fieldService.pmoc || contract?.type === "pmoc",
  );

  React.useEffect(() => {
    if (!tenant?.id) return;
    // Sem saldo: quem cadastra o contrato não precisa ver o financeiro.
    WalletService.getWalletOptions()
      .then((list) => {
        const active = list.filter((w) => w.status !== "archived");
        setWallets(active);
        setForm((f) => (f.wallet ? f : { ...f, wallet: (active.find((w) => w.isDefault) ?? active[0])?.id ?? "" }));
      })
      .catch(() => setWallets([]));
    FieldService.listTechnicians()
      .then(({ technicians: list }) => setTechnicians(list))
      .catch(() => setTechnicians([]));
  }, [tenant?.id]);

  const pmocEnabled = niche.fieldService.pmoc;
  React.useEffect(() => {
    if (!tenant?.id || !pmocEnabled) return;
    TechnicalResponsiblesService.list(tenant.id)
      .then(setResponsibles)
      .catch(() => setResponsibles([]));
  }, [tenant?.id, pmocEnabled]);

  React.useEffect(() => {
    if (!tenant?.id || !form.clientId) {
      setEquipment([]);
      return;
    }
    let cancelled = false;
    FieldService.listEquipment(tenant.id, form.clientId)
      .then((list) => !cancelled && setEquipment(list.filter((e) => e.status === "active")))
      .catch(() => !cancelled && setEquipment([]));
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, form.clientId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const coveredTypes = (ids: string[]) =>
    equipment.filter((item) => ids.includes(item.id)).map((item) => item.type);

  /** O plano parte do modelo dos aparelhos cobertos; sem aparelho, o do split. */
  const rebuildPmocItems = () => set("pmocItems", buildPmocItems(coveredTypes(form.equipmentIds)));

  const changeType = (type: ContractType) =>
    setForm((f) => {
      if (type !== "pmoc") return { ...f, type };
      return {
        ...f,
        type,
        // Sem visitas não há PMOC: o plano é executado nelas.
        visitsEnabled: true,
        pmocItems: f.pmocItems.length > 0 ? f.pmocItems : buildPmocItems(coveredTypes(f.equipmentIds)),
      };
    });

  const activeResponsibles = responsibles.filter((r) => r.active || r.id === form.responsibleId);
  const clientLocked = Boolean(contract && contract.status !== "draft");
  const [errors, setErrors] = React.useState<Partial<Record<"client" | "title" | "items" | "wallet", string>>>({});
  const back = () => router.push(contract ? `/contracts/${contract.id}` : "/contracts");

  const validateContract = (): boolean => {
    const next: typeof errors = {};
    if (!form.clientId) next.client = "Escolha o cliente.";
    if (form.title.trim().length < 2) next.title = "Dê um nome ao contrato.";
    if (form.items.length === 0) next.items = "Inclua ao menos um item na mensalidade.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateBilling = (): boolean => {
    if (form.wallet) return true;
    setErrors((e) => ({ ...e, wallet: "Escolha a carteira que recebe a mensalidade." }));
    return false;
  };

  const validatePmoc = (): boolean => {
    if (!isPmoc) return true;
    const next = validatePmocForm({
      items: form.pmocItems,
      occupants: form.occupants,
      climatizedArea: form.climatizedArea,
    });
    setPmocErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validateContract() || !validateBilling() || !validatePmoc()) return;
    setSaving(true);
    const input: ServiceContractInput = {
      clientId: form.clientId,
      title: form.title.trim(),
      type: form.type,
      // Sem "Ver valores" a tela não tem os preços para mandar: o backend
      // mantém as linhas gravadas.
      ...(canSeeContractValues ? { lines: toLines(form.items) } : {}),
      billingDay: form.billingDay,
      wallet: form.wallet,
      issueNfse: form.issueNfse,
      equipmentIds: form.equipmentIds,
      visitPlan: {
        enabled: form.visitsEnabled,
        intervalMonths: form.intervalMonths,
        technicianId: form.technicianId || null,
        checklist: form.checklistText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 60),
      },
      notes: form.notes.trim() || null,
      endDate: form.endDate || null,
      pmoc: isPmoc
        ? {
            responsibleId: form.responsibleId || null,
            building: {
              name: form.buildingName.trim() || null,
              address: form.buildingAddress.trim() || null,
              occupants: parseOptionalNumber(form.occupants, true) ?? null,
              climatizedArea: parseOptionalNumber(form.climatizedArea) ?? null,
              use: form.buildingUse.trim() || null,
            },
            items: form.pmocItems.map((item) => ({ ...item, text: item.text.trim() })),
          }
        : null,
    };
    try {
      if (contract) {
        const { clientId, ...rest } = input;
        await FieldService.updateContract(contract.id, clientLocked ? rest : { clientId, ...rest });
        toast.success("Contrato atualizado.");
        router.push(`/contracts/${contract.id}`);
      } else {
        const created = await FieldService.createContract(input);
        toast.success(`Contrato ${created.code} criado como rascunho.`);
        router.push(`/contracts/${created.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar o contrato.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormContainer>
      <FormHeader
        title={contract ? `Editar ${contract.code}` : "Novo contrato"}
        subtitle="A mensalidade que o cliente paga todo mês e as visitas que o contrato garante. A cobrança começa quando você ativar o contrato."
        icon={FileSignature}
        onBack={back}
      />

      <StepWizard steps={steps} allowClickAhead={Boolean(contract)}>
        <FormStepCard>
          <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Cliente</Label>
              <ClientSelect
                value={form.clientName}
                clientId={form.clientId || undefined}
                disabled={saving || clientLocked}
                onChange={(data) =>
                  setForm((f) => ({
                    ...f,
                    clientId: data.isNew ? "" : (data.clientId ?? ""),
                    clientName: data.clientName,
                    equipmentIds: [],
                  }))
                }
              />
              {errors.client && <p className="text-xs text-destructive">{errors.client}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractTitle">Nome do contrato</Label>
              <Input
                id="contractTitle"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={niche.fieldService.contractTitlePlaceholder}
                maxLength={160}
                disabled={saving}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractType">Tipo</Label>
              <Select
                id="contractType"
                value={form.type}
                onChange={(e) => changeType(e.target.value as ContractType)}
                disableSort
                disabled={saving}
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {CONTRACT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>O que é cobrado todo mês</Label>
            <ItemsEditor
              items={form.items}
              onChange={(items) => set("items", items)}
              disabled={saving || !canSeeContractValues || billingLocked}
              hidePrices={!canSeeContractValues}
              stock={false}
              emptyText="Nenhum item na mensalidade."
              totalLabel="Mensalidade"
              totalSuffix="/mês"
            />
            {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
          </div>

          </div>
          <StepNavigation onBeforeNext={validateContract} />
        </FormStepCard>

        <FormStepCard>
          <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="contractBillingDay">Dia do vencimento</Label>
              <Select
                id="contractBillingDay"
                value={String(form.billingDay)}
                onChange={(e) => set("billingDay", Number(e.target.value))}
                disableSort
                disabled={saving || billingLocked}
              >
                {BILLING_DAYS.map((day) => (
                  <option key={day} value={day}>
                    Todo dia {day}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractWallet">Carteira</Label>
              <Select
                id="contractWallet"
                value={form.wallet}
                onChange={(e) => set("wallet", e.target.value)}
                disabled={saving || billingLocked}
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
              {errors.wallet && <p className="text-xs text-destructive">{errors.wallet}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="contractEndDate">Fim do contrato (opcional)</Label>
              <DatePicker
                id="contractEndDate"
                name="contractEndDate"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <div className="space-y-1">
              <Label htmlFor="contractNfse" className="font-medium">
                Emitir a nota de serviço quando a mensalidade for paga
              </Label>
              <p className="text-xs text-muted-foreground">
                {hasFiscal
                  ? "A nota sai das linhas de serviço do catálogo, no valor da mensalidade paga."
                  : "O seu plano não inclui notas fiscais."}
              </p>
            </div>
            <Switch
              id="contractNfse"
              checked={form.issueNfse}
              onCheckedChange={(checked) => set("issueNfse", checked)}
              disabled={saving || billingLocked || (!hasFiscal && !form.issueNfse)}
            />
          </div>

          </div>
          <StepNavigation onBeforeNext={validateBilling} />
        </FormStepCard>

        <FormStepCard>
          <div className="space-y-6">
          <div className="space-y-4 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="contractVisits" className="font-medium">
                  Visitas preventivas
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isPmoc
                    ? "No PMOC as visitas são obrigatórias: cada uma leva os itens do plano que venceram."
                    : "A OS da visita abre sozinha uma semana antes, com o técnico e o checklist abaixo."}
                </p>
              </div>
              <Switch
                id="contractVisits"
                checked={form.visitsEnabled}
                onCheckedChange={(checked) => set("visitsEnabled", checked)}
                disabled={saving || isPmoc}
              />
            </div>
            {form.visitsEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contractInterval">Frequência</Label>
                  <Select
                    id="contractInterval"
                    value={String(form.intervalMonths)}
                    onChange={(e) => set("intervalMonths", Number(e.target.value))}
                    disableSort
                    disabled={saving}
                  >
                    {VISIT_INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractTechnician">Técnico</Label>
                  <Select
                    id="contractTechnician"
                    value={form.technicianId}
                    onChange={(e) => set("technicianId", e.target.value)}
                    disabled={saving}
                    placeholder="Sem técnico definido"
                  >
                    <option value="">Sem técnico definido</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
                {!isPmoc && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contractChecklist">Checklist da visita (um item por linha)</Label>
                  <Textarea
                    id="contractChecklist"
                    value={form.checklistText}
                    onChange={(e) => set("checklistText", e.target.value)}
                    rows={4}
                    maxLength={6000}
                    disabled={saving}
                  />
                </div>
                )}
              </div>
            )}
          </div>

          {form.clientId && equipment.length > 0 && (
            <div className="space-y-2">
              <Label>Equipamentos cobertos</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {equipment.map((item) => {
                  const checked = form.equipmentIds.includes(item.id);
                  return (
                    <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
                      <Checkbox
                        checked={checked}
                        disabled={saving}
                        onCheckedChange={(next) =>
                          set(
                            "equipmentIds",
                            next ? [...form.equipmentIds, item.id] : form.equipmentIds.filter((id) => id !== item.id),
                          )
                        }
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[item.brand, item.model, item.location].filter(Boolean).join(" · ") || "Sem detalhes"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}


          {isPmoc && (
            <div className="space-y-6 rounded-xl border p-4">
              <div className="space-y-1">
                <p className="font-medium">PMOC</p>
                <p className="text-xs text-muted-foreground">
                  O plano que a Lei 13.589/2018 exige do prédio climatizado, assinado pelo responsável técnico.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pmocResponsible">Responsável técnico</Label>
                <Select
                  id="pmocResponsible"
                  value={form.responsibleId}
                  onChange={(e) => set("responsibleId", e.target.value)}
                  disabled={saving}
                  placeholder="Escolha quem assina o PMOC"
                >
                  <option value="">Escolha quem assina o PMOC</option>
                  {activeResponsibles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.council} {r.registryNumber})
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  {activeResponsibles.length === 0 ? (
                    <>
                      Nenhum responsável cadastrado.{" "}
                      <Link href="/settings/technical-responsibles" className="text-primary underline-offset-4 hover:underline">
                        Cadastre em Configurações
                      </Link>
                      . O rascunho salva sem ele, mas só ativa com ele.
                    </>
                  ) : (
                    "Obrigatório para ativar o contrato."
                  )}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pmocBuildingName">Prédio ou estabelecimento</Label>
                  <Input
                    id="pmocBuildingName"
                    value={form.buildingName}
                    onChange={(e) => set("buildingName", e.target.value)}
                    placeholder="Ex.: Clínica Centro"
                    maxLength={160}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pmocBuildingUse">Uso do ambiente</Label>
                  <Input
                    id="pmocBuildingUse"
                    value={form.buildingUse}
                    onChange={(e) => set("buildingUse", e.target.value)}
                    placeholder="Ex.: escritório, loja, clínica"
                    maxLength={120}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pmocBuildingAddress">Endereço do prédio</Label>
                  <Input
                    id="pmocBuildingAddress"
                    value={form.buildingAddress}
                    onChange={(e) => set("buildingAddress", e.target.value)}
                    placeholder="Em branco, vale o endereço do cliente"
                    maxLength={300}
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pmocOccupants">Ocupantes (fixos e flutuantes)</Label>
                  <Input
                    id="pmocOccupants"
                    inputMode="numeric"
                    value={form.occupants}
                    onChange={(e) => set("occupants", e.target.value)}
                    maxLength={9}
                    disabled={saving}
                  />
                  {pmocErrors.occupants && <p className="text-xs text-destructive">{pmocErrors.occupants}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pmocArea">Área climatizada (m²)</Label>
                  <Input
                    id="pmocArea"
                    inputMode="decimal"
                    value={form.climatizedArea}
                    onChange={(e) => set("climatizedArea", e.target.value)}
                    maxLength={12}
                    disabled={saving}
                  />
                  {pmocErrors.climatizedArea && (
                    <p className="text-xs text-destructive">{pmocErrors.climatizedArea}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label>Itens do plano</Label>
                    <p className="text-xs text-muted-foreground">
                      Cada visita leva os itens cuja frequência venceu. A primeira leva todos.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={rebuildPmocItems} disabled={saving}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Montar pelos equipamentos
                  </Button>
                </div>
                <PmocItemsEditor
                  items={form.pmocItems}
                  onChange={(items) => set("pmocItems", items)}
                  disabled={saving}
                />
                {pmocErrors.items && <p className="text-xs text-destructive">{pmocErrors.items}</p>}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="contractNotes">Observações</Label>
            <Textarea
              id="contractNotes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              maxLength={4000}
              disabled={saving}
            />
          </div>

          </div>
          <StepNavigation
            onSubmit={() => void submit()}
            isSubmitting={saving}
            submitLabel={contract ? "Salvar alterações" : "Criar contrato"}
          />
        </FormStepCard>
      </StepWizard>
    </FormContainer>
  );
}
