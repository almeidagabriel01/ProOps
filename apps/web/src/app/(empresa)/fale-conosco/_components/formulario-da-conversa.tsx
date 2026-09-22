"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, m as motion } from "motion/react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { Magnetic } from "@/components/marketing/_shared/magnetic";
import { Marca } from "@/components/institucional/marca";
import { Loader } from "@/components/ui/loader";
import { ApiError } from "@/lib/api-client";
import { useFormValidation } from "@/hooks/useFormValidation";
import { contactSchema } from "@/lib/validations/contact";
import type { ContactFormData } from "@/lib/validations/contact";
import { ContactFormService } from "@/services/contact-form-service";
import { cn } from "@/lib/utils";

import type { Canal } from "@/app/(empresa)/institucional/_content/institucional-copy";

import { escolheCanal, useCanalEscolhido } from "./canal-escolhido";
import { CampoDaConversa } from "./campo-da-conversa";
import { SeletorDeCanal } from "./seletor-de-canal";

const SAIDA: [number, number, number, number] = [0.16, 1, 0.3, 1];

const VAZIO: ContactFormData = {
  name: "",
  company: "",
  email: "",
  phone: "",
  segment: "",
  message: "",
  website: "",
};

/** Os quatro que o backend exige. O telefone é opcional e fica fora da conta. */
const OBRIGATORIOS = ["name", "company", "email", "message"] as const;

/**
 * A página de contato, como uma conversa e não como um índice de endereços.
 *
 * A versão anterior era um roteador: quatro motivos, e cada um entregava um
 * link para outro lugar. Funcionava como sumário e falhava como contato, porque
 * o motivo mais comum de todos, "quero conhecer o produto", mandava a pessoa
 * para um segundo formulário em outro site depois de ela já ter dito o que
 * queria. Aqui o motivo escolhido CONFIGURA o formulário ao lado: muda o que o
 * campo de mensagem pergunta, muda o prazo prometido e muda a fila que recebe.
 * Escrever continua sendo um caminho só, do começo ao fim.
 *
 * O endpoint é o mesmo `/v1/public/contact-form` que a landing do ERP já usa,
 * de propósito: um segundo canal de recebimento seria uma caixa que ninguém
 * abre. O `segment` é o `titulo` do canal, que é o que diz, no e-mail que
 * chega, qual fila tem que responder.
 *
 * **Nada aqui lê sessão**, e não pode passar a ler: esta rota renderiza fora do
 * `AuthProvider` (`SESSIONLESS_MARKETING_ROUTES`). `ContactFormService` chama
 * `callPublicApi`, que não anexa token nenhum, e é por isso que ele serve.
 */
export function FormularioDaConversa({ canais }: { canais: Canal[] }) {
  const reduce = useReducedMotion();
  // O assunto mora num store de módulo, e não aqui: o herói da página também o
  // escolhe, clicando numa das conversas (`canal-escolhido.ts`).
  const escolhido = useCanalEscolhido();
  const indice = Math.max(0, canais.findIndex((c) => c.titulo === escolhido));
  const [dados, setDados] = useState<ContactFormData>(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<Canal | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const { errors, validateForm, clearFieldError } = useFormValidation({
    schema: contactSchema,
  });

  const canal = canais[indice];

  /**
   * Quantos dos quatro campos obrigatórios já valem.
   *
   * Conferido pelo MESMO schema que decide o envio, campo a campo, e não por
   * uma regra paralela: um contador que conte "preenchido" enquanto o schema
   * exige "válido" promete um botão que não vai funcionar.
   */
  const prontos = useMemo(
    () =>
      OBRIGATORIOS.filter(
        (campo) => contactSchema.shape[campo].safeParse(dados[campo]).success,
      ).length,
    [dados],
  );

  const mudou = (nome: string, valor: string) => {
    setDados((antes) => ({ ...antes, [nome]: valor }));
    clearFieldError(nome as keyof ContactFormData);
    setFalha(null);
  };

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const carga: ContactFormData = { ...dados, segment: canal.titulo };
    if (!validateForm(carga)) return;

    setEnviando(true);
    setFalha(null);
    try {
      await ContactFormService.submit({
        name: carga.name,
        company: carga.company,
        email: carga.email,
        phone: carga.phone,
        segment: carga.segment,
        message: carga.message,
        website: carga.website ?? "",
      });
      setEnviado(canal);
      setDados(VAZIO);
    } catch (erro) {
      setFalha(
        erro instanceof ApiError
          ? erro.message
          : "Não foi possível enviar agora. Tente de novo em instantes, ou escreva para gestao@proops.com.br.",
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-14 md:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] md:gap-20">
      <div>
        <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.24em] text-white/40">
          O que traz você aqui
        </p>

        <SeletorDeCanal
          canais={canais}
          ativo={indice}
          aoEscolher={(proximo) => {
            escolheCanal(canais[proximo].titulo);
            setFalha(null);
          }}
          className="mt-8"
        />

        {/*
          O painel é um bloco só cuja altura anima, e o conteúdo troca por
          `key`. `layout` no de fora e `key` no de dentro: remontar o de fora
          faria o `layout` perder a altura anterior, e o painel voltaria a
          saltar a cada clique, que é o que a animação existe para evitar.
        */}
        <motion.div
          layout={!reduce}
          className="mt-10 border-t border-white/10 pt-8"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={canal.motivo}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: reduce ? 0 : 0.35, ease: SAIDA }}
            >
              <p className="[font-family:var(--font-bricolage)] text-xl font-semibold leading-snug tracking-tight text-white md:text-2xl">
                {canal.texto}
              </p>
              <p className="mt-5 flex items-center gap-2.5 [font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-white/40">
                <span aria-hidden="true" className="h-px w-6 bg-white/30" />
                {canal.prazo}
              </p>
              <div className="mt-7">
                {canal.atalho.externo ? (
                  <a
                    href={canal.atalho.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2 border-b border-white/25 pb-1 text-sm text-white/70 transition-colors hover:border-white hover:text-white"
                  >
                    {canal.atalho.rotulo}
                    <span
                      aria-hidden="true"
                      className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                    >
                      &rarr;
                    </span>
                  </a>
                ) : (
                  <Link
                    href={canal.atalho.href}
                    className="group inline-flex items-center gap-2 border-b border-white/25 pb-1 text-sm text-white/70 transition-colors hover:border-white hover:text-white"
                  >
                    {canal.atalho.rotulo}
                    <span
                      aria-hidden="true"
                      className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                    >
                      &rarr;
                    </span>
                  </Link>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {enviado ? (
          <Recebido
            key="recebido"
            canal={enviado}
            reduce={reduce}
            aoEscreverDeNovo={() => setEnviado(null)}
          />
        ) : (
          <motion.form
            key="formulario"
            noValidate
            onSubmit={enviar}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: reduce ? 0 : 0.35, ease: SAIDA }}
            className="relative flex flex-col"
          >
            <Progresso
              prontos={prontos}
              total={OBRIGATORIOS.length}
              reduce={reduce}
            />

            <div className="mt-12 flex flex-col gap-11">
              <CampoDaConversa
                rotulo="Seu nome"
                nome="name"
                valor={dados.name}
                aoMudar={mudou}
                erro={errors.name}
                obrigatorio
                autoComplete="name"
              />
              <CampoDaConversa
                rotulo="Empresa"
                nome="company"
                valor={dados.company}
                aoMudar={mudou}
                erro={errors.company}
                obrigatorio
                autoComplete="organization"
              />
              <div className="grid gap-11 sm:grid-cols-2">
                <CampoDaConversa
                  rotulo="E-mail"
                  nome="email"
                  tipo="email"
                  valor={dados.email}
                  aoMudar={mudou}
                  erro={errors.email}
                  obrigatorio
                  autoComplete="email"
                />
                <CampoDaConversa
                  rotulo="Telefone"
                  nome="phone"
                  tipo="tel"
                  valor={dados.phone ?? ""}
                  aoMudar={mudou}
                  erro={errors.phone}
                  autoComplete="tel"
                  dica="Opcional"
                />
              </div>
              {/*
                O rótulo do campo de mensagem é a pergunta do canal escolhido, e
                é a peça que faz o seletor mudar o formulário de verdade em vez
                de só trocar um parágrafo ao lado. `key` no canal porque o
                rótulo flutuante anima a partir do estado dele.
              */}
              <CampoDaConversa
                key={canal.titulo}
                rotulo={canal.convite}
                nome="message"
                valor={dados.message}
                aoMudar={mudou}
                erro={errors.message}
                obrigatorio
                multilinha
              />
            </div>

            {/*
              Armadilha de robô. Fora da ordem de tabulação e fora do alcance de
              leitor de tela; o backend descarta em silêncio o que chegar com
              ela preenchida, respondendo 200 para não ensinar nada a quem a
              preencheu.
            */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] top-0"
            >
              <label htmlFor="website-da-empresa">Não preencha este campo</label>
              <input
                id="website-da-empresa"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={dados.website ?? ""}
                onChange={(evento) => mudou("website", evento.target.value)}
                className="text-base"
              />
            </div>

            <AnimatePresence initial={false}>
              {falha && (
                <motion.p
                  role="alert"
                  initial={reduce ? { opacity: 1 } : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.25 }}
                  className="mt-10 border-l border-white/40 pl-4 text-sm leading-relaxed text-white/70"
                >
                  {falha}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-5">
              <Magnetic forca={10}>
                <button
                  type="submit"
                  disabled={enviando}
                  className="group inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 [font-family:var(--font-bricolage)] text-base font-semibold tracking-tight text-neutral-950 transition-opacity duration-300 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enviando ? (
                    <>
                      <Loader size="sm" variant="button" />
                      Enviando
                    </>
                  ) : (
                    <>
                      Enviar para {canal.titulo.toLowerCase()}
                      <span
                        aria-hidden="true"
                        className="inline-block transition-transform duration-300 group-hover:translate-x-1"
                      >
                        &rarr;
                      </span>
                    </>
                  )}
                </button>
              </Magnetic>

              <p className="max-w-xs text-[13px] leading-relaxed text-white/40">
                Uma pessoa lê e responde. O que você escrever é tratado conforme
                a{" "}
                <a
                  href="/privacy"
                  className="underline underline-offset-4 transition-colors hover:text-white/70"
                >
                  Política de Privacidade
                </a>
                .
              </p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Quantos dos campos obrigatórios já valem, como número e como filete.
 *
 * É a peça que responde ao leitor enquanto ele digita, e existe porque este
 * formulário abre com cinco campos de uma vez: sem nenhum sinal de progresso, a
 * única forma de descobrir que falta alguma coisa é apertar Enviar e levar
 * erro. O filete é `scaleX` com origem à esquerda, então não participa do
 * layout e a animação fica na composição.
 */
function Progresso({
  prontos,
  total,
  reduce,
}: {
  prontos: number;
  total: number;
  reduce: boolean;
}) {
  const completo = prontos === total;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="[font-family:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.24em] text-white/40">
          {completo ? "Pronto para enviar" : "Escreva para a gente"}
        </p>
        <p
          aria-hidden="true"
          className="[font-family:var(--font-geist-mono)] text-[11px] tabular-nums tracking-[0.2em] text-white/35"
        >
          {String(prontos).padStart(2, "0")}/{String(total).padStart(2, "0")}
        </p>
      </div>
      <div className="relative mt-4 h-px w-full bg-white/[0.12]">
        <motion.span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 origin-left",
            completo ? "bg-white" : "bg-white/55",
          )}
          initial={false}
          animate={{ scaleX: prontos / total }}
          transition={reduce ? { duration: 0 } : { duration: 0.5, ease: SAIDA }}
        />
      </div>
    </div>
  );
}

/**
 * O fecho, no lugar do formulário.
 *
 * Substitui o formulário em vez de aparecer acima dele: uma confirmação com os
 * campos ainda na tela convida a reenviar a mesma mensagem. E o prazo que ela
 * promete é o do canal para onde a mensagem REALMENTE foi, não o que estiver
 * selecionado agora, que é por que o canal enviado é guardado em estado próprio.
 */
function Recebido({
  canal,
  reduce,
  aoEscreverDeNovo,
}: {
  canal: Canal;
  reduce: boolean;
  aoEscreverDeNovo: () => void;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.5, ease: SAIDA }}
      className="flex flex-col justify-center border-t border-white/10 pt-12 md:border-l md:border-t-0 md:pl-14 md:pt-0"
      aria-live="polite"
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: reduce ? 0 : 0.6,
          ease: SAIDA,
          delay: reduce ? 0 : 0.15,
        }}
      >
        <Marca className="h-12 w-12 text-white" />
      </motion.div>

      <p className="mt-9 [font-family:var(--font-bricolage)] text-3xl font-semibold leading-tight tracking-tight text-white md:text-4xl">
        Chegou.
      </p>
      <p className="mt-6 max-w-md text-base leading-relaxed text-white/60 md:text-lg">
        A sua mensagem foi para {canal.titulo.toLowerCase()}. {canal.prazo}, e
        quem responde é uma das três pessoas que fazem a ProOps.
      </p>

      <button
        type="button"
        onClick={aoEscreverDeNovo}
        className="mt-10 inline-flex w-fit items-center gap-2 border-b border-white/25 pb-1 text-sm text-white/70 transition-colors hover:border-white hover:text-white"
      >
        Escrever outra mensagem
      </button>
    </motion.div>
  );
}
