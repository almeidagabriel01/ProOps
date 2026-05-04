"use client";

import * as React from "react";
import { Settings2 } from "lucide-react";
import { Proposal } from "@/types/proposal";
import { useTenant } from "@/providers/tenant-provider";
import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";

interface PdfDisplayOptionsSectionProps {
  formData: Partial<Proposal>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Proposal>>>;
}

interface CheckboxOptionProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CheckboxOption({ label, checked, onChange }: CheckboxOptionProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 group">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="h-5 w-5 rounded-md border-2 border-border bg-background transition-all duration-200 peer-checked:border-primary peer-checked:bg-primary peer-focus:ring-2 peer-focus:ring-primary/30 group-hover:border-primary/60">
          {checked && (
            <svg
              className="h-full w-full p-0.5 text-primary-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
      <span className="text-sm text-foreground transition-colors group-hover:text-primary">
        {label}
      </span>
    </label>
  );
}

export function PdfDisplayOptionsSection({
  formData,
  setFormData,
}: PdfDisplayOptionsSectionProps) {
  const { tenant } = useTenant();
  const isCortinasNiche = tenant?.niche === "cortinas";

  const settings: PdfDisplaySettings = {
    ...defaultPdfDisplaySettings,
    ...(formData.pdfSettings as Partial<PdfDisplaySettings>),
  };

  const updateSetting = (key: keyof PdfDisplaySettings, value: boolean) => {
    setFormData((prev) => ({
      ...prev,
      pdfSettings: {
        ...defaultPdfDisplaySettings,
        ...(prev.pdfSettings as Partial<PdfDisplaySettings>),
        [key]: value,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-purple-500/15 to-purple-500/5">
          <Settings2 className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Configurações do PDF
          </h3>
          <p className="text-sm text-muted-foreground">
            Escolha o que exibir no documento
          </p>
        </div>
      </div>

      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Produtos
          </h4>
          <div className="space-y-3">
            <CheckboxOption
              label="Mostrar imagens"
              checked={settings.showProductImages}
              onChange={(value) => updateSetting("showProductImages", value)}
            />
            <CheckboxOption
              label="Mostrar descrições"
              checked={settings.showProductDescriptions}
              onChange={(value) =>
                updateSetting("showProductDescriptions", value)
              }
            />
            <CheckboxOption
              label="Mostrar quantidades"
              checked={settings.showProductQuantities ?? true}
              onChange={(value) => updateSetting("showProductQuantities", value)}
            />
            <CheckboxOption
              label="Mostrar preços unitários"
              checked={settings.showProductPrices}
              onChange={(value) => updateSetting("showProductPrices", value)}
            />
            {isCortinasNiche && (
              <CheckboxOption
                label="Mostrar largura e altura"
                checked={settings.showProductMeasurements}
                onChange={(value) =>
                  updateSetting("showProductMeasurements", value)
                }
              />
            )}
            <CheckboxOption
              label={
                isCortinasNiche
                  ? "Mostrar subtotais por ambiente"
                  : "Mostrar subtotal por solução"
              }
              checked={settings.showSubtotals}
              onChange={(value) => updateSetting("showSubtotals", value)}
            />
            {!isCortinasNiche && (
              <CheckboxOption
                label="Mostrar subtotais por ambiente"
                checked={settings.showEnvironmentSubtotals}
                onChange={(value) =>
                  updateSetting("showEnvironmentSubtotals", value)
                }
              />
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pagamento
          </h4>
          <div className="space-y-3">
            <CheckboxOption
              label="Mostrar formas de pagamento"
              checked={settings.showPaymentTerms}
              onChange={(value) => updateSetting("showPaymentTerms", value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border/50 bg-muted/50 p-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Dica:</span> Essas configurações serão
          aplicadas ao PDF gerado para esta proposta. Você pode visualizar o
          resultado antes de salvar.
        </p>
      </div>
    </div>
  );
}
