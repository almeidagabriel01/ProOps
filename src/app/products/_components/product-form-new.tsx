"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { FileUpload } from "@/components/ui/file-upload";
import { DynamicSelect } from "@/components/features/dynamic-select";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { useProductForm } from "../_hooks/useProductForm";
import { Product } from "@/services/product-service";
import {
  StepWizard,
  StepNavigation,
  StepCard,
} from "@/components/ui/step-wizard";
import {
  FormSection,
  FormGroup,
  FormItem,
  FormStatic,
} from "@/components/ui/form-components";
import {
  Package,
  DollarSign,
  Image as ImageIcon,
  Settings,
  X,
  Tag,
  Hash,
  Layers,
} from "lucide-react";

interface ProductFormNewProps {
  initialData?: Product;
  productId?: string;
  isReadOnly?: boolean;
}

const productSteps = [
  {
    id: "info",
    title: "Informações",
    description: "Dados básicos",
    icon: Package,
  },
  {
    id: "pricing",
    title: "Preço",
    description: "Valores e estoque",
    icon: DollarSign,
  },
  {
    id: "images",
    title: "Imagens",
    description: "Fotos do produto",
    icon: ImageIcon,
  },
  {
    id: "settings",
    title: "Configurações",
    description: "Status e opções",
    icon: Settings,
  },
];

export function ProductFormNew({
  initialData,
  productId,
  isReadOnly = false,
}: ProductFormNewProps) {
  const router = useRouter();
  const {
    formData,
    imageUrls,
    isSubmitting,
    showLimitModal,
    setShowLimitModal,
    showImageLimitModal,
    setShowImageLimitModal,
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
  } = useProductForm(initialData, productId);

  const handleFormSubmit = async () => {
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmit(fakeEvent);
  };

  // Step 1 validation: Name, Category and Manufacturer are required
  const validateStep1 = (): boolean => {
    let isValid = true;

    if (!formData.name.trim()) {
      setFieldError("name", "Nome é obrigatório");
      isValid = false;
    }
    if (!formData.category.trim()) {
      setFieldError("category", "Categoria é obrigatória");
      isValid = false;
    }
    if (!formData.manufacturer.trim()) {
      setFieldError("manufacturer", "Fabricante é obrigatório");
      isValid = false;
    }

    return isValid;
  };

  // Step 2 validation: Price is required and must be > 0
  const validateStep2 = (): boolean => {
    let isValid = true;

    if (!formData.price || parseFloat(formData.price) <= 0) {
      setFieldError("price", "Preço é obrigatório e deve ser maior que 0");
      isValid = false;
    }

    return isValid;
  };

  // For read-only mode, show regular form without wizard
  if (isReadOnly) {
    return (
      <div className="space-y-6">
        <FormSection title="Informações" icon={Package}>
          <FormStatic label="Nome do Produto" value={formData.name} />
          <FormStatic label="Descrição" value={formData.description} />
          <FormGroup>
            <FormStatic label="Categoria" value={formData.category} />
            <FormStatic label="Fabricante" value={formData.manufacturer} />
          </FormGroup>
        </FormSection>
        <FormSection title="Preço e Estoque" icon={DollarSign}>
          <FormGroup cols={3}>
            <FormStatic
              label="Preço"
              value={`R$ ${parseFloat(formData.price || "0").toFixed(2)}`}
            />
            <FormStatic label="Estoque" value={formData.stock} />
            <FormStatic label="SKU" value={formData.sku} />
          </FormGroup>
        </FormSection>
        <FormSection title="Imagens" icon={ImageIcon}>
          {imageUrls.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {imageUrls.map((img, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl overflow-hidden border border-border/50 relative"
                >
                  <Image
                    src={img}
                    alt={`Produto ${i + 1}`}
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
      <StepWizard steps={productSteps} allowClickAhead={!!productId}>
        {/* Step 1: Product Info */}
        <StepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  Informações do Produto
                </h3>
                <p className="text-sm text-muted-foreground">
                  Dados de identificação
                </p>
              </div>
            </div>

            <FormItem
              label="Nome do Produto"
              htmlFor="name"
              required
              error={errors.name}
            >
              <Input
                id="name"
                name="name"
                placeholder="Ex: Câmera de Segurança HD Pro"
                value={formData.name}
                onChange={handleChange}
                onBlur={handleBlur}
                icon={<Tag className="w-4 h-4" />}
                className={errors.name ? "border-destructive" : ""}
                required
              />
            </FormItem>

            <FormItem label="Descrição" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                placeholder="Descreva as características e diferenciais do produto..."
                value={formData.description}
                onChange={handleChange}
                className="min-h-[140px]"
              />
            </FormItem>

            <FormGroup>
              <DynamicSelect
                storageKey="product_categories"
                label="Categoria"
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                error={errors.category}
              />
              <DynamicSelect
                storageKey="product_manufacturers"
                label="Fabricante"
                id="manufacturer"
                name="manufacturer"
                value={formData.manufacturer}
                onChange={handleChange}
                required
                error={errors.manufacturer}
              />
            </FormGroup>
          </div>

          <StepNavigation onBeforeNext={validateStep1} />
        </StepCard>

        {/* Step 2: Pricing */}
        <StepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/15 to-green-500/5 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Preço e Estoque</h3>
                <p className="text-sm text-muted-foreground">
                  Valores de venda e inventário
                </p>
              </div>
            </div>

            <FormGroup cols={2}>
              <FormItem
                label="Preço Bruto (Custo)"
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

              <FormItem label="Markup (%)" htmlFor="markup">
                <Input
                  id="markup"
                  name="markup"
                  type="number"
                  placeholder="0"
                  value={formData.markup}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  min="0"
                  max="1000"
                  step="0.01"
                  icon={<DollarSign className="w-4 h-4" />}
                />
                {formData.price && formData.markup && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Preço de venda: R${" "}
                    {(
                      parseFloat(formData.price) +
                      (parseFloat(formData.price) *
                        parseFloat(formData.markup)) /
                        100
                    ).toFixed(2)}
                  </p>
                )}
              </FormItem>
            </FormGroup>

            <FormGroup cols={2}>
              <FormItem label="Estoque" htmlFor="stock">
                <Input
                  id="stock"
                  name="stock"
                  type="number"
                  placeholder="0"
                  value={formData.stock}
                  onChange={handleChange}
                  icon={<Layers className="w-4 h-4" />}
                />
              </FormItem>

              <FormItem label="SKU" htmlFor="sku">
                <Input
                  id="sku"
                  name="sku"
                  placeholder="PROD-001"
                  value={formData.sku}
                  onChange={handleChange}
                  icon={<Hash className="w-4 h-4" />}
                />
              </FormItem>
            </FormGroup>

            {/* Price preview card */}
            <div className="p-5 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Preço Bruto
                  </span>
                  <span className="text-lg font-semibold">
                    R$ {parseFloat(formData.price || "0").toFixed(2)}
                  </span>
                </div>
                {formData.markup && parseFloat(formData.markup) > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        Markup ({parseFloat(formData.markup).toFixed(2)}%)
                      </span>
                      <span className="text-lg font-semibold text-green-600">
                        + R${" "}
                        {(
                          (parseFloat(formData.price || "0") *
                            parseFloat(formData.markup)) /
                          100
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="h-px bg-border my-2" />
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    Preço de Venda
                  </span>
                  <span className="text-2xl font-bold text-green-600">
                    R${" "}
                    {(
                      parseFloat(formData.price || "0") +
                      (parseFloat(formData.price || "0") *
                        parseFloat(formData.markup || "0")) /
                        100
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <StepNavigation onBeforeNext={validateStep2} />
        </StepCard>

        {/* Step 3: Images */}
        <StepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Imagens do Produto</h3>
                <p className="text-sm text-muted-foreground">
                  Adicione até {maxImagesPerProduct} imagens (máx 2MB cada)
                </p>
              </div>
            </div>

            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {imageUrls.map((img, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-xl overflow-hidden bg-muted/30 border-2 border-border/30 group hover:border-primary/30 transition-colors"
                  >
                    <Image
                      src={img}
                      alt={`Produto ${index + 1}`}
                      fill
                      className="object-contain p-2"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-destructive/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive shadow-lg z-10"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium z-10">
                      {index + 1}/{maxImagesPerProduct}
                    </div>
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

            <div className="flex items-center justify-center gap-3">
              {Array.from({ length: maxImagesPerProduct }).map((_, i) => (
                <div
                  key={i}
                  className={`w-16 h-2 rounded-full transition-all duration-300 ${
                    i < imageUrls.length
                      ? "bg-gradient-to-r from-primary to-primary/80"
                      : "bg-border/50"
                  }`}
                />
              ))}
            </div>
          </div>

          <StepNavigation />
        </StepCard>

        {/* Step 4: Settings */}
        <StepCard>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 flex items-center justify-center">
                <Settings className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Configurações</h3>
                <p className="text-sm text-muted-foreground">
                  Status e opções de publicação
                </p>
              </div>
            </div>

            {/* Summary card */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/50 space-y-4">
              <h4 className="font-semibold text-foreground">
                Resumo do Produto
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <p className="font-medium truncate">{formData.name || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Categoria:</span>
                  <p className="font-medium">{formData.category || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Preço Bruto:</span>
                  <p className="font-medium">
                    R$ {parseFloat(formData.price || "0").toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Markup:</span>
                  <p className="font-medium text-green-600">
                    {parseFloat(formData.markup || "0").toFixed(2)}%
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Preço de Venda:</span>
                  <p className="font-medium text-green-600">
                    R${" "}
                    {(
                      parseFloat(formData.price || "0") +
                      (parseFloat(formData.price || "0") *
                        parseFloat(formData.markup || "0")) /
                        100
                    ).toFixed(2)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Imagens:</span>
                  <p className="font-medium">
                    {imageUrls.length} de {maxImagesPerProduct}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <StepNavigation
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
            submitLabel={productId ? "Salvar Alterações" : "Criar Produto"}
          />
        </StepCard>
      </StepWizard>

      {/* Modals */}
      <LimitReachedModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        resourceType="products"
        currentCount={currentProductCount}
        maxLimit={maxProducts}
      />

      <UpgradeModal
        open={showImageLimitModal}
        onOpenChange={setShowImageLimitModal}
        feature="Mais imagens por produto"
        description={`Seu plano permite até ${maxImagesPerProduct} imagens por produto.`}
        requiredPlan="pro"
      />
    </>
  );
}
