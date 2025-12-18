"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { ClientService, Client } from "@/services/client-service";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FormContainer,
  FormHeader,
  FormSection,
  FormGroup,
  FormItem,
  FormStatic,
  FormActions,
} from "@/components/ui/form-components";
import {
  User,
  Mail,
  Phone,
  MapPin,
  FileText,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";

const sourceLabels: Record<string, { label: string; color: string }> = {
  manual: { label: "Cadastro Manual", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  proposal: { label: "Via Proposta", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  financial: { label: "Via Financeiro", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
};

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const { canEdit, canView, isLoading: permLoading } = usePagePermission("clients");

  React.useEffect(() => {
    if (!permLoading && !canView) {
      router.push("/customers");
    }
  }, [permLoading, canView, router]);

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [client, setClient] = React.useState<Client | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  React.useEffect(() => {
    const fetchClient = async () => {
      try {
        const data = await ClientService.getClientById(clientId);
        if (data) {
          setClient(data);
          setFormData({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
            notes: data.notes || "",
          });
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("O nome do cliente é obrigatório!");
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
      });

      alert("Cliente atualizado com sucesso!");
      router.push("/customers");
    } catch (error) {
      console.error("Error updating client:", error);
      alert("Erro ao atualizar cliente");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
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
            onClick={() => router.push("/customers")}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Voltar para Clientes
          </button>
        </div>
      </div>
    );
  }

  const sourceInfo = sourceLabels[client.source] || sourceLabels.manual;

  return (
    <FormContainer className="max-w-3xl">
      <FormHeader
        title={canEdit ? "Editar Cliente" : "Detalhes do Cliente"}
        subtitle={
          canEdit
            ? `Atualize as informações de "${formData.name}"`
            : `Visualizando dados de "${formData.name}"`
        }
        icon={User}
        onBack={() => router.push("/customers")}
        badge={
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${sourceInfo.color}`}>
            {sourceInfo.label}
          </span>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <FormSection
          title="Informações Básicas"
          description="Dados principais de identificação"
          icon={User}
        >
          {canEdit ? (
            <>
              <FormItem label="Nome Completo" htmlFor="name" required>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Nome completo ou razão social"
                  icon={<User className="w-4 h-4" />}
                  required
                />
              </FormItem>

              <FormGroup>
                <FormItem label="Email" htmlFor="email">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="email@exemplo.com"
                    icon={<Mail className="w-4 h-4" />}
                  />
                </FormItem>

                <FormItem label="Telefone" htmlFor="phone">
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(11) 99999-9999"
                    icon={<Phone className="w-4 h-4" />}
                  />
                </FormItem>
              </FormGroup>
            </>
          ) : (
            <>
              <FormStatic label="Nome Completo" value={formData.name} />
              <FormGroup>
                <FormStatic label="Email" value={formData.email} />
                <FormStatic label="Telefone" value={formData.phone} />
              </FormGroup>
            </>
          )}
        </FormSection>

        {/* Address */}
        <FormSection
          title="Localização"
          description="Endereço para entregas e correspondências"
          icon={MapPin}
        >
          {canEdit ? (
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
          ) : (
            <FormStatic label="Endereço" value={formData.address} />
          )}
        </FormSection>

        {/* Notes */}
        <FormSection
          title="Observações"
          description="Anotações e informações adicionais"
          icon={FileText}
          collapsible
          defaultOpen={!!formData.notes}
        >
          {canEdit ? (
            <FormItem label="Notas" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Informações relevantes sobre o cliente..."
                className="min-h-[100px]"
              />
            </FormItem>
          ) : (
            <FormStatic label="Notas" value={formData.notes} />
          )}
        </FormSection>

        {/* Actions */}
        <FormActions
          onCancel={() => router.push("/customers")}
          isSubmitting={isSaving}
          isReadOnly={!canEdit}
          submitLabel="Salvar Alterações"
          submitIcon={<Save className="w-4 h-4" />}
        />
      </form>
    </FormContainer>
  );
}
