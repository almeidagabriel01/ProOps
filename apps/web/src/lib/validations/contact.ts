import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  company: z.string().min(1, "Empresa é obrigatória").max(100),
  email: z.string().email("Email inválido").max(200),
  phone: z.string().optional().or(z.literal("")),
  segment: z.string().min(1, "Segmento é obrigatório").max(200),
  message: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(2000),
  website: z.string().optional().default(""),
});

export type ContactFormData = z.infer<typeof contactSchema>;
