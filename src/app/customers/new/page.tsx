"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ClientService } from "@/services/client-service";
import { useTenant } from "@/providers/tenant-provider";
import { ArrowLeft, Loader2, Save, User } from "lucide-react";

export default function NewCustomerPage() {
  const router = useRouter();
  const { tenant } = useTenant();
  const [isSaving, setIsSaving] = React.useState(false);

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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenant) {
      alert("Erro: Nenhuma empresa selecionada!");
      return;
    }

    if (!formData.name.trim()) {
      alert("O nome do cliente é obrigatório!");
      return;
    }

    setIsSaving(true);

    try {
      const now = new Date().toISOString();
      await ClientService.createClient({
        tenantId: tenant.id,
        name: formData.name.trim(),
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        notes: formData.notes || undefined,
        source: "manual",
        createdAt: now,
        updatedAt: now,
      });

      router.push("/customers");
    } catch (error) {
      console.error("Error creating client:", error);
      alert("Erro ao criar cliente");
    } finally {
      setIsSaving(false);
    }
  };

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Cliente</h1>
          <p className="text-muted-foreground text-sm">
            Cadastre um novo cliente na sua base
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
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Cliente
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
