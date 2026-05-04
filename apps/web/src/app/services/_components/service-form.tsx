"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AIFieldButton } from "@/components/shared/ai-field-button";
import {
  Wrench,
  DollarSign,
  Image as ImageIcon,
  Tag,
  X,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { FileUpload } from "@/components/ui/file-upload";
import { DynamicSelect, DynamicSelectHandle } from "@/components/features/dynamic-select";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import { StepWizard, StepNavigation } from "@/components/ui/step-wizard";
import { FormStepCard } from "@/components/ui/form-step-card";
import {
  FormSection,
  FormGroup,
  FormItem,
  FormStatic,
} from "@/components/ui/form-components";
import { useProductForm } from "@/app/products/_hooks/useProductForm";
import { Service } from "@/services/service-service";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";

interface ServiceFormProps {
  initialData?: Service;
  serviceId?: string;
  isReadOnly?: boolean;
}

const serviceSteps = [
  {
    id: "info",
    title: "Informações",
    description: "Dados do serviço",
    icon: Wrench,
  },
  {
    id: "pricing",
    title: "Valor",
    description: "Preço de venda",
    icon: DollarSign,
  },
  {
    id: "images",
    title: "Imagem",
    description: "Foto de apoio",
    icon: ImageIcon,
  },
  {
    id: "settings",
    title: "Resumo",
    description: "Resumo final",
    icon: Settings,
  },
];

export function ServiceForm({
  initialData,
  serviceId,
  isReadOnly = false,
}: ServiceFormProps) {
  const router = useRouter();
  const nicheConfig = useCurrentNicheConfig();
  const {
    formData,
    imageUrls,
    isSubmitting,
    hasChanges,
    showLimitModal,
    setShowLimitModal,
    currentProductCount,
    maxProducts,
    maxImagesPerProduct,
    errors,
    setFieldError,
    handleChange,
    handleBlur,
    handleAddImage,
    handleRemoveImage,
    handleSubmit,
  } = useProductForm(initialData, serviceId, "service");

  const categoryRef = React.useRef<DynamicSelectHandle>(null);

  const servicePrice = parseFloat(formData.price || "0");

  const handleFormSubmit = async () => {
    const fakeEvent = { preventDefault: () => undefined } as React.FormEvent;
    await handleSubmit(fakeEvent);
  };

  const validateInfoStep = (): boolean => {
    let isValid = true;

    if (!formData.name.trim()) {
      setFieldError("name", "Nome é obrigatório");
      isValid = false;
    }

    if (!formData.category.trim()) {
      setFieldError("category", "Categoria é obrigatória");
      isValid = false;
    }

    return isValid;
  };

  const validatePriceStep = (): boolean => {
    if (!formData.price || parseFloat(formData.price) <= 0) {
      setFieldError("price", "Preço é obrigatório e deve ser maior que 0");
      return false;
    }

    return true;
  };

  if (isReadOnly) {
    return (
      <div className="space-y-6">
        <FormSection title="Informações" icon={Wrench}>
          <FormStatic label="Nome do Serviço" value={formData.name} />
          <FormStatic label="Descrição" value={formData.description} />
          <FormGroup>
            <FormStatic label="Categoria" value={formData.category} />
            <FormStatic label="Valor" value={`R$ ${servicePrice.toFixed(2)}`} />
          </FormGroup>
        </FormSection>

        <FormSection title="Imagem" icon={ImageIcon}>
          {imageUrls.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {imageUrls.map((img, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-xl overflow-hidden border border-border/50 relative"
                >
                  <Image
                    src={img}
                    alt={`Serviço ${index + 1}`}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 33vw, 100px"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhuma imagem cadastrada</p>
          )}
        </FormSection>

        <div className="flex justify-end pt-4">
          <button
            onClick={() => router.back()}
            className="h-12 px-6 rounded-xl bg-card border border-border/50 text-sm font-medium hover:bg-muted transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <StepWizard steps={serviceSteps} allowClickAhead={!!serviceId}>
        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                <Wrench className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Informações do Serviço</h3>
                <p className="text-sm text-muted-foreground">
                  Dados de identificação comercial
                </p>
              </div>
            </div>

            <FormGroup cols={2}>
              <FormItem
                label="Nome do Serviço"
                htmlFor="name"
                required
                error={errors.name}
              >
                <Input
                  id="name"
                  name="name"
                  placeholder="Ex: Instalação e Configuração"
                  value={formData.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  icon={<Tag className="w-4 h-4" />}
                  className={errors.name ? "border-destructive" : ""}
                  required
                />
              </FormItem>

              <div className="relative">
                <DynamicSelect
                  ref={categoryRef}
                  storageKey="product_categories"
                  label="Categoria"
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  error={errors.category}
                  className="flex flex-col gap-4 space-y-0 [&>div:first-child]:h-5 [&_label]:leading-5"
                />
                <div className="absolute top-0 right-20 flex items-center h-5">
                  <AIFieldButton
                    field="product.category"
                    context={() => ({ name: formData.name, description: formData.description, niche: nicheConfig.id })}
                    onGenerated={(value) => categoryRef.current?.createAndSelectOption(value)}
                    disabledReason={!formData.name ? "Preencha o nome do serviço primeiro" : undefined}
                  />
                </div>
              </div>
            </FormGroup>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="description" className="text-sm font-medium leading-none">
                  Descrição
                </label>
                <AIFieldButton
                  field="service.description"
                  context={() => ({
                    name: formData.name,
                    category: formData.category,
                    niche: nicheConfig.id,
                  })}
                  onGenerated={(value) =>
                    handleChange({
                      target: { name: "description", value },
                    } as React.ChangeEvent<HTMLTextAreaElement>)
                  }
                  disabledReason={!formData.name ? "Preencha o nome do serviço primeiro" : undefined}
                />
              </div>
              <Textarea
                id="description"
                name="description"
                placeholder="Descreva escopo, diferenciais e condições do serviço..."
                value={formData.description}
                onChange={handleChange}
                className="min-h-[140px]"
              />
            </div>
          </div>

          <StepNavigation onBeforeNext={validateInfoStep} />
        </FormStepCard>

        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-500/15 to-green-500/5 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Valor do Serviço</h3>
                <p className="text-sm text-muted-foreground">
                  Defina o valor final cobrado do cliente
                </p>
              </div>
            </div>

            <FormItem
              label="Preço do Serviço"
              htmlFor="price"
              required
              error={errors.price}
            >
              <CurrencyInput
                id="price"
                name="price"
                placeholder="0,00"
                value={formData.price}
                onChange={handleChange}
                onBlur={handleBlur}
                className={errors.price ? "border-destructive" : ""}
                required
              />
            </FormItem>

            <div className="p-5 rounded-xl bg-linear-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Valor final do serviço
                </span>
                <span className="text-2xl font-bold text-green-600">
                  R$ {servicePrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <StepNavigation onBeforeNext={validatePriceStep} />
        </FormStepCard>

        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Imagem do Serviço</h3>
                <p className="text-sm text-muted-foreground">
                  Adicione até {maxImagesPerProduct} imagem de apoio
                </p>
              </div>
            </div>

            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {imageUrls.map((img, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-xl overflow-hidden bg-muted/30 border-2 border-border/30 group"
                  >
                    <Image
                      src={img}
                      alt={`Serviço ${index + 1}`}
                      fill
                      className="object-contain p-2"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-destructive/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive shadow-lg z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {imageUrls.length < maxImagesPerProduct && (
              <FileUpload
                value={null}
                onChange={handleAddImage}
                className="h-[180px]"
              />
            )}
          </div>

          <StepNavigation />
        </FormStepCard>

        <FormStepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-linear-to-br from-slate-500/15 to-slate-500/5 flex items-center justify-center">
                <Settings className="w-6 h-6 text-slate-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Resumo</h3>
                <p className="text-sm text-muted-foreground">
                  Revise o resumo final antes de salvar
                </p>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-muted/30 border border-border/50 space-y-4">
              <h4 className="font-semibold text-foreground">Resumo do Serviço</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <p className="font-medium">{formData.name || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Categoria:</span>
                  <p className="font-medium">{formData.category || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor do serviço:</span>
                  <p className="font-medium text-green-600">
                    R$ {servicePrice.toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Imagens:</span>
                  <p className="font-medium">
                    {imageUrls.length} de {maxImagesPerProduct}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Descrição:</span>
                  <p className="font-medium text-balance break-words">
                    {formData.description || "Sem descrição"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <StepNavigation
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
            submitDisabled={!!serviceId && !hasChanges}
            submitLabel={serviceId ? "Salvar Alterações" : "Criar Serviço"}
          />
        </FormStepCard>
      </StepWizard>

      <LimitReachedModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        resourceType="products"
        currentCount={currentProductCount}
        maxLimit={maxProducts}
      />
    </>
  );
}
