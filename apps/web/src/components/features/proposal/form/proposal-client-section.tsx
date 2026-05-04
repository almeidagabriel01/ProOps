"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DatePicker } from "@/components/ui/date-picker";
import { ClientSelect } from "@/components/features/client-select";
import { Proposal } from "@/services/proposal-service";
import { ClientType } from "@/services/client-service";
import {
  FormSection,
  FormGroup,
  FormItem,
  FormStatic,
} from "@/components/ui/form-components";
import { Checkbox } from "@/components/ui/checkbox";
import { User, FileText, Mail, MapPin, Users, Building2 } from "lucide-react";
import { formatDateBR } from "@/utils/date-format";

interface ProposalClientSectionProps {
  formData: Partial<Proposal>;
  selectedClientId?: string;
  isReadOnly?: boolean;
  noContainer?: boolean; // When true, renders without FormSection wrapper
  errors?: Record<string, string>;
  // New props for client types
  isNewClient?: boolean;
  clientTypes?: ClientType[];
  onClientTypesChange?: (types: ClientType[]) => void;
  onFormChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
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
  noContainer = false,
  errors = {},
  isNewClient = false,
  clientTypes = ["cliente"],
  onClientTypesChange,
  onFormChange,
  onClientChange,
}: ProposalClientSectionProps) {
  // Handler for type checkbox changes
  const handleTypeChange = (type: ClientType, checked: boolean) => {
    if (!onClientTypesChange) return;

    if (checked) {
      // Add type if not present
      if (!clientTypes.includes(type)) {
        onClientTypesChange([...clientTypes, type]);
      }
    } else {
      // Remove type, but ensure at least one type remains
      const newTypes = clientTypes.filter((t) => t !== type);
      if (newTypes.length > 0) {
        onClientTypesChange(newTypes);
      }
    }
  };

  if (isReadOnly) {
    return (
      <FormSection
        title="Dados do Contato"
        description="Informações do contato e identificação da proposta"
        icon={User}
      >
        <FormGroup>
          <FormStatic label="Título da Proposta" value={formData.title} />
          <FormStatic label="Cliente" value={formData.clientName} />
        </FormGroup>
        <FormGroup cols={3}>
          <FormStatic label="Email" value={formData.clientEmail} />
          <FormStatic label="Telefone" value={formData.clientPhone} />
          <FormStatic
            label="Válida até"
            value={
              formData.validUntil ? formatDateBR(formData.validUntil) : undefined
            }
          />
        </FormGroup>
        <FormStatic label="Endereço" value={formData.clientAddress} />
      </FormSection>
    );
  }

  const content = (
    <>
      <FormGroup>
        <FormItem
          label="Título da Proposta"
          htmlFor="title"
          required
          error={errors.title}
        >
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={onFormChange}
            placeholder="Ex: Automação Residencial - Casa Silva"
            icon={<FileText className="w-4 h-4" />}
            required
            className={errors.title ? "border-destructive" : ""}
          />
        </FormItem>
        <FormItem
          label="Contato"
          htmlFor="clientName"
          required
          error={errors.clientName}
        >
          <ClientSelect
            value={formData.clientName || ""}
            clientId={selectedClientId}
            onChange={onClientChange}
            error={!!errors.clientName}
          />

          {/* Client Type Selection - Only show when creating a new client */}
          {isNewClient && formData.clientName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1 mt-2">
              <span>Cadastrar como:</span>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                <Checkbox
                  checked={clientTypes.includes("cliente")}
                  onCheckedChange={(checked) =>
                    handleTypeChange("cliente", checked === true)
                  }
                />
                <Users className="w-3.5 h-3.5" />
                <span>Contato</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors">
                <Checkbox
                  checked={clientTypes.includes("fornecedor")}
                  onCheckedChange={(checked) =>
                    handleTypeChange("fornecedor", checked === true)
                  }
                />
                <Building2 className="w-3.5 h-3.5" />
                <span>Fornecedor</span>
              </label>
            </div>
          )}
        </FormItem>
      </FormGroup>

      <FormGroup cols={3}>
        <FormItem
          label="Email"
          htmlFor="clientEmail"
          error={errors.clientEmail}
        >
          <Input
            id="clientEmail"
            name="clientEmail"
            type="email"
            value={formData.clientEmail || ""}
            onChange={onFormChange}
            placeholder="email@exemplo.com"
            icon={<Mail className="w-4 h-4" />}
            className={errors.clientEmail ? "border-destructive" : ""}
          />
        </FormItem>
        <FormItem
          label="Telefone"
          htmlFor="clientPhone"
          required
          error={errors.clientPhone}
        >
          <PhoneInput
            id="clientPhone"
            name="clientPhone"
            value={formData.clientPhone || ""}
            onChange={onFormChange}
            placeholder="(11) 99999-9999"
            className={errors.clientPhone ? "border-destructive" : ""}
          />
        </FormItem>
        <FormItem
          label="Válida até"
          htmlFor="validUntil"
          required
          error={errors.validUntil}
        >
          <DatePicker
            id="validUntil"
            name="validUntil"
            value={formData.validUntil ? formData.validUntil.split("T")[0] : ""}
            onChange={onFormChange}
            className={errors.validUntil ? "border-destructive" : ""}
          />
        </FormItem>
      </FormGroup>

      <FormItem label="Endereço" htmlFor="clientAddress">
        <Input
          id="clientAddress"
          name="clientAddress"
          value={formData.clientAddress || ""}
          onChange={onFormChange}
          placeholder="Endereço completo do cliente"
          icon={<MapPin className="w-4 h-4" />}
        />
      </FormItem>
    </>
  );

  // When noContainer is true, just return the fields without the FormSection wrapper
  if (noContainer) {
    return <div className="space-y-5">{content}</div>;
  }

  return (
    <FormSection
      title="Dados do Contato"
      description="Informações do contato e identificação da proposta"
      icon={User}
    >
      {content}
    </FormSection>
  );
}
