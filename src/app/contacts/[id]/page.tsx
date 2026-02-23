"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ClientService, Client } from "@/services/client-service";
import { usePagePermission } from "@/hooks/usePagePermission";
import { toast } from '@/lib/toast';
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
import {
  StepWizard,
  StepNavigation,
  StepCard,
} from "@/components/ui/step-wizard";
import {
  User,
  Mail,
  MapPin,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle,
  Users,
  Building2,
} from "lucide-react";

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

const customerSteps = [
  {
    id: "info",
    title: "Informações",
    description: "Dados e contato",
    icon: User,
  },
  {
    id: "address",
    title: "Endereço",
    description: "Localização",
    icon: MapPin,
  },
  {
    id: "notes",
    title: "Finalizar",
    description: "Observações",
    icon: CheckCircle,
  },
];

type CustomerType = "cliente" | "fornecedor";

interface EditCustomerFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  types: CustomerType[];
}

const buildCustomerFormSnapshot = (formData: EditCustomerFormData): string =>
  JSON.stringify({
    name: formData.name,
    email: formData.email,
    phone: formData.phone,
    address: formData.address,
    notes: formData.notes,
    types: [...formData.types].sort(),
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
    types: ["cliente"],
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
            types: data.types || ["cliente"],
          };
          setFormData(initialFormData);
          setInitialSnapshot(buildCustomerFormSnapshot(initialFormData));
        }
      } catch (error) {
        console.error("Error fetching client:", error);
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
    // Clear error when user starts typing (exclude types since it's not in schema)
    if (name !== "types" && errors[name as keyof typeof errors]) {
      clearFieldError(name as Exclude<keyof typeof formData, "types">);
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    // Exclude types since it's not in schema
    if (name !== "types") {
      validateField(
        name as Exclude<keyof typeof formData, "types">,
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
        types: formData.types,
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
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando cliente...</p>
        </div>
      </div>
    );
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

  // Read-only view for users without edit permission
  if (!canEdit) {
    return (
      <FormContainer className="max-w-3xl">
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
          <StepCard>
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
            </div>
            <StepNavigation />
          </StepCard>

          {/* Step 2: Address */}
          <StepCard>
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Endereço</h3>
                  <p className="text-sm text-muted-foreground">
                    Localização para entregas e correspondências
                  </p>
                </div>
              </div>

              <FormStatic label="Endereço Completo" value={formData.address} />
            </div>
            <StepNavigation />
          </StepCard>

          {/* Step 3: Notes */}
          <StepCard>
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
          </StepCard>
        </StepWizard>
      </FormContainer>
    );
  }

  return (
    <FormContainer className="max-w-3xl">
      <FormHeader
        title="Editar Cliente"
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
        <StepCard>
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

            {/* Type selector - checkboxes for multi-selection */}
            <FormItem
              label="Tipo de Cadastro (selecione um ou ambos)"
              htmlFor="types"
              required
            >
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => {
                      const hasType = prev.types.includes("cliente");
                      const newTypes = hasType
                        ? (prev.types.filter((t) => t !== "cliente") as (
                            | "cliente"
                            | "fornecedor"
                          )[])
                        : [...prev.types, "cliente" as const];
                      // Ensure at least one type is always selected
                      return {
                        ...prev,
                        types: newTypes.length > 0 ? newTypes : ["cliente"],
                      };
                    });
                  }}
                  className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    formData.types.includes("cliente")
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.types.includes("cliente")
                        ? "bg-primary/10"
                        : "bg-muted"
                    }`}
                  >
                    <Users
                      className={`w-5 h-5 ${formData.types.includes("cliente") ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </div>
                  <div className="text-left">
                    <p
                      className={`font-medium ${formData.types.includes("cliente") ? "text-primary" : ""}`}
                    >
                      Cliente
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Comprador de produtos/serviços
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => {
                      const hasType = prev.types.includes("fornecedor");
                      const newTypes = hasType
                        ? (prev.types.filter((t) => t !== "fornecedor") as (
                            | "cliente"
                            | "fornecedor"
                          )[])
                        : [...prev.types, "fornecedor" as const];
                      // Ensure at least one type is always selected
                      return {
                        ...prev,
                        types: newTypes.length > 0 ? newTypes : ["fornecedor"],
                      };
                    });
                  }}
                  className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    formData.types.includes("fornecedor")
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.types.includes("fornecedor")
                        ? "bg-primary/10"
                        : "bg-muted"
                    }`}
                  >
                    <Building2
                      className={`w-5 h-5 ${formData.types.includes("fornecedor") ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </div>
                  <div className="text-left">
                    <p
                      className={`font-medium ${formData.types.includes("fornecedor") ? "text-primary" : ""}`}
                    >
                      Fornecedor
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vendedor de produtos/serviços
                    </p>
                  </div>
                </button>
              </div>
            </FormItem>

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
          </div>
          <StepNavigation onBeforeNext={validateStep1} />
        </StepCard>

        {/* Step 2: Address */}
        <StepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Endereço</h3>
                <p className="text-sm text-muted-foreground">
                  Localização para entregas e correspondências
                </p>
              </div>
            </div>

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
          <StepNavigation />
        </StepCard>

        {/* Step 3: Notes & Submit */}
        <StepCard>
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
        </StepCard>
      </StepWizard>
    </FormContainer>
  );
}
