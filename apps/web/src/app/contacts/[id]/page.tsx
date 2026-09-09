"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ClientService, Client, type ClientType } from "@/services/client-service";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from "@/lib/toast";
import {
  formatEnderecoFiscal,
  isDerivedFreeAddress,
} from "@/lib/fiscal/format-address";
import {
  ClientFiscalFields,
  EMPTY_CLIENT_FISCAL,
  type ClientFiscalValues,
} from "@/components/features/fiscal/client-fiscal-fields";
import { useFormValidation } from "@/hooks/useFormValidation";
import { customerSchema } from "@/lib/validations";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormContainer,
  FormHeader,
  FormGroup,
  FormItem,
  FormStatic,
} from "@/components/ui/form-components";
import { StepWizard, StepNavigation } from "@/components/ui/step-wizard";
import { FormStepCard } from "@/components/ui/form-step-card";
import { User, Mail, MapPin, FileText, AlertCircle, CheckCircle, Receipt, CreditCard, Percent } from "lucide-react";
import { ContactTypeSelector } from "../_components/contact-type-selector";
import { ContactCommissionField } from "../_components/contact-commission-field";
import { isCommissionPartner } from "@/lib/contacts/commission-partner";
import { EntityLoadingState } from "@/components/shared/entity-loading-state";
import { formatDocumento } from "@/lib/format-document";


const sourceLabels: Record<string, { label: string; color: string }> = {
  manual: {
    label: "Cadastro Manual",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  proposal: {
    label: "Via Proposta",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  financial: {
    label: "Via Financeiro",
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
};

/**
 * A trilha é a MESMA de `/contacts/new`: o passo 1 responde "quem é este
 * contato", endereço incluído, e o passo 2 junta o que quase todo cadastro
 * pula, a comissão do parceiro e os campos da nota.
 */
const customerSteps = [
  {
    id: "info",
    title: "Informações",
    description: "Contato e endereço",
    icon: User,
  },
  {
    id: "fiscal",
    title: "Dados Fiscais",
    description: "NF-e e comissão",
    icon: Receipt,
  },
  {
    id: "notes",
    title: "Finalizar",
    description: "Observações",
    icon: CheckCircle,
  },
];

type CustomerType = ClientType;

interface EditCustomerFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  document: string;
  types: CustomerType[];
  commissionPercentage: number | null;
  fiscal: ClientFiscalValues;
}

const buildCustomerFormSnapshot = (formData: EditCustomerFormData): string =>
  JSON.stringify({
    name: formData.name,
    email: formData.email,
    phone: formData.phone,
    address: formData.address,
    notes: formData.notes,
    document: formData.document,
    types: [...formData.types].sort(),
    commissionPercentage: formData.commissionPercentage,
    // Sem isto, editar só um campo fiscal não marcaria o formulário como sujo
    // e o botão de salvar continuaria desabilitado.
    fiscal: formData.fiscal,
  });

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const {
    canEdit,
    canView,
    isLoading: permLoading,
  } = usePagePermission("clients");
  // Demo/free accounts have canEdit=true for UI parity but must not edit.
  const { isReadOnly } = useTenant();
  const isEditable = canEdit && !isReadOnly;
  const {
    errors,
    validateField,
    validateForm,
    clearFieldError,
    setFieldError,
  } = useFormValidation({
    schema: customerSchema,
  });

  React.useEffect(() => {
    if (!permLoading && !canView) {
      router.push("/contacts");
    }
  }, [permLoading, canView, router]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [client, setClient] = React.useState<Client | null>(null);

  const [formData, setFormData] = React.useState<EditCustomerFormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    document: "",
    types: ["cliente"],
    commissionPercentage: null,
    fiscal: EMPTY_CLIENT_FISCAL,
  });
  const [initialSnapshot, setInitialSnapshot] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    const fetchClient = async () => {
      try {
        const data = await ClientService.getClientById(clientId);
        if (data) {
          setClient(data);
          const initialFormData: EditCustomerFormData = {
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
            notes: data.notes || "",
            document: data.document ? formatDocumento(data.document) : "",
            types: data.types || ["cliente"],
            commissionPercentage: data.commissionPercentage ?? null,
            fiscal: {
              cep: data.enderecoFiscal?.cep ?? "",
              logradouro: data.enderecoFiscal?.logradouro ?? "",
              numero: data.enderecoFiscal?.numero ?? "",
              complemento: data.enderecoFiscal?.complemento ?? "",
              bairro: data.enderecoFiscal?.bairro ?? "",
              municipio: data.enderecoFiscal?.municipio ?? "",
              uf: data.enderecoFiscal?.uf ?? "",
              codigoIbge: data.enderecoFiscal?.codigoIbge ?? "",
              inscricaoEstadual: data.inscricaoEstadual ?? "",
              indicadorIe: data.indicadorIe ?? "",
            },
          };
          setFormData(initialFormData);
          setInitialSnapshot(buildCustomerFormSnapshot(initialFormData));
        }
      } catch (error) {
        console.error("Error fetching client:", error);
        toast.error(
          "Não foi possível carregar os dados do cliente. Verifique sua conexão.",
          {
            title: "Erro ao carregar",
          },
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing. `types` e `fiscal` ficam de fora:
    // nenhum dos dois está no schema de validação, e ambos são editados por
    // componentes próprios, não por este handler de <input name=...>.
    if (name !== "types" && errors[name as keyof typeof errors]) {
      clearFieldError(
        name as Exclude<
          keyof typeof formData,
          "types" | "fiscal" | "commissionPercentage"
        >,
      );
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDocumento(e.target.value);
    setFormData((prev) => ({ ...prev, document: formatted }));
    if (errors.document) {
      clearFieldError("document");
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    // Exclude types since it's not in schema
    if (name !== "types") {
      validateField(
        name as Exclude<
          keyof typeof formData,
          "types" | "fiscal" | "commissionPercentage"
        >,
        value,
        formData,
      );
    }
  };

  const hasChanges = React.useMemo(() => {
    if (!initialSnapshot) return false;

    return buildCustomerFormSnapshot(formData) !== initialSnapshot;
  }, [formData, initialSnapshot]);

  // Step 1 validation: Name and Phone are required
  const validateStep1 = (): boolean => {
    let isValid = true;

    if (!formData.name.trim()) {
      setFieldError("name", "Nome é obrigatório");
      isValid = false;
    }
    if (!formData.phone.trim()) {
      setFieldError("phone", "Telefone é obrigatório");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (!hasChanges) {
      return;
    }

    // Validate form before submit
    if (!validateForm(formData)) {
      return;
    }

    if (!formData.name.trim()) {
      setFieldError("name", "O nome do cliente é obrigatório!");
      return;
    }

    setIsSaving(true);

    try {
      await ClientService.updateClient(clientId, {
        name: formData.name.trim(),
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        notes: formData.notes || undefined,
        document: formData.document ? formData.document.replace(/\D/g, "") : undefined,
        types: formData.types,
        commissionPercentage: formData.commissionPercentage,
        enderecoFiscal: {
          cep: formData.fiscal.cep.replace(/\D/g, ""),
          logradouro: formData.fiscal.logradouro.trim(),
          numero: formData.fiscal.numero.trim(),
          complemento: formData.fiscal.complemento.trim(),
          bairro: formData.fiscal.bairro.trim(),
          municipio: formData.fiscal.municipio.trim(),
          uf: formData.fiscal.uf.trim().toUpperCase(),
          codigoIbge: formData.fiscal.codigoIbge.replace(/\D/g, ""),
        },
        inscricaoEstadual: formData.fiscal.inscricaoEstadual.trim(),
        ...(formData.fiscal.indicadorIe
          ? { indicadorIe: formData.fiscal.indicadorIe as Client["indicadorIe"] }
          : {}),
      });

      toast.success("Cliente atualizado com sucesso!");
      router.push("/contacts");
      router.refresh();
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error("Erro ao atualizar cliente. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading while permissions/data loading OR while redirecting (no view permission)
  if (isLoading || permLoading || !canView) {
    return <EntityLoadingState message="Carregando contato..." />;
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              Cliente não encontrado
            </h2>
            <p className="text-muted-foreground text-sm">
              O cliente solicitado não existe ou foi removido.
            </p>
          </div>
          <button
            onClick={() => router.push("/contacts")}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Voltar para Clientes
          </button>
        </div>
      </div>
    );
  }

  const sourceInfo = sourceLabels[client.source] || sourceLabels.manual;

  // Read-only view for users without edit permission (and demo/free accounts)
  if (!isEditable) {
    return (
      <FormContainer>
        <FormHeader
          title="Detalhes do Cliente"
          subtitle={`Visualizando dados de "${formData.name}"`}
          icon={User}
          onBack={() => router.push("/contacts")}
          badge={
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium border ${sourceInfo.color}`}
            >
              {sourceInfo.label}
            </span>
          }
        />

        <StepWizard steps={customerSteps} allowClickAhead>
          {/* Step 1: Basic Info */}
          <FormStepCard>
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    Informações do Cliente
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Dados principais e formas de contato
                  </p>
                </div>
              </div>

              <FormStatic label="Nome Completo" value={formData.name} />
              <FormGroup>
                <FormStatic label="Email" value={formData.email} />
                <FormStatic label="Telefone" value={formData.phone} />
              </FormGroup>
              {formData.document && (
                <FormStatic label="CPF ou CNPJ" value={formData.document} />
              )}
              <FormStatic label="Endereço Completo" value={formData.address} />
            </div>
            <StepNavigation />
          </FormStepCard>

          {/* Step 2: comissão + dados fiscais */}
          <FormStepCard>
            <div className="space-y-6">
              {isCommissionPartner({ types: formData.types }) && (
                <div className="space-y-5 pb-6 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-linear-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                      <Percent className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Comissão</h3>
                      <p className="text-sm text-muted-foreground">
                        Percentual padrão deste parceiro, sugerido ao montar a
                        proposta
                      </p>
                    </div>
                  </div>

                  <FormStatic
                    label="Comissão padrão"
                    value={
                      formData.commissionPercentage === null
                        ? ""
                        : `${formData.commissionPercentage}%`
                    }
                  />
                </div>
              )}

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-linear-to-br from-emerald-500/15 to-emerald-500/5 flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Dados fiscais</h3>
                    <p className="text-sm text-muted-foreground">
                      Usados apenas para emitir nota de produto (NF-e)
                    </p>
                  </div>
                </div>

                <FormStatic
                  label="Endereço fiscal"
                  value={formatEnderecoFiscal(formData.fiscal)}
                />
                <FormGroup>
                  <FormStatic
                    label="Código IBGE do município"
                    value={formData.fiscal.codigoIbge}
                  />
                  <FormStatic
                    label="Inscrição estadual"
                    value={formData.fiscal.inscricaoEstadual}
                  />
                </FormGroup>
              </div>
            </div>
            <StepNavigation />
          </FormStepCard>

          {/* Step 3: Notes */}
          <FormStepCard>
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Observações</h3>
                  <p className="text-sm text-muted-foreground">
                    Notas e informações adicionais
                  </p>
                </div>
              </div>

              <FormStatic label="Observações" value={formData.notes} />
            </div>
            <StepNavigation
              onSubmit={() => router.push("/contacts")}
              submitLabel="Voltar"
            />
          </FormStepCard>
        </StepWizard>
      </FormContainer>
    );
  }

  return (
    <FormContainer>
      <FormHeader
        title="Editar Contato"
        subtitle={`Atualize as informações de "${formData.name}"`}
        icon={User}
        onBack={() => router.push("/contacts")}
        badge={
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium border ${sourceInfo.color}`}
          >
            {sourceInfo.label}
          </span>
        }
      />

      <StepWizard steps={customerSteps} allowClickAhead>
        {/* Step 1: Basic Info + Contact */}
        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  Informações do Cadastro
                </h3>
                <p className="text-sm text-muted-foreground">
                  Dados principais e formas de contato
                </p>
              </div>
            </div>

            <ContactTypeSelector
              types={formData.types}
              onTypesChange={(types) =>
                setFormData((prev) => ({ ...prev, types }))
              }
            />

            <FormItem
              label="Nome Completo"
              htmlFor="name"
              required
              error={errors.name}
            >
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Nome completo ou razão social"
                icon={<User className="w-4 h-4" />}
                className={errors.name ? "border-destructive" : ""}
                required
              />
            </FormItem>

            <FormGroup>
              <FormItem label="Email" htmlFor="email" error={errors.email}>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="email@exemplo.com"
                  icon={<Mail className="w-4 h-4" />}
                  className={errors.email ? "border-destructive" : ""}
                />
              </FormItem>

              <FormItem
                label="Telefone"
                htmlFor="phone"
                required
                error={errors.phone}
              >
                <PhoneInput
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="(11) 99999-9999"
                  className={errors.phone ? "border-destructive" : ""}
                />
              </FormItem>
            </FormGroup>

            <FormItem
              label="CPF ou CNPJ"
              htmlFor="document"
              hint="Necessário para gerar boleto bancário. Pode ser preenchido depois."
              error={errors.document}
            >
              <Input
                id="document"
                name="document"
                value={formData.document}
                onChange={handleDocumentChange}
                onBlur={(e) => validateField("document", e.target.value, formData)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                icon={<CreditCard className="w-4 h-4" />}
                className={errors.document ? "border-destructive" : ""}
              />
            </FormItem>

            <FormItem label="Endereço Completo" htmlFor="address">
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Rua, número, bairro, cidade - UF"
                icon={<MapPin className="w-4 h-4" />}
              />
            </FormItem>
          </div>
          <StepNavigation onBeforeNext={validateStep1} />
        </FormStepCard>

        {/* Step 2: comissão + dados fiscais. A comissão vem primeiro e com
            cabeçalho próprio: divide o passo com o bloco fiscal mas NÃO é dado
            fiscal, e sem separação seria lida como campo da nota. O bloco
            fiscal não recolhe: fechado, ninguém achava o endereço que a NF-e
            exige do destinatário. */}
        <FormStepCard>
          <div className="space-y-6">
            <ContactCommissionField
              types={formData.types}
              value={formData.commissionPercentage}
              onChange={(commissionPercentage) =>
                setFormData((prev) => ({ ...prev, commissionPercentage }))
              }
            />

            <ClientFiscalFields
              variant="step"
              values={formData.fiscal}
              onChange={(fiscal) =>
                setFormData((prev) => ({
                  ...prev,
                  fiscal,
                  // O endereço livre do passo anterior acompanha o fiscal
                  // enquanto ninguém o tiver escrito à mão, para não digitar o
                  // mesmo endereço duas vezes. Texto próprio ("Rua tal, portão
                  // azul") nunca é sobrescrito por uma busca de CEP.
                  address: isDerivedFreeAddress(prev.address, prev.fiscal)
                    ? formatEnderecoFiscal(fiscal)
                    : prev.address,
                }))
              }
              disabled={!isEditable}
            />
          </div>
          <StepNavigation />
        </FormStepCard>

        {/* Step 3: Notes & Submit */}
        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Finalizar Edição</h3>
                <p className="text-sm text-muted-foreground">
                  Observações e confirmação
                </p>
              </div>
            </div>

            <FormItem label="Observações" htmlFor="notes" hint="Opcional">
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Informações relevantes sobre o cliente, preferências, detalhes importantes..."
                className="min-h-[120px]"
              />
            </FormItem>

            {/* Summary card */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50 space-y-4">
              <h4 className="font-semibold text-foreground">
                Resumo do Cliente
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <p className="font-medium truncate">{formData.name || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p className="font-medium truncate">
                    {formData.email || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Telefone:</span>
                  <p className="font-medium">{formData.phone || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Endereço:</span>
                  <p className="font-medium truncate">
                    {formData.address || "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <StepNavigation
            onSubmit={handleSubmit}
            isSubmitting={isSaving}
            submitDisabled={!hasChanges}
            submitLabel="Salvar Alterações"
          />
        </FormStepCard>
      </StepWizard>
    </FormContainer>
  );
}
