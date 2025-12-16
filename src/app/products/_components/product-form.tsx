"use client";

import { Select } from "@/components/ui/select";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { ProductService, Product } from "@/services/product-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import { Save, X } from "lucide-react";

interface ProductFormProps {
  initialData?: Product;
  productId?: string;
  isReadOnly?: boolean;
}

export function ProductForm({ initialData, productId, isReadOnly = false }: ProductFormProps) {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreateProduct, getProductCount, features } = usePlanLimits();

  // Limit modal state
  const [showLimitModal, setShowLimitModal] = React.useState(false);
  const [currentProductCount, setCurrentProductCount] = React.useState(0);

  const [formData, setFormData] = React.useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    price: initialData?.price || "",
    manufacturer: initialData?.manufacturer || "",
    category: initialData?.category || "",
    sku: initialData?.sku || "",
    stock: initialData?.stock || "",
    status: initialData?.status || "active",
    image: null as File | null, // Deprecated in UI but keeping for type safety internally if needed
    images: [] as File[], // New: Array for up to 3 images
  });

  const [imagesBase64, setImagesBase64] = React.useState<string[]>(
    initialData?.images || (initialData?.image ? [initialData.image] : [])
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Update form data if initialData changes
  React.useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        name: initialData.name || "",
        description: initialData.description || "",
        price: initialData.price || "",
        manufacturer: initialData.manufacturer || "",
        category: initialData.category || "",
        sku: initialData.sku || "",
        stock: initialData.stock || "",
        status: initialData.status || "active",
        images: [], // Reset new files on load
      }));

      // Migrate single image to array if needed
      const existingImages =
        initialData.images || (initialData.image ? [initialData.image] : []);
      setImagesBase64(existingImages);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddImage = (file: File | null) => {
    if (!file) return;

    // Validation: Max 3 images
    if (imagesBase64.length >= 3) {
      alert("Máximo de 3 imagens permitido.");
      return;
    }

    // Validation: Total size limit (900KB safe limit for Firestore 1MB doc)
    // Calculate current total size
    const currentTotalSize = imagesBase64.reduce(
      (acc, img) => acc + (img.length * 3) / 4,
      0
    );
    const newImageSize = file.size;

    if (currentTotalSize + newImageSize > 900 * 1024) {
      alert(
        "O tamanho total das imagens não pode exceder 900KB (Restrição do Banco de Dados). Tente imagens menores."
      );
      return;
    }

    // Add to state
    setFormData((prev) => ({ ...prev, images: [...prev.images, file] }));

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImagesBase64((prev) => [...prev, e.target!.result as string]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (index: number) => {
    // Remove from previews
    const newPreviews = [...imagesBase64];
    newPreviews.splice(index, 1);
    setImagesBase64(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check product limit only for NEW products (not edits)
    if (!productId) {
      const canCreate = await canCreateProduct();
      if (!canCreate) {
        const count = await getProductCount();
        setCurrentProductCount(count);
        setShowLimitModal(true);
        return;
      }
    }

    if (!tenant) {
      alert("Erro: Nenhuma empresa selecionada!");
      return;
    }

    // Validate Image Sizes (Double check)
    // Validate Total Size again before submit
    const totalSize = imagesBase64.reduce(
      (acc, img) => acc + (img.length * 3) / 4,
      0
    );
    if (totalSize > 900 * 1024) {
      alert(
        "O tamanho total das imagens excede o limite de 900KB. Remova algumas imagens."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const dataToSave = {
        tenantId: tenant.id,
        name: formData.name,
        description: formData.description,
        price: formData.price,
        manufacturer: formData.manufacturer,
        category: formData.category,
        sku: formData.sku,
        stock: formData.stock,
        status: formData.status as "active" | "inactive",
        images: imagesBase64,
      };

      if (productId) {
        await ProductService.updateProduct(productId, dataToSave);
        alert("Produto atualizado com sucesso!");
      } else {
        await ProductService.createProduct(dataToSave);
        alert(`Produto cadastrado para ${tenant.name} com sucesso!`);
      }

      router.push("/products");
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar produto. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
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
                    onChange={handleChange}
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
                      onChange={handleChange}
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
                      onChange={handleChange}
                      disabled={isReadOnly}
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
                    onChange={handleChange}
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
                    onChange={handleChange}
                    disabled={isReadOnly}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Media and Actions */}
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Imagens do Produto</CardTitle>
                <CardDescription>
                  Adicione até 3 imagens (máx 2MB cada).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {imagesBase64.map((img, index) => (
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
                          onClick={() => handleRemoveImage(index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {!isReadOnly && imagesBase64.length < 3 && (
                  <FileUpload
                    value={null} // Always reset to allow new uploads
                    onChange={handleAddImage}
                    className="h-[150px] min-h-[150px]"
                  />
                )}
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {imagesBase64.length} de 3 imagens
                </p>
              </CardContent>
            </Card>

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
                    onChange={handleChange}
                    disabled={isReadOnly}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </Select>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                {!isReadOnly && (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      "Salvando..."
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />{" "}
                        {productId ? "Salvar Alterações" : "Salvar Produto"}
                      </>
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => router.back()}
                >
                  <X className="w-4 h-4 mr-2" /> Cancelar
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>

      {/* Limit Reached Modal */}
      <LimitReachedModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        resourceType="products"
        currentCount={currentProductCount}
        maxLimit={features?.maxProducts || 0}
      />
    </>
  );
}
