"use client";

import { CommandFaq } from "./_shared/command-faq";
import { FAQS } from "./_shared/faq-data";

export function LandingFAQ() {
  return <CommandFaq items={FAQS} />;
}
