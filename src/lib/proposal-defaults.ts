import { ProposalTemplate } from "@/types"; // We will duplicate type eventually or keep borrowing it
import { DEFAULT_PDF_FONT_FAMILY } from "@/services/pdf/pdf-fonts";

export const ProposalDefaults = {
    createDefaultTemplate: (tenantId: string, tenantName: string, primaryColor: string): ProposalTemplate => {
        return {
            id: 'default-generated',
            tenantId,
            name: 'Template Padrão',
            isDefault: true,
            introductionText: `Prezado(a) Cliente,\n\nÉ com grande satisfação que apresentamos esta proposta comercial. Nosso compromisso é oferecer soluções de qualidade que atendam às suas necessidades.`,
            scopeText: `Esta proposta contempla os seguintes produtos e serviços conforme especificado na tabela abaixo.`,
            paymentTerms: `• Pagamento à vista na entrega\n• Formas de pagamento: PIX, boleto ou cartão`,
            warrantyText: `Todos os produtos possuem garantia conforme especificação do fabricante. Instalações possuem garantia de 90 dias.`,
            footerText: `Agradecemos a oportunidade e ficamos à disposição para esclarecer quaisquer dúvidas.\n\nAtenciosamente,\nEquipe ${tenantName}`,
            theme: 'modern',
            primaryColor: primaryColor || '#2563eb',
            fontFamily: DEFAULT_PDF_FONT_FAMILY
        }
    }
}
