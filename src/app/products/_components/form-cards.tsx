"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DynamicSelect } from "@/components/features/dynamic-select";
import { FileUpload } from "@/components/ui/file-upload";
import { Save, X } from "lucide-react";
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações do Produto</CardTitle>
        <CardDescription>
          Preencha os dados principais do produto para identificação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Nome do Produto</Label>
          <Input
            id="name"
            name="name"
            placeholder="Ex: Tênis Esportivo Runner X"
            value={formData.name}
            onChange={onChange}
            required
            disabled={isReadOnly}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="Descreva as características principais do produto..."
            className="min-h-[120px]"
            value={formData.description}
            onChange={onChange}
            disabled={isReadOnly}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <DynamicSelect
              storageKey="product_categories"
              label="Categoria"
              id="category"
              name="category"
              value={formData.category}
              onChange={onChange}
              disabled={isReadOnly}
            />
          </div>
          <div className="grid gap-2">
            <DynamicSelect
              storageKey="product_manufacturers"
              label="Fabricante"
              id="manufacturer"
              name="manufacturer"
              value={formData.manufacturer}
              onChange={onChange}
              disabled={isReadOnly}
            />
          </div>
        </div>
      </CardContent>
    </Card>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preço e Estoque</CardTitle>
        <CardDescription>
          Defina os valores de venda e controle de estoque.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="price">Preço de Venda</Label>
          <CurrencyInput
            id="price"
            name="price"
            placeholder="0,00"
            value={formData.price}
            onChange={onChange}
            required
            disabled={isReadOnly}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="stock">Estoque Inicial</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            placeholder="0"
            value={formData.stock}
            onChange={onChange}
            disabled={isReadOnly}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sku">SKU (Código)</Label>
          <Input
            id="sku"
            name="sku"
            placeholder="PROD-001"
            value={formData.sku}
            onChange={onChange}
            disabled={isReadOnly}
          />
        </div>
      </CardContent>
    </Card>
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
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Imagens do Produto</CardTitle>
        <CardDescription>
          Adicione até 3 imagens (máx 2MB cada).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {images.map((img, index) => (
            <div
              key={index}
              className="relative aspect-square border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center group"
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
                  className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemoveImage(index)}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {!isReadOnly && images.length < 3 && (
          <FileUpload
            value={null}
            onChange={onAddImage}
            className="h-[150px] min-h-[150px]"
          />
        )}
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {images.length} de 3 imagens
        </p>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Publicação</CardTitle>
        <CardDescription>Revise e publique o produto.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            id="status"
            name="status"
            value={formData.status}
            onChange={onChange}
            disabled={isReadOnly}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </Select>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {!isReadOnly && (
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              "Salvando..."
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {productId ? "Salvar Alterações" : "Salvar Produto"}
              </>
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onCancel}
        >
          <X className="w-4 h-4 mr-2" /> Cancelar
        </Button>
      </CardFooter>
    </Card>
  );
}
