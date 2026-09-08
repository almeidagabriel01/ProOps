import { Building2, FileText, MapPin, ShieldCheck } from "lucide-react";

/**
 * Os quatro passos da configuração fiscal, na ordem em que o provedor precisa
 * dos dados: identificação da empresa → endereço → o que se emite → o
 * certificado que assina. O último passo é o único que fala com o provedor
 * (registra o emitente), então ele fica no fim de propósito.
 */
export const fiscalSteps = [
  {
    id: "empresa",
    title: "Empresa",
    description: "CNPJ e dados",
    icon: Building2,
  },
  {
    id: "endereco",
    title: "Endereço",
    description: "Local do emitente",
    icon: MapPin,
  },
  {
    id: "documentos",
    title: "Documentos",
    description: "Notas e numeração",
    icon: FileText,
  },
  {
    id: "certificado",
    title: "Certificado",
    description: "e-CNPJ A1",
    icon: ShieldCheck,
  },
];
