"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { DateInput } from "@/components/ui/date-input";
import { ClientSelect } from "@/components/features/client-select";
import { Proposal } from "@/services/proposal-service";
import {
  FormSection,
  FormGroup,
  FormItem,
  FormStatic,
} from "@/components/ui/form-components";
import {
  User,
  FileText,
  Mail,
  Phone,
  MapPin,
  Calendar
} from "lucide-react";

interface ProposalClientSectionProps {
  formData: Partial<Proposal>;
  selectedClientId?: string;
  isReadOnly?: boolean;
  noContainer?: boolean; // When true, renders without FormSection wrapper
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
  noContainer = false,
  onFormChange,
  onClientChange,
}: ProposalClientSectionProps) {
  if (isReadOnly) {
    return (
      <FormSection
        title="Dados do Cliente"
        description="Informações do cliente e identificação da proposta"
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
              formData.validUntil
                ? new Date(formData.validUntil).toLocaleDateString("pt-BR")
                : undefined
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
        <FormItem label="Título da Proposta" htmlFor="title" required>
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={onFormChange}
            placeholder="Ex: Automação Residencial - Casa Silva"
            icon={<FileText className="w-4 h-4" />}
            required
          />
        </FormItem>
        <FormItem label="Cliente" required>
          <ClientSelect
            value={formData.clientName || ""}
            clientId={selectedClientId}
            onChange={onClientChange}
          />
        </FormItem>
      </FormGroup>

      <FormGroup cols={3}>
        <FormItem label="Email" htmlFor="clientEmail">
          <Input
            id="clientEmail"
            name="clientEmail"
            type="email"
            value={formData.clientEmail || ""}
            onChange={onFormChange}
            placeholder="email@exemplo.com"
            icon={<Mail className="w-4 h-4" />}
          />
        </FormItem>
        <FormItem label="Telefone" htmlFor="clientPhone">
          <PhoneInput
            id="clientPhone"
            name="clientPhone"
            value={formData.clientPhone || ""}
            onChange={onFormChange}
            placeholder="(11) 99999-9999"
          />
        </FormItem>
        <FormItem label="Válida até" htmlFor="validUntil">
          <DateInput
            id="validUntil"
            name="validUntil"
            value={
              formData.validUntil ? formData.validUntil.split("T")[0] : ""
            }
            onChange={onFormChange}
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
      title="Dados do Cliente"
      description="Informações do cliente e identificação da proposta"
      icon={User}
    >
      {content}
    </FormSection>
  );
}
