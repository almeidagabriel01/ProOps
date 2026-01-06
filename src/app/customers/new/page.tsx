"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useClientActions } from "@/hooks/useClientActions";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useFormValidation } from "@/hooks/useFormValidation";
import { customerSchema } from "@/lib/validations";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormContainer,
  FormHeader,
  FormGroup,
  FormItem,
} from "@/components/ui/form-components";
import {
  StepWizard,
  StepNavigation,
  StepCard,
} from "@/components/ui/step-wizard";
import {
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Loader2,
  CheckCircle,
} from "lucide-react";

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

export default function NewCustomerPage() {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreateClient, getClientCount, features } = usePlanLimits();
  const { canCreate, isLoading: permLoading } = usePagePermission("clients");
  const { createClient, isLoading: isCreating } = useClientActions();
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
    if (!permLoading && !canCreate) {
      router.push("/customers");
    }
  }, [permLoading, canCreate, router]);

  const [showLimitModal, setShowLimitModal] = React.useState(false);
  const [currentClientCount, setCurrentClientCount] = React.useState(0);

  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      clearFieldError(name as keyof typeof formData);
    }
  };

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    validateField(name as keyof typeof formData, value, formData);
  };

  // Step 1 validation: Name, Email and Phone are required
  const validateStep1 = (): boolean => {
    let isValid = true;

    if (!formData.name.trim()) {
      setFieldError("name", "Nome é obrigatório");
      isValid = false;
    }
    if (!formData.email.trim()) {
      setFieldError("email", "Email é obrigatório");
      isValid = false;
    }
    if (!formData.phone.trim()) {
      setFieldError("phone", "Telefone é obrigatório");
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async () => {
    // Validate form before submit
    if (!validateForm(formData)) {
      return;
    }

    const canCreateNew = await canCreateClient();
    if (!canCreateNew) {
      const count = await getClientCount();
      setCurrentClientCount(count);
      setShowLimitModal(true);
      return;
    }

    if (!tenant) {
      alert("Erro: Nenhuma empresa selecionada!");
      return;
    }

    try {
      const result = await createClient({
        name: formData.name.trim(),
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        notes: formData.notes || undefined,
        source: "manual",
        targetTenantId: tenant?.id, // Ensure correct tenant for super admin
      });

      if (result?.success) {
        router.push("/customers");
      }
    } catch (error) {
      // Handled by hook
    }
  };

  // Show loading while checking permissions OR while redirecting (no permission)
  if (permLoading || !canCreate) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <FormContainer className="max-w-3xl">
      <FormHeader
        title="Novo Cliente"
        subtitle="Adicione um novo cliente à sua base de contatos"
        icon={User}
        onBack={() => router.push("/customers")}
      />

      <StepWizard steps={customerSteps}>
        {/* Step 1: Basic Info + Contact */}
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
              <FormItem
                label="Email"
                htmlFor="email"
                required
                error={errors.email}
              >
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
                  required
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
                <h3 className="text-lg font-semibold">Finalizar Cadastro</h3>
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
            isSubmitting={isCreating}
            submitLabel="Cadastrar Cliente"
          />
        </StepCard>
      </StepWizard>

      <LimitReachedModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        resourceType="clients"
        currentCount={currentClientCount}
        maxLimit={features?.maxClients || 0}
      />
    </FormContainer>
  );
}
