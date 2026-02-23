"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from '@/lib/toast';
import { ProductService, Product } from "@/services/product-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useProductActions } from "@/hooks/useProductActions";
import {
  uploadImage,
  deleteImage,
  isStorageUrl,
  ALLOWED_TYPES,
} from "@/services/storage-service";
import { useFormValidation, FormErrors } from "@/hooks/useFormValidation";
import { productSchema } from "@/lib/validations";

// Maximum file size: 5MB per image
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  markup: string;
  manufacturer: string;
  category: string;
  sku: string;
  stock: string;
  status: string;
  image: File | null;
  images: File[];
}

interface UseProductFormReturn {
  formData: ProductFormData;
  imageUrls: string[];
  pendingFiles: File[];
  isSubmitting: boolean;
  hasChanges: boolean;
  showLimitModal: boolean;
  setShowLimitModal: (value: boolean) => void;
  showImageLimitModal: boolean;
  setShowImageLimitModal: (value: boolean) => void;
  currentProductCount: number;
  maxProducts: number;
  maxImagesPerProduct: number;
  errors: FormErrors<ProductFormData>;
  setFieldError: (name: string, message: string) => void;
  handleChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  handleBlur: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  handleAddImage: (file: File | null) => void;
  handleRemoveImage: (index: number) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

const buildProductFormSnapshot = (
  formData: ProductFormData,
  imageUrls: string[],
  pendingFiles: File[],
): string => {
  const pendingFileKeys = pendingFiles.map(
    (file) => `${file.name}:${file.size}:${file.lastModified}:${file.type}`,
  );

  return JSON.stringify({
    name: formData.name,
    description: formData.description,
    price: formData.price,
    markup: formData.markup,
    manufacturer: formData.manufacturer,
    category: formData.category,
    sku: formData.sku,
    stock: formData.stock,
    status: formData.status,
    imageUrls,
    pendingFileKeys,
  });
};

export function useProductForm(
  initialData?: Product,
  productId?: string,
): UseProductFormReturn {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreateProduct, getProductCount, features } = usePlanLimits();
  const { createProduct } = useProductActions();

  const [showLimitModal, setShowLimitModal] = React.useState(false);
  const [showImageLimitModal, setShowImageLimitModal] = React.useState(false);
  const [currentProductCount, setCurrentProductCount] = React.useState(0);
  const {
    errors,
    validateForm,
    clearFieldError,
    validateField,
    setFieldError,
  } = useFormValidation({
    schema: productSchema,
  });

  const [formData, setFormData] = React.useState<ProductFormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    price: initialData?.price || "",
    markup: initialData?.markup || "30",
    manufacturer: initialData?.manufacturer || "",
    category: initialData?.category || "",
    sku: initialData?.sku || "",
    stock:
      typeof initialData?.stock === "number"
        ? String(initialData.stock)
        : "",
    status: initialData?.status || "active",
    image: null,
    images: [],
  });

  // Existing image URLs (from Storage or legacy Base64)
  const [imageUrls, setImageUrls] = React.useState<string[]>(
    initialData?.images || (initialData?.image ? [initialData.image] : []),
  );

  // New files pending upload
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);

  // Preview URLs for pending files
  const [pendingPreviews, setPendingPreviews] = React.useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Track removed URLs for cleanup
  const [removedUrls, setRemovedUrls] = React.useState<string[]>([]);
  const [initialSnapshot, setInitialSnapshot] = React.useState<string | null>(
    () => {
      if (productId) return null;

      return buildProductFormSnapshot(
        {
          name: initialData?.name || "",
          description: initialData?.description || "",
          price: initialData?.price || "",
          markup: initialData?.markup || "30",
          manufacturer: initialData?.manufacturer || "",
          category: initialData?.category || "",
          sku: initialData?.sku || "",
          stock:
            typeof initialData?.stock === "number"
              ? String(initialData.stock)
              : "",
          status: initialData?.status || "active",
          image: null,
          images: [],
        },
        initialData?.images || (initialData?.image ? [initialData.image] : []),
        [],
      );
    },
  );

  // Update form data if initialData changes
  React.useEffect(() => {
    if (initialData) {
      const initialFormData: ProductFormData = {
        name: initialData.name || "",
        description: initialData.description || "",
        price: initialData.price || "",
        markup: initialData.markup || "",
        manufacturer: initialData.manufacturer || "",
        category: initialData.category || "",
        sku: initialData.sku || "",
        stock:
          typeof initialData.stock === "number"
            ? String(initialData.stock)
            : "",
        status: initialData.status || "active",
        image: null,
        images: [],
      };

      setFormData((prev) => ({
        ...prev,
        ...initialFormData,
      }));

      const existingImages =
        initialData.images || (initialData.image ? [initialData.image] : []);
      setImageUrls(existingImages);
      setPendingFiles([]);
      setPendingPreviews([]);
      setRemovedUrls([]);
      setInitialSnapshot(
        buildProductFormSnapshot(initialFormData, existingImages, []),
      );
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      clearFieldError(name as keyof typeof errors);
    }
  };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    // Only validate fields that are in the schema
    const schemaFields = [
      "name",
      "description",
      "price",
      "markup",
      "manufacturer",
      "category",
      "sku",
      "stock",
      "status",
    ];
    if (schemaFields.includes(name)) {
      validateField(
        name as keyof typeof errors,
        value,
        formData as unknown as Record<string, unknown>,
      );
    }
  };

  const handleAddImage = (file: File | null) => {
    if (!file) return;

    // Hardcoded max images (1 for all plans)
    const maxImages = 1;

    // Validation: Check plan limit
    const totalImages = imageUrls.length + pendingFiles.length;
    if (totalImages >= maxImages) {
      toast.error("É permitido adicionar apenas 1 imagem por produto.");
      return;
    }

    // Validation: File type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(
        "O arquivo deve ser uma imagem válida (JPEG, PNG, GIF, WebP ou SVG).",
      );
      return;
    }

    // Validation: File size (5MB max per image)
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `A imagem deve ter no máximo ${MAX_FILE_SIZE / (1024 * 1024)}MB.`,
      );
      return;
    }

    // Add to pending files
    setPendingFiles((prev) => [...prev, file]);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setPendingPreviews((prev) => [...prev, e.target!.result as string]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (index: number) => {
    const totalExisting = imageUrls.length;

    if (index < totalExisting) {
      // Removing an existing image
      const urlToRemove = imageUrls[index];

      // Track for deletion if it's a Storage URL
      if (isStorageUrl(urlToRemove)) {
        setRemovedUrls((prev) => [...prev, urlToRemove]);
      }

      setImageUrls((prev) => prev.filter((_, i) => i !== index));
    } else {
      // Removing a pending file
      const pendingIndex = index - totalExisting;
      setPendingFiles((prev) => prev.filter((_, i) => i !== pendingIndex));
      setPendingPreviews((prev) => prev.filter((_, i) => i !== pendingIndex));
    }
  };

  const hasChanges = React.useMemo(() => {
    if (!initialSnapshot) return false;

    return (
      buildProductFormSnapshot(formData, imageUrls, pendingFiles) !==
      initialSnapshot
    );
  }, [formData, imageUrls, pendingFiles, initialSnapshot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check product limit only for NEW products
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
      toast.error("Erro: Nenhuma empresa selecionada!");
      return;
    }

    // Validate form before submit - only validate fields that are in the schema
    const schemaData = {
      name: formData.name,
      description: formData.description,
      price: formData.price,
      markup: formData.markup,
      manufacturer: formData.manufacturer,
      category: formData.category,
      sku: formData.sku,
      stock: formData.stock,
      status: formData.status as "active" | "inactive",
    };
    if (!validateForm(schemaData)) {
      toast.error("Preencha todos os campos obrigatórios!");
      return;
    }

    setIsSubmitting(true);
    const productLabel = formData.name.trim()
      ? `"${formData.name.trim()}"`
      : "selecionado";

    try {
      // Upload pending files to Storage
      const uploadedUrls: string[] = [];
      for (const file of pendingFiles) {
        const result = await uploadImage(
          file,
          tenant.id,
          "products",
          productId || undefined,
        );
        uploadedUrls.push(result.url);
      }

      // Combine existing URLs with newly uploaded ones
      const allImageUrls = [...imageUrls, ...uploadedUrls];
      const normalizedStock = Number(formData.stock || 0);

      // Delete removed images from Storage
      for (const url of removedUrls) {
        try {
          await deleteImage(url);
        } catch (error) {
          console.warn("Failed to delete image:", error);
        }
      }

      const dataToSave = {
        tenantId: tenant.id,
        name: formData.name,
        description: formData.description,
        price: formData.price,
        markup: formData.markup,
        manufacturer: formData.manufacturer,
        category: formData.category,
        sku: formData.sku,
        stock: normalizedStock,
        status: formData.status as "active" | "inactive",
        images: allImageUrls,
      };

      if (productId) {
        await ProductService.updateProduct(productId, dataToSave);
        toast.success(`Produto ${productLabel} foi atualizado com sucesso.`, {
          title: "Sucesso ao editar",
        });
        router.push("/products");
        router.refresh();
      } else {
        const result = await createProduct({
          targetTenantId: tenant.id, // Pass tenant ID. Backend only respects it if superadmin.
          name: formData.name,
          description: formData.description,
          price: formData.price,
          markup: formData.markup,
          manufacturer: formData.manufacturer,
          category: formData.category,
          sku: formData.sku,
          stock: normalizedStock,
          status: formData.status as "active" | "inactive",
          images: allImageUrls,
        });

        if (result?.success) {
          router.push("/products");
          router.refresh();
        }
      }
    } catch (error) {
      console.error("Error saving product:", error);
      const errorMessage =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha inesperada ao salvar o produto.";
      const actionLabel = productId ? "editar" : "salvar";

      toast.error(
        `Nao foi possivel ${actionLabel} o produto ${productLabel}. Detalhes: ${errorMessage}`,
        { title: productId ? "Erro ao editar" : "Erro ao salvar" },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Combine existing URLs and pending previews for display
  const allImages = [...imageUrls, ...pendingPreviews];

  return {
    formData,
    imageUrls: allImages,
    pendingFiles,
    isSubmitting,
    hasChanges,
    showLimitModal,
    setShowLimitModal,
    showImageLimitModal,
    setShowImageLimitModal,
    currentProductCount,
    maxProducts: features?.maxProducts ?? 0,
    maxImagesPerProduct: 1, // Enforced 1 image per product
    errors,
    setFieldError: setFieldError as (name: string, message: string) => void,
    handleChange,
    handleBlur,
    handleAddImage,
    handleRemoveImage,
    handleSubmit,
  };
}
