"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { ProductService, Product } from "@/services/product-service";
import { ServiceService, Service } from "@/services/service-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useProductActions } from "@/hooks/useProductActions";
import { useServiceActions } from "@/hooks/useServiceActions";
import {
  uploadImage,
  deleteImage,
  isStorageUrl,
  ALLOWED_TYPES,
} from "@/services/storage-service";
import { useFormValidation, FormErrors } from "@/hooks/useFormValidation";
import { productSchema, serviceSchema } from "@/lib/validations";
import { parseInventoryValue } from "@/lib/niches/config";
import {
  CurtainHeightTier,
  ProductPricingMode,
  sanitizeHeightTiers,
  getProductPricingMode,
  normalizeProductPricingModel,
} from "@/lib/product-pricing";

// Maximum file size: 5MB per image
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface ProductFormData {
  name: string;
  description: string;
  price: string;
  markup: string;
  pricingMode: ProductPricingMode;
  heightPricingTiers: HeightPricingTierFormData[];
  manufacturer?: string;
  category: string;
  inventoryValue: string;
  status: string;
  image: File | null;
  images: File[];
}

export interface HeightPricingTierFormData {
  id: string;
  maxHeight: string;
  basePrice: string;
  markup: string;
}

type CatalogEntityType = "product" | "service";
type CatalogItem = Product | Service;

function getInitialProductMarkup(
  initialData: CatalogItem | undefined,
  entityType: CatalogEntityType,
  fallbackValue: string,
): string {
  if (entityType !== "product" || !initialData || !("manufacturer" in initialData)) {
    return fallbackValue;
  }

  return initialData.markup || fallbackValue;
}

function getInitialInventoryValue(
  initialData: CatalogItem | undefined,
  entityType: CatalogEntityType,
): string {
  if (entityType !== "product" || !initialData || !("manufacturer" in initialData)) {
    return "";
  }

  return normalizeInitialInventoryValue(
    initialData.inventoryValue ?? initialData.stock,
  );
}

function normalizeInitialInventoryValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const parsed = parseInventoryValue(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function resolveCatalogInventoryUnit(
  niche: string | undefined,
  entityType: CatalogEntityType,
  pricingMode: ProductPricingMode,
): "unit" | "meter" {
  if (entityType !== "product") {
    return niche === "cortinas" ? "meter" : "unit";
  }

  if (niche === "cortinas" && pricingMode === "standard") {
    return "unit";
  }

  return niche === "cortinas" ? "meter" : "unit";
}

function createHeightPricingTierFormData(
  tier?: Partial<CurtainHeightTier>,
  index: number = 0,
): HeightPricingTierFormData {
  return {
    id:
      typeof tier?.id === "string" && tier.id.trim()
        ? tier.id.trim()
        : `tier-${Date.now()}-${index}`,
    maxHeight:
      tier?.maxHeight !== undefined && tier?.maxHeight !== null
        ? String(tier.maxHeight)
        : "",
    basePrice:
      tier?.basePrice !== undefined && tier?.basePrice !== null
        ? String(tier.basePrice)
        : "",
    markup:
      tier?.markup !== undefined && tier?.markup !== null
        ? String(tier.markup)
        : "30",
  };
}

function getInitialPricingMode(
  initialData: CatalogItem | undefined,
  entityType: CatalogEntityType,
  niche?: string,
): ProductPricingMode {
  if (entityType !== "product" || !initialData || !("manufacturer" in initialData)) {
    return niche === "cortinas" ? "curtain_meter" : "standard";
  }

  return getProductPricingMode(initialData);
}

function getInitialHeightPricingTiers(
  initialData: CatalogItem | undefined,
  entityType: CatalogEntityType,
): HeightPricingTierFormData[] {
  if (entityType !== "product" || !initialData || !("manufacturer" in initialData)) {
    return [];
  }

  const pricingModel = normalizeProductPricingModel(initialData.pricingModel);
  if (pricingModel.mode !== "curtain_height") {
    return [];
  }

  return pricingModel.tiers.map((tier, index) =>
    createHeightPricingTierFormData(tier, index),
  );
}

function mapHeightPricingTiersForSchema(
  tiers: HeightPricingTierFormData[],
): HeightPricingTierFormData[] {
  return tiers.map((tier) => ({
    id: tier.id,
    maxHeight: tier.maxHeight,
    basePrice: tier.basePrice,
    markup: tier.markup,
  }));
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
  handlePricingModeChange: (mode: ProductPricingMode) => void;
  addHeightPricingTier: () => void;
  updateHeightPricingTier: (
    tierId: string,
    field: keyof Omit<HeightPricingTierFormData, "id">,
    value: string,
  ) => void;
  removeHeightPricingTier: (tierId: string) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

const buildProductFormSnapshot = (
  formData: ProductFormData,
  imageUrls: string[],
  pendingFiles: File[],
  entityType: CatalogEntityType,
): string => {
  const pendingFileKeys = pendingFiles.map(
    (file) => `${file.name}:${file.size}:${file.lastModified}:${file.type}`,
  );

  const baseSnapshot = {
    name: formData.name,
    description: formData.description,
    price: formData.price,
    category: formData.category,
    status: formData.status,
    imageUrls,
    pendingFileKeys,
  };

  const productOnlySnapshot =
    entityType === "product"
      ? {
          markup: formData.markup,
          pricingMode: formData.pricingMode,
          heightPricingTiers: mapHeightPricingTiersForSchema(
            formData.heightPricingTiers,
          ),
          manufacturer: formData.manufacturer,
          inventoryValue: formData.inventoryValue,
        }
      : {};

  return JSON.stringify({
    ...baseSnapshot,
    ...productOnlySnapshot,
  });
};

export function useProductForm(
  initialData?: CatalogItem,
  productId?: string,
  entityType: CatalogEntityType = "product",
): UseProductFormReturn {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreateProduct, getProductCount, features } = usePlanLimits();
  const { createProduct } = useProductActions();
  const { createService } = useServiceActions();
  const maxImagesPerProduct =
    entityType === "product" && tenant?.niche === "cortinas" ? 3 : 1;

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
    schema: entityType === "service" ? serviceSchema : productSchema,
  });

  const [formData, setFormData] = React.useState<ProductFormData>({
    name: initialData?.name || "",
    description: initialData?.description || "",
    price: initialData?.price || "",
    markup: getInitialProductMarkup(initialData, entityType, productId ? "" : "30"),
    pricingMode: getInitialPricingMode(initialData, entityType, tenant?.niche),
    heightPricingTiers: getInitialHeightPricingTiers(initialData, entityType),
    manufacturer:
      "manufacturer" in (initialData || {})
        ? (initialData as Product).manufacturer
        : "",
    category: initialData?.category || "",
    inventoryValue: getInitialInventoryValue(initialData, entityType),
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
          markup: getInitialProductMarkup(
            initialData,
            entityType,
            productId ? "" : "30",
          ),
          pricingMode: getInitialPricingMode(initialData, entityType, tenant?.niche),
          heightPricingTiers: getInitialHeightPricingTiers(
            initialData,
            entityType,
          ),
          manufacturer:
            "manufacturer" in (initialData || {})
              ? (initialData as Product).manufacturer
              : "",
          category: initialData?.category || "",
          inventoryValue: getInitialInventoryValue(initialData, entityType),
          status: initialData?.status || "active",
          image: null,
          images: [],
        },
        initialData?.images || (initialData?.image ? [initialData.image] : []),
        [],
        entityType,
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
        markup: getInitialProductMarkup(initialData, entityType, ""),
        pricingMode: getInitialPricingMode(initialData, entityType, tenant?.niche),
        heightPricingTiers: getInitialHeightPricingTiers(initialData, entityType),
        manufacturer:
          entityType === "product" && "manufacturer" in initialData
            ? (initialData as Product).manufacturer
            : "",
        category: initialData.category || "",
        inventoryValue: getInitialInventoryValue(initialData, entityType),
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
        buildProductFormSnapshot(initialFormData, existingImages, [], entityType),
      );
    }
  }, [initialData, entityType, tenant?.niche]);

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
    const schemaFields =
      entityType === "product"
          ? [
              "name",
              "description",
              "price",
              "markup",
              "pricingMode",
              "manufacturer",
              "category",
              "inventoryValue",
            "status",
          ]
        : ["name", "description", "price", "category", "status"];
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

    const maxImages = maxImagesPerProduct;

    // Validation: Check plan limit
    const totalImages = imageUrls.length + pendingFiles.length;
    if (totalImages >= maxImages) {
      toast.error(
        `É permitido adicionar apenas ${maxImages} ${
          maxImages === 1 ? "imagem" : "imagens"
        } por produto.`,
      );
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

  const handlePricingModeChange = (mode: ProductPricingMode) => {
    setFormData((prev) => ({
      ...prev,
      pricingMode: mode,
      heightPricingTiers:
        mode === "curtain_height"
          ? prev.heightPricingTiers.length > 0
            ? prev.heightPricingTiers
            : [
                createHeightPricingTierFormData(
                  {
                    basePrice: Number.parseFloat(prev.price || "0") || undefined,
                    markup: Number.parseFloat(prev.markup || "30") || 30,
                  },
                  0,
                ),
              ]
          : [],
    }));

    if (errors.price) {
      clearFieldError("price");
    }
    if ((errors as Record<string, string | undefined>).heightPricingTiers) {
      clearFieldError("heightPricingTiers" as never);
    }
  };

  const addHeightPricingTier = () => {
    setFormData((prev) => ({
      ...prev,
      heightPricingTiers: [
        ...prev.heightPricingTiers,
        createHeightPricingTierFormData(undefined, prev.heightPricingTiers.length),
      ],
    }));
    if ((errors as Record<string, string | undefined>).heightPricingTiers) {
      clearFieldError("heightPricingTiers" as never);
    }
  };

  const updateHeightPricingTier = (
    tierId: string,
    field: keyof Omit<HeightPricingTierFormData, "id">,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      heightPricingTiers: prev.heightPricingTiers.map((tier) =>
        tier.id === tierId ? { ...tier, [field]: value } : tier,
      ),
    }));
    if ((errors as Record<string, string | undefined>).heightPricingTiers) {
      clearFieldError("heightPricingTiers" as never);
    }
  };

  const removeHeightPricingTier = (tierId: string) => {
    setFormData((prev) => ({
      ...prev,
      heightPricingTiers: prev.heightPricingTiers.filter(
        (tier) => tier.id !== tierId,
      ),
    }));
  };

  const hasChanges = React.useMemo(() => {
    if (!initialSnapshot) return false;

    return (
      buildProductFormSnapshot(formData, imageUrls, pendingFiles, entityType) !==
      initialSnapshot
    );
  }, [formData, imageUrls, pendingFiles, initialSnapshot, entityType]);

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
    const schemaData =
      entityType === "product"
        ? {
            name: formData.name,
            description: formData.description,
            price: formData.price,
            markup: formData.markup,
            pricingMode: formData.pricingMode,
            heightPricingTiers: mapHeightPricingTiersForSchema(
              formData.heightPricingTiers,
            ),
            manufacturer: formData.manufacturer,
            category: formData.category,
            inventoryValue: formData.inventoryValue,
            status: formData.status as "active" | "inactive",
          }
        : {
            name: formData.name,
            description: formData.description,
            price: formData.price,
            category: formData.category,
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
          entityType === "service" ? "services" : "products",
          productId || undefined,
        );
        uploadedUrls.push(result.url);
      }

      // Combine existing URLs with newly uploaded ones
      const allImageUrls = [...imageUrls, ...uploadedUrls];
      const normalizedInventoryValue = parseInventoryValue(
        formData.inventoryValue,
      );
      const inventoryUnit = resolveCatalogInventoryUnit(
        tenant?.niche,
        entityType,
        formData.pricingMode,
      );
      const sanitizedHeightTiers = sanitizeHeightTiers(
        formData.heightPricingTiers.map((tier) => ({
          id: tier.id,
          maxHeight: tier.maxHeight,
          basePrice: tier.basePrice,
          markup: tier.markup,
        })),
      );
      const pricingModel =
        entityType !== "product"
          ? undefined
          : formData.pricingMode === "curtain_height"
            ? {
                mode: "curtain_height" as const,
                tiers: sanitizedHeightTiers,
              }
            : {
                mode: (formData.pricingMode === "curtain_meter"
                  ? "curtain_meter"
                  : formData.pricingMode === "curtain_width"
                    ? "curtain_width"
                    : "standard") as "curtain_meter" | "curtain_width" | "standard",
              };
      const representativeHeightTier = sanitizedHeightTiers[0];
      const persistedPrice =
        entityType === "product" && formData.pricingMode === "curtain_height"
          ? String(representativeHeightTier?.basePrice || 0)
          : formData.price;
      const persistedMarkup =
        entityType === "product" && formData.pricingMode === "curtain_height"
          ? String(representativeHeightTier?.markup || 0)
          : formData.markup;

      // Delete removed images from Storage
      for (const url of removedUrls) {
        try {
          await deleteImage(url);
        } catch (error) {
          console.warn("Failed to delete image:", error);
        }
      }

      const baseDataToSave = {
        tenantId: tenant.id,
        name: formData.name,
        description: formData.description,
        price: persistedPrice,
        category: formData.category,
        status: formData.status as "active" | "inactive",
        images: allImageUrls,
      };
      const productOnlyData =
        entityType === "product"
          ? {
              markup: persistedMarkup,
              pricingModel,
              manufacturer: formData.manufacturer,
              inventoryValue: normalizedInventoryValue,
              inventoryUnit,
              stock: normalizedInventoryValue,
            }
          : {};
      const dataToSave = { ...baseDataToSave, ...productOnlyData };

      const entityLabel = entityType === "service" ? "serviço" : "produto";
      const entityPluralPath =
        entityType === "service" ? "/services" : "/products";

      if (productId) {
        if (entityType === "service") {
          await ServiceService.updateService(productId, dataToSave);
        } else {
          await ProductService.updateProduct(productId, dataToSave);
          if (tenant) {
            ProductService.invalidateTenantCache(tenant.id);
          }
        }
        toast.success(
          `${entityLabel.charAt(0).toUpperCase() + entityLabel.slice(1)} ${productLabel} foi atualizado com sucesso.`,
          {
            title: "Sucesso ao editar",
          },
        );
        router.push(entityPluralPath);
        router.refresh();
      } else {
        const basePayload = {
          targetTenantId: tenant.id,
          name: formData.name,
          description: formData.description,
          price: persistedPrice,
          category: formData.category,
          status: formData.status as "active" | "inactive",
          images: allImageUrls,
        };
        const productOnlyPayload =
          entityType === "product"
            ? {
                markup: persistedMarkup,
                pricingModel,
                manufacturer: formData.manufacturer,
                inventoryValue: normalizedInventoryValue,
                inventoryUnit,
                stock: normalizedInventoryValue,
              }
            : {};
        const payload = { ...basePayload, ...productOnlyPayload };

        const result =
          entityType === "service"
            ? await createService(payload)
            : await createProduct(payload);

        if (result?.success) {
          router.push(entityPluralPath);
          router.refresh();
        }
      }
    } catch (error) {
      console.error("Error saving product:", error);
      const errorMessage =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : `Falha inesperada ao salvar o ${entityType === "service" ? "serviço" : "produto"}.`;
      const actionLabel = productId ? "editar" : "salvar";
      const noun = entityType === "service" ? "serviço" : "produto";

      toast.error(
        `Não foi possível ${actionLabel} o ${noun} ${productLabel}. Detalhes: ${errorMessage}`,
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
    maxImagesPerProduct,
    errors,
    setFieldError: setFieldError as (name: string, message: string) => void,
    handleChange,
    handleBlur,
    handleAddImage,
    handleRemoveImage,
    handlePricingModeChange,
    addHeightPricingTier,
    updateHeightPricingTier,
    removeHeightPricingTier,
    handleSubmit,
  };
}
