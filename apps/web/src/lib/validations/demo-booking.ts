import { z } from "zod";

// Apenas os campos digitados pelo visitante (data/horário/duração são estado da UI,
// validados à parte). Espelha o estilo de contactSchema.
export const demoBookingFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("Email inválido").max(200),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().max(100).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
  website: z.string().optional().default(""), // honeypot
});

export type DemoBookingFormData = z.infer<typeof demoBookingFormSchema>;
