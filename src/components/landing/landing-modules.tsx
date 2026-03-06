"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  PieChart,
  CheckCircle2,
  Package,
  Users,
  FileText,
  Calendar,
} from "lucide-react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export function LandingModules() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Fade Up
      gsap.utils.toArray(".gsap-fade-up").forEach((element: any) => {
        gsap.fromTo(
          element,
          { y: 30, opacity: 0, autoAlpha: 0 },
          {
            y: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 90%",
              end: "bottom 10%",
              toggleActions: "play reverse play reverse",
            },
          },
        );
      });

      // Slide Right
      gsap.utils.toArray(".gsap-slide-right").forEach((element: any) => {
        gsap.fromTo(
          element,
          { x: 50, opacity: 0, autoAlpha: 0 },
          {
            x: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 80%",
              end: "bottom 20%",
              toggleActions: "play reverse play reverse",
            },
          },
        );
      });

      // Slide Left
      gsap.utils.toArray(".gsap-slide-left").forEach((element: any) => {
        gsap.fromTo(
          element,
          { x: -50, opacity: 0, autoAlpha: 0 },
          {
            x: 0,
            opacity: 1,
            autoAlpha: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: element,
              start: "top 80%",
              end: "bottom 20%",
              toggleActions: "play reverse play reverse",
            },
          },
        );
      });
    },
    { scope: containerRef },
  );

  return (
    <section
      ref={containerRef}
      id="modulos"
      className="py-20 relative border-t border-white/5"
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Módulo 1: Financeiro */}
        <div className="flex flex-col lg:flex-row items-center gap-16 py-20">
          <div className="w-full lg:w-1/2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium gsap-fade-up">
              <PieChart className="w-4 h-4" /> Gestão Financeira
            </div>
            <h3 className="text-3xl md:text-5xl font-bold leading-tight gsap-fade-up">
              Fluxo de caixa inteligente e automatizado.
            </h3>
            <p className="text-gray-400 text-lg leading-relaxed gsap-fade-up">
              Abandone as folhas de cálculo fragmentadas. O módulo financeiro do
              NexERP reconcilia contas bancárias automaticamente, emite faturas
              com um clique e projeta o seu cenário de liquidez para os próximos
              12 meses utilizando algoritmos preditivos.
            </p>
            <ul className="space-y-4 pt-4 gsap-fade-up">
              <li className="flex items-center gap-3 text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-brand-500" /> Faturação
                eletrónica certificada.
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-brand-500" /> Contas a
                pagar e receber em tempo real.
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-brand-500" /> Relatórios
                DRE e Balanço interativos.
              </li>
            </ul>
          </div>
          <div className="w-full lg:w-1/2 relative gsap-slide-right">
            <div className="absolute -inset-20 bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.15)_0,transparent_60%)] opacity-100 z-0"></div>
            <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-dark-card z-10">
              <img
                src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop"
                alt="Módulo Financeiro"
                className="w-full h-auto object-cover opacity-70 grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
          </div>
        </div>

        {/* Módulo 2: Operações e Stock (Invertido) */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16 py-20 border-t border-white/5">
          <div className="w-full lg:w-1/2 space-y-8 pl-0 lg:pl-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium gsap-fade-up">
              <Package className="w-4 h-4" /> Logística & Stock
            </div>
            <h3 className="text-3xl md:text-5xl font-bold leading-tight gsap-fade-up">
              Rastreamento de ponta a ponta.
            </h3>
            <p className="text-gray-400 text-lg leading-relaxed gsap-fade-up">
              Saiba exatamente onde está cada item do seu inventário. Desde a
              entrada de matérias-primas até à expedição do produto final,
              garantimos rastreabilidade total, gestão de lotes, validades e
              alertas de rutura de stock.
            </p>
            <ul className="space-y-4 pt-4 gsap-fade-up">
              <li className="flex items-center gap-3 text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-blue-500" /> Inventário
                multi-armazém.
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-blue-500" /> Sugestão de
                compras baseada em IA.
              </li>
              <li className="flex items-center gap-3 text-gray-300">
                <CheckCircle2 className="w-5 h-5 text-blue-500" /> Leitura por
                código de barras e RFID.
              </li>
            </ul>
          </div>
          <div className="w-full lg:w-1/2 relative gsap-slide-left">
            <div className="absolute -inset-20 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0,transparent_60%)] opacity-100 z-0"></div>
            <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-dark-card z-10">
              <img
                src="https://images.unsplash.com/photo-1586528116311-ad8ed7c508b0?q=80&w=2070&auto=format&fit=crop"
                alt="Módulo de Stock"
                className="w-full h-auto object-cover opacity-70 grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
          </div>
        </div>

        {/* Módulo 3: RH e Equipa */}
        <div className="flex flex-col lg:flex-row items-center gap-16 py-20 border-t border-white/5">
          <div className="w-full lg:w-1/2 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium gsap-fade-up">
              <Users className="w-4 h-4" /> Recursos Humanos
            </div>
            <h3 className="text-3xl md:text-5xl font-bold leading-tight gsap-fade-up">
              O talento humano no centro da gestão.
            </h3>
            <p className="text-gray-400 text-lg leading-relaxed gsap-fade-up">
              Centralize os processos de recrutamento, processamento salarial,
              avaliações de desempenho e portal do colaborador. Liberte a sua
              equipa de RH da burocracia para focar no desenvolvimento das
              pessoas.
            </p>
            <div className="grid grid-cols-2 gap-6 pt-4 gsap-fade-up">
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                <FileText className="w-6 h-6 text-white mb-2" />
                <h4 className="font-medium mb-1">Processamento Salarial</h4>
                <p className="text-sm text-gray-500">
                  Cálculo automático de impostos e bónus.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                <Calendar className="w-6 h-6 text-white mb-2" />
                <h4 className="font-medium mb-1">Gestão de Férias</h4>
                <p className="text-sm text-gray-500">
                  Aprovações e mapa de férias integrado.
                </p>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-1/2 relative gsap-slide-right">
            <div className="absolute -inset-20 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15)_0,transparent_60%)] opacity-100 z-0"></div>
            <div className="relative rounded-2xl border border-white/10 overflow-hidden bg-dark-card z-10">
              <img
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2070&auto=format&fit=crop"
                alt="Equipa RH"
                className="w-full h-auto object-cover opacity-70 grayscale hover:grayscale-0 transition-all duration-700"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
