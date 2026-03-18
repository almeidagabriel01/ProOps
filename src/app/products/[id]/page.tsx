"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Product, ProductService } from "@/services/product-service";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Loader2, Package, AlertCircle } from "lucide-react";
import { FormContainer, FormHeader } from "@/components/ui/form-components";
import { ProductFormNew } from "../_components/product-form-new";
import { useCurrentNicheConfig } from "@/hooks/useCurrentNicheConfig";

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const nicheConfig = useCurrentNicheConfig();
  const {
    canEdit,
    canView,
    isLoading: permLoading,
  } = usePagePermission("products");

  useEffect(() => {
    if (!permLoading && !canView) {
      router.push("/products");
    }
  }, [permLoading, canView, router]);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await ProductService.getProductById(id);
        if (data) {
          setProduct(data);
        } else {
          setError("Produto não encontrado.");
        }
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar produto.");
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [id]);

  // Show loading while permissions/product loading OR while redirecting (no view permission)
  if (loading || permLoading || !canView) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Carregando produtos...
          </p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-1">
              {error || "Produto não encontrado"}
            </h2>
            <p className="text-muted-foreground text-sm">
              O produto solicitado não existe ou foi removido.
            </p>
          </div>
          <button
            onClick={() => router.push("/products")}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Voltar para Produtos
          </button>
        </div>
      </div>
    );
  }

  return (
    <FormContainer>
      <FormHeader
        title={
          canEdit
            ? nicheConfig.productCatalog.editTitle
            : nicheConfig.productCatalog.viewTitle
        }
        subtitle={
          canEdit
            ? `Atualize as informações de "${product.name}"`
            : `Detalhes do produto "${product.name}"`
        }
        icon={Package}
        onBack={() => router.push("/products")}
      />
      <ProductFormNew
        initialData={product}
        productId={id}
        isReadOnly={!canEdit}
      />
    </FormContainer>
  );
}
