"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { DynamicSelect } from "@/components/features/dynamic-select";
import { ProductService } from "@/services/product-service";
import { useTenant } from "@/providers/tenant-provider";
import { Save, X } from "lucide-react";

export function ProductForm() {
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    price: "",
    manufacturer: "",
    category: "",
    sku: "",
    stock: "",

    image: null as File | null,
  });
  const [imageBase64, setImageBase64] = React.useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (file: File | null) => {
    setFormData((prev) => ({ ...prev, image: file }));

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageBase64(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImageBase64(null);
    }
  };

  const { tenant } = useTenant(); // Get current tenant

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) {
      alert("Erro: Nenhuma empresa selecionada!");
      return;
    }
    setIsSubmitting(true);

    try {
      await ProductService.createProduct({
        tenantId: tenant.id,
        name: formData.name,
        description: formData.description,
        price: formData.price,
        manufacturer: formData.manufacturer,
        category: formData.category,
        sku: formData.sku,
        stock: formData.stock,
        image: imageBase64, // Caution: Firestore 1MB limit. Recommended: Firebase Storage.
      });

      alert(`Produto cadastrado para ${tenant.name} com sucesso!`);
      setFormData({
        name: "",
        description: "",
        price: "",
        manufacturer: "",
        category: "",
        sku: "",
        stock: "",
        image: null,
      });
      setImageBase64(null);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar produto. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Main Info */}
        <div className="lg:col-span-2 space-y-6">
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
                  onChange={handleChange}
                  required
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
                  onChange={handleChange}
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
                    onChange={handleChange}
                    defaultOptions={[
                      { id: "1", label: "Eletrônicos" },
                      { id: "2", label: "Vestuário" },
                      { id: "3", label: "Móveis" },
                    ]}
                  />
                </div>
                <div className="grid gap-2">
                  <DynamicSelect
                    storageKey="product_manufacturers"
                    label="Fabricante"
                    id="manufacturer"
                    name="manufacturer"
                    value={formData.manufacturer}
                    onChange={handleChange}
                    defaultOptions={[
                      { id: "1", label: "Nike" },
                      { id: "2", label: "Apple" },
                      { id: "3", label: "Samsung" },
                    ]}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preço e Estoque</CardTitle>
              <CardDescription>
                Defina os valores de venda e controle de estoque.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Preço de Venda (R$)</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  placeholder="0,00"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  required
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
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sku">SKU (Código)</Label>
                <Input
                  id="sku"
                  name="sku"
                  placeholder="PROD-001"
                  value={formData.sku}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Media and Actions */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Imagem do Produto</CardTitle>
              <CardDescription>Adicione uma imagem de capa.</CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload value={formData.image} onChange={handleFileChange} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publicação</CardTitle>
              <CardDescription>Revise e publique o produto.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between p-2 border rounded-md">
                <span className="text-sm font-medium">Status</span>
                <span className="text-sm text-green-500 font-bold bg-green-500/10 px-2 py-1 rounded">
                  Ativo
                </span>
              </div>
              <div className="flex items-center justify-between p-2 border rounded-md">
                <span className="text-sm font-medium">Visibilidade</span>
                <span className="text-sm">Pública</span>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  "Salvando..."
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Salvar Produto
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" className="w-full">
                <X className="w-4 h-4 mr-2" /> Cancelar
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </form>
  );
}
