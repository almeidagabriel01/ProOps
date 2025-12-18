"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { ClientSelect } from "@/components/features/client-select";
import { Proposal } from "@/services/proposal-service";
import { User } from "lucide-react";

interface ProposalClientSectionProps {
  formData: Partial<Proposal>;
  selectedClientId?: string;
  isReadOnly?: boolean;
  onFormChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
  onClientChange: (data: {
    clientId?: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    isNew: boolean;
  }) => void;
}

export function ProposalClientSection({
  formData,
  selectedClientId,
  isReadOnly,
  onFormChange,
  onClientChange,
}: ProposalClientSectionProps) {
  if (isReadOnly) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Dados do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Título da Proposta</Label>
              <div className="p-2 border rounded-md bg-muted/50">
                {formData.title}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Cliente</Label>
              <div className="p-2 border rounded-md bg-muted/50">
                {formData.clientName}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Email</Label>
              <div className="p-2 border rounded-md bg-muted/50">
                {formData.clientEmail || "-"}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Telefone</Label>
              <div className="p-2 border rounded-md bg-muted/50">
                {formData.clientPhone || "-"}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Válida até</Label>
              <div className="p-2 border rounded-md bg-muted/50">
                {formData.validUntil
                  ? new Date(formData.validUntil).toLocaleDateString()
                  : "-"}
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Endereço</Label>
            <div className="p-2 border rounded-md bg-muted/50">
              {formData.clientAddress || "-"}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Dados do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Título da Proposta *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={onFormChange}
              placeholder="Ex: Automação Residencial - Casa Silva"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Cliente *</Label>
            <ClientSelect
              value={formData.clientName || ""}
              clientId={selectedClientId}
              onChange={onClientChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="clientEmail">Email</Label>
            <Input
              id="clientEmail"
              name="clientEmail"
              type="email"
              value={formData.clientEmail || ""}
              onChange={onFormChange}
              placeholder="email@exemplo.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="clientPhone">Telefone</Label>
            <PhoneInput
              id="clientPhone"
              name="clientPhone"
              value={formData.clientPhone || ""}
              onChange={onFormChange}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="validUntil">Válida até</Label>
            <DateInput
              id="validUntil"
              name="validUntil"
              value={
                formData.validUntil ? formData.validUntil.split("T")[0] : ""
              }
              onChange={onFormChange}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="clientAddress">Endereço</Label>
          <Input
            id="clientAddress"
            name="clientAddress"
            value={formData.clientAddress || ""}
            onChange={onFormChange}
            placeholder="Endereço completo"
          />
        </div>
      </CardContent>
    </Card>
  );
}
