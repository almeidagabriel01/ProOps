"use client";
import { motion } from "motion/react";

export function LandingFAQ() {
  const faqs = [
    {
      question: "O sistema é compatível com minha contabilidade atual?",
      answer:
        "Sim. Exportamos todos os relatórios em formatos padrão da indústria, permitindo fácil integração com o software do seu contador sem fricção.",
    },
    {
      question: "Qual o limite de usuários?",
      answer:
        "O limite depende do plano escolhido. Planos superiores oferecem mais assentos, e você pode adicionar membros extras sob demanda diretamente pelo painel.",
    },
    {
      question: "Meus dados estão seguros?",
      answer:
        "Utilizamos criptografia de ponta a ponta e redundância diária para garantir que suas informações empresariais nunca sejam perdidas ou vazadas.",
    },
  ];

  return (
    <section id="faq" className="py-24 bg-black px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-neutral-400">
            Tire suas dúvidas antes de dar o próximo passo.
          </p>
        </div>

        <div className="grid gap-6">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: 0.35, delay: index * 0.03 }}
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <h3 className="text-lg font-bold text-white mb-2">
                {faq.question}
              </h3>
              <p className="text-neutral-400 leading-relaxed">{faq.answer}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
