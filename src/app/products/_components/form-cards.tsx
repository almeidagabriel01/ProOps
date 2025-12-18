"use client";

import { FormCard, FormSection } from "@/components/ui/form-card";
import { FormField, FormRow, FormDisplayField } from "@/components/ui/form-field";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { DynamicSelect } from "@/components/features/dynamic-select";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import {
  Package,
  DollarSign,
  Image as ImageIcon,
  CheckCircle,
  X
} from "lucide-react";
import { ProductFormData } from "../_hooks/useProductForm";

// ============================================
// PRODUCT INFO CARD
// ============================================

interface ProductInfoCardProps {
  formData: ProductFormData;
  onChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  isReadOnly?: boolean;
}

export function ProductInfoCard({
  formData,
  onChange,
  isReadOnly,
}: ProductInfoCardProps) {
  if (isReadOnly) {
    return (
      <FormCard
        title="Informações do Produto"
        description="Dados principais do produto"
        icon={Package}
      >
        <FormDisplayField label="Nome do Produto" value={formData.name} />
        <FormDisplayField label="Descrição" value={formData.description} />
        <FormRow>
          <FormDisplayField label="Categoria" value={formData.category} />
          <FormDisplayField label="Fabricante" value={formData.manufacturer} />
        </FormRow>
      </FormCard>
    );
  }

  return (
    <FormCard
      title="Informações do Produto"
      description="Preencha os dados principais do produto para identificação"
      icon={Package}
    >
      <FormField label="Nome do Produto" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          placeholder="Ex: Tênis Esportivo Runner X"
          value={formData.name}
          onChange={onChange}
          required
        />
      </FormField>

      <FormField label="Descrição" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          placeholder="Descreva as características principais do produto..."
          className="min-h-[120px]"
          value={formData.description}
          onChange={onChange}
        />
      </FormField>

      <FormRow>
        <DynamicSelect
          storageKey="product_categories"
          label="Categoria"
          id="category"
          name="category"
          value={formData.category}
          onChange={onChange}
        />
        <DynamicSelect
          storageKey="product_manufacturers"
          label="Fabricante"
          id="manufacturer"
          name="manufacturer"
          value={formData.manufacturer}
          onChange={onChange}
        />
      </FormRow>
    </FormCard>
  );
}

// ============================================
// PRICE STOCK CARD
// ============================================

interface PriceStockCardProps {
  formData: ProductFormData;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isReadOnly?: boolean;
}

export function PriceStockCard({
  formData,
  onChange,
  isReadOnly,
}: PriceStockCardProps) {
  if (isReadOnly) {
    return (
      <FormCard
        title="Preço e Estoque"
        description="Valores de venda e controle de estoque"
        icon={DollarSign}
      >
        <FormRow cols={3}>
          <FormDisplayField
            label="Preço de Venda"
            value={`R$ ${parseFloat(formData.price || "0").toFixed(2)}`}
          />
          <FormDisplayField label="Estoque" value={formData.stock} />
          <FormDisplayField label="SKU" value={formData.sku} />
        </FormRow>
      </FormCard>
    );
  }

  return (
    <FormCard
      title="Preço e Estoque"
      description="Defina os valores de venda e controle de estoque"
      icon={DollarSign}
    >
      <FormRow cols={3}>
        <FormField label="Preço de Venda" htmlFor="price" required>
          <CurrencyInput
            id="price"
            name="price"
            placeholder="0,00"
            value={formData.price}
            onChange={onChange}
            required
          />
        </FormField>
        <FormField label="Estoque Inicial" htmlFor="stock">
          <Input
            id="stock"
            name="stock"
            type="number"
            placeholder="0"
            value={formData.stock}
            onChange={onChange}
          />
        </FormField>
        <FormField label="SKU (Código)" htmlFor="sku">
          <Input
            id="sku"
            name="sku"
            placeholder="PROD-001"
            value={formData.sku}
            onChange={onChange}
          />
        </FormField>
      </FormRow>
    </FormCard>
  );
}

// ============================================
// IMAGES CARD
// ============================================

interface ImagesCardProps {
  images: string[];
  onAddImage: (file: File | null) => void;
  onRemoveImage: (index: number) => void;
  isReadOnly?: boolean;
}

export function ImagesCard({
  images,
  onAddImage,
  onRemoveImage,
  isReadOnly,
}: ImagesCardProps) {
  return (
    <FormCard
      title="Imagens do Produto"
      description="Adicione até 3 imagens (máx 2MB cada)"
      icon={ImageIcon}
    >
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted/50 border border-border group"
            >
              <img
                src={img}
                alt={`Product ${index + 1}`}
                className="w-full h-full object-contain"
              />
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  onClick={() => onRemoveImage(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {!isReadOnly && images.length < 3 && (
        <FileUpload
          value={null}
          onChange={onAddImage}
          className="h-[140px] min-h-[140px]"
        />
      )}

      <p className="text-xs text-muted-foreground text-center">
        {images.length} de 3 imagens
      </p>
    </FormCard>
  );
}

// ============================================
// PUBLISH CARD
// ============================================

interface PublishCardProps {
  formData: ProductFormData;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  isSubmitting: boolean;
  productId?: string;
  isReadOnly?: boolean;
  onCancel: () => void;
}

export function PublishCard({
  formData,
  onChange,
  isSubmitting,
  productId,
  isReadOnly,
  onCancel,
}: PublishCardProps) {
  return (
    <FormCard
      title="Publicação"
      description="Revise e publique o produto"
      icon={CheckCircle}
    >
      {!isReadOnly && (
        <FormField label="Status" htmlFor="status">
          <Select
            id="status"
            name="status"
            value={formData.status}
            onChange={onChange}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </Select>
        </FormField>
      )}

      {isReadOnly && (
        <FormDisplayField
          label="Status"
          value={formData.status === "active" ? "Ativo" : "Inativo"}
        />
      )}

      <FormActions
        isSubmitting={isSubmitting}
        isReadOnly={isReadOnly}
        submitLabel={productId ? "Salvar Alterações" : "Salvar Produto"}
        onCancel={onCancel}
        layout="vertical"
        align="center"
      />
    </FormCard>
  );
}
