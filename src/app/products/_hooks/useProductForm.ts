"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
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
    >
  ) => void;
  handleBlur: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  handleAddImage: (file: File | null) => void;
  handleRemoveImage: (index: number) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export function useProductForm(
  initialData?: Product,
  productId?: string
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
    manufacturer: initialData?.manufacturer || "",
    category: initialData?.category || "",
    sku: initialData?.sku || "",
    stock: initialData?.stock || "",
    status: initialData?.status || "active",
    image: null,
    images: [],
  });

  // Existing image URLs (from Storage or legacy Base64)
  const [imageUrls, setImageUrls] = React.useState<string[]>(
    initialData?.images || (initialData?.image ? [initialData.image] : [])
  );

  // New files pending upload
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);

  // Preview URLs for pending files
  const [pendingPreviews, setPendingPreviews] = React.useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Track removed URLs for cleanup
  const [removedUrls, setRemovedUrls] = React.useState<string[]>([]);

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
        images: [],
      }));

      const existingImages =
        initialData.images || (initialData.image ? [initialData.image] : []);
      setImageUrls(existingImages);
      setPendingFiles([]);
      setPendingPreviews([]);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
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
    >
  ) => {
    const { name, value } = e.target;
    // Only validate fields that are in the schema
    const schemaFields = [
      "name",
      "description",
      "price",
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
        formData as unknown as Record<string, unknown>
      );
    }
  };

  const handleAddImage = (file: File | null) => {
    if (!file) return;

    // Get max images from plan (default to 2 for safety)
    const maxImages = features?.maxImagesPerProduct ?? 2;

    // Validation: Check plan limit
    const totalImages = imageUrls.length + pendingFiles.length;
    if (totalImages >= maxImages) {
      setShowImageLimitModal(true);
      return;
    }

    // Validation: File type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(
        "O arquivo deve ser uma imagem válida (JPEG, PNG, GIF, WebP ou SVG)."
      );
      return;
    }

    // Validation: File size (5MB max per image)
    if (file.size > MAX_FILE_SIZE) {
      toast.error(
        `A imagem deve ter no máximo ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
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

    try {
      // Upload pending files to Storage
      const uploadedUrls: string[] = [];
      for (const file of pendingFiles) {
        const result = await uploadImage(
          file,
          tenant.id,
          "products",
          productId || undefined
        );
        uploadedUrls.push(result.url);
      }

      // Combine existing URLs with newly uploaded ones
      const allImageUrls = [...imageUrls, ...uploadedUrls];

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
        manufacturer: formData.manufacturer,
        category: formData.category,
        sku: formData.sku,
        stock: formData.stock,
        status: formData.status as "active" | "inactive",
        images: allImageUrls,
      };

      if (productId) {
        await ProductService.updateProduct(productId, dataToSave);
        toast.success("Produto atualizado com sucesso!");
        router.push("/products");
        router.refresh();
      } else {
        const result = await createProduct({
          name: formData.name,
          description: formData.description,
          price: formData.price,
          manufacturer: formData.manufacturer,
          category: formData.category,
          sku: formData.sku,
          stock: formData.stock,
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
      toast.error("Erro ao salvar produto. Tente novamente.");
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
    showLimitModal,
    setShowLimitModal,
    showImageLimitModal,
    setShowImageLimitModal,
    currentProductCount,
    maxProducts: features?.maxProducts ?? 0,
    maxImagesPerProduct: features?.maxImagesPerProduct ?? 2,
    errors,
    setFieldError: setFieldError as (name: string, message: string) => void,
    handleChange,
    handleBlur,
    handleAddImage,
    handleRemoveImage,
    handleSubmit,
  };
}
