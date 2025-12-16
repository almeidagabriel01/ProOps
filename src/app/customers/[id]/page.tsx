"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClientService, Client } from "@/services/client-service";
import { ArrowLeft, Loader2, Save, User } from "lucide-react";

const sourceLabels: Record<string, string> = {
  manual: "Cadastro Manual",
  proposal: "Criado via Proposta",
  financial: "Criado via Financeiro",
};

import { usePagePermission } from "@/hooks/usePagePermission";

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const { canEdit } = usePagePermission("customers");

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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <Button variant="outline" onClick={() => router.push("/customers")}>
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/customers")}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {canEdit ? "Editar Cliente" : "Detalhes do Cliente"}
            </h1>
            <Badge variant="outline">
              {sourceLabels[client.source] || sourceLabels.manual}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {canEdit ? "Atualize as informações do cliente" : "Visualizando informações do cliente"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Nome completo ou razão social"
                required
                disabled={!canEdit}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@exemplo.com"
                  disabled={!canEdit}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(11) 99999-9999"
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Endereço completo"
                disabled={!canEdit}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Anotações sobre o cliente..."
                rows={3}
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/customers")}
          >
            {canEdit ? "Cancelar" : "Voltar"}
          </Button>
          {canEdit && (
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
