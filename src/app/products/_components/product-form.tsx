"use client";

import { useRouter } from "next/navigation";
import { Product } from "@/services/product-service";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { useProductForm } from "../_hooks/useProductForm";
import {
  ProductInfoCard,
  PriceStockCard,
  ImagesCard,
  PublishCard,
} from "./form-cards";

interface ProductFormProps {
  initialData?: Product;
  productId?: string;
  isReadOnly?: boolean;
}

export function ProductForm({
  initialData,
  productId,
  isReadOnly = false,
}: ProductFormProps) {
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
    handleChange,
    handleAddImage,
    handleRemoveImage,
    handleSubmit,
  } = useProductForm(initialData, productId);

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <ProductInfoCard
              formData={formData}
              onChange={handleChange}
              isReadOnly={isReadOnly}
            />
            <PriceStockCard
              formData={formData}
              onChange={handleChange}
              isReadOnly={isReadOnly}
            />
          </div>

          {/* Right Column: Media and Actions */}
          <div className="space-y-6">
            <ImagesCard
              images={imageUrls}
              onAddImage={handleAddImage}
              onRemoveImage={handleRemoveImage}
              isReadOnly={isReadOnly}
            />
            <PublishCard
              formData={formData}
              onChange={handleChange}
              isSubmitting={isSubmitting}
              productId={productId}
              isReadOnly={isReadOnly}
              onCancel={() => router.back()}
            />
          </div>
        </div>
      </form>

      {/* Product Limit Reached Modal */}
      <LimitReachedModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        resourceType="products"
        currentCount={currentProductCount}
        maxLimit={maxProducts}
      />

      {/* Image Limit Upgrade Modal */}
      <UpgradeModal
        open={showImageLimitModal}
        onOpenChange={setShowImageLimitModal}
        feature="Mais imagens por produto"
        description={`Seu plano atual permite até ${maxImagesPerProduct} imagens por produto. Faça upgrade para adicionar mais imagens.`}
        requiredPlan="pro"
      />
    </>
  );
}
