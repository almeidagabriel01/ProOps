"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProposalTemplate } from "@/types";
import { ProposalDefaults } from "@/lib/proposal-defaults";
import {
  ProposalService,
  Proposal,
  ProposalProduct,
} from "@/services/proposal-service";
import { ProposalStatus } from "@/types";
import { ProductService, Product } from "@/services/product-service";
import { ProposalTemplateService } from "@/services/proposal-template-service";
import { ClientService } from "@/services/client-service";
import { ClientSelect } from "@/components/features/client-select";
import { useTenant } from "@/providers/tenant-provider";
import {
  Save,
  ArrowLeft,
  Loader2,
  Package,
  Plus,
  Minus, // ...
  User,
  Calendar,
  Percent,
  FileText,
} from "lucide-react";

interface SimpleProposalFormProps {
  proposalId?: string;
}

export function SimpleProposalForm({ proposalId }: SimpleProposalFormProps) {
  const router = useRouter();
  const { tenant } = useTenant();
  const [isLoading, setIsLoading] = React.useState(!!proposalId);
  const [isSaving, setIsSaving] = React.useState(false);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [template, setTemplate] = React.useState<ProposalTemplate | null>(null);
  const [selectedClientId, setSelectedClientId] = React.useState<
    string | undefined
  >(undefined);
  const [isNewClient, setIsNewClient] = React.useState(true);

  const [formData, setFormData] = React.useState<Partial<Proposal>>({
    title: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    validUntil: "",
    customNotes: "",
    discount: 0,
    products: [],
  });

  // Load products and template
  React.useEffect(() => {
    const fetchInitialData = async () => {
      if (tenant) {
        try {
          const loadedProducts = await ProductService.getProducts(tenant.id);
          // Filter out inactive products
          const activeProducts = loadedProducts.filter(
            (p) => p.status !== "inactive"
          );
          setProducts(activeProducts);

          // Use new helper instead of MockDB
          const load = async () => {
            if (!tenant) return;
            try {
              const templates = await ProposalTemplateService.getTemplates(
                tenant.id
              );
              const defaultTemplate =
                templates.find((t) => t.isDefault) || templates[0];
              setTemplate(defaultTemplate || null);
            } catch (error) {
              console.error("Failed to load template", error);
            }
          };
          load();
        } catch (error) {
          console.error("Error loading products", error);
        }
      }
    };
    fetchInitialData();
  }, [tenant]);

  // Load existing proposal if editing
  React.useEffect(() => {
    const fetchProposal = async () => {
      if (proposalId) {
        try {
          const proposal = await ProposalService.getProposalById(proposalId);
          if (proposal) {
            setFormData({
              title: proposal.title,
              clientName: proposal.clientName,
              clientEmail: proposal.clientEmail,
              clientPhone: proposal.clientPhone,
              clientAddress: proposal.clientAddress,
              validUntil: proposal.validUntil,
              customNotes: proposal.customNotes,
              discount: proposal.discount || 0,
              products: proposal.products || [],
            });
          }
        } catch (error) {
          console.error("Error loading proposal", error);
        }
        setIsLoading(false);
      }
    };
    fetchProposal();
  }, [proposalId]);

  const selectedProducts = formData.products || [];

  const toggleProduct = (product: Product) => {
    const existing = selectedProducts.find((p) => p.productId === product.id);
    if (existing) {
      setFormData((prev) => ({
        ...prev,
        products: selectedProducts.filter((p) => p.productId !== product.id),
      }));
    } else {
      const price = parseFloat(product.price) || 0;
      const newProduct: ProposalProduct = {
        productId: product.id,
        productName: product.name,
        productImage: product.images?.[0] || product.image || "",
        productImages: product.images?.length
          ? product.images
          : product.image
            ? [product.image]
            : [],
        productDescription: product.description || "",
        quantity: 1,
        unitPrice: price,
        total: price,
        manufacturer: product.manufacturer,
        category: product.category,
      };
      setFormData((prev) => ({
        ...prev,
        products: [...selectedProducts, newProduct],
      }));
    }
  };

  const updateProductQuantity = (productId: string, delta: number) => {
    setFormData((prev) => ({
      ...prev,
      products: selectedProducts.map((p) => {
        if (p.productId === productId) {
          const newQty = Math.max(1, p.quantity + delta);
          return { ...p, quantity: newQty, total: newQty * p.unitPrice };
        }
        return p;
      }),
    }));
  };

  const calculateSubtotal = () => {
    return selectedProducts.reduce((sum, p) => sum + p.total, 0);
  };

  const calculateDiscount = () => {
    return (calculateSubtotal() * (formData.discount || 0)) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "discount" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant) {
      alert("Erro: Nenhuma empresa selecionada!");
      return;
    }

    if (
      !formData.title ||
      !formData.clientName ||
      selectedProducts.length === 0
    ) {
      alert(
        "Preencha o título, nome do cliente e selecione pelo menos um produto!"
      );
      return;
    }

    setIsSaving(true);

    try {
      // Determine client ID - use existing if selected, or create new if needed
      let clientId: string | undefined = selectedClientId;

      if (!proposalId && isNewClient && formData.clientName) {
        // Only create client if it's a new one
        const { client } = await ClientService.findOrCreateClient(
          tenant.id,
          {
            name: formData.clientName,
            email: formData.clientEmail,
            phone: formData.clientPhone,
            address: formData.clientAddress,
          },
          "proposal"
        );
        clientId = client.id;
      }

      if (proposalId) {
        await ProposalService.updateProposal(proposalId, {
          ...formData, // types should match or be partial
          // templateId: template?.id, // templateId not in my simple Proposal type, but Firestore accepts extras
          products: selectedProducts,
          status: "draft",
        });
      } else {
        await ProposalService.createProposal({
          tenantId: tenant.id,
          title: formData.title!,
          clientId,
          clientName: formData.clientName!,
          clientEmail: formData.clientEmail,
          clientPhone: formData.clientPhone,
          clientAddress: formData.clientAddress,
          validUntil:
            formData.validUntil ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: "draft",
          // templateId: template?.id,
          products: selectedProducts,
          customNotes: formData.customNotes,
          discount: formData.discount,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
      router.push("/proposals");
    } catch (error) {
      console.error("Erro ao salvar proposta:", error);
      alert("Erro ao salvar proposta");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/proposals")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {proposalId ? "Editar Proposta" : "Nova Proposta"}
            </h1>
            <p className="text-muted-foreground text-sm">
              Preencha os dados e selecione os produtos
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Dados do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título da Proposta *</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Ex: Automação Residencial - Casa Silva"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Cliente *</Label>
                <ClientSelect
                  value={formData.clientName || ""}
                  clientId={selectedClientId}
                  onChange={(data) => {
                    setSelectedClientId(data.clientId);
                    setIsNewClient(data.isNew);
                    setFormData((prev) => ({
                      ...prev,
                      clientId: data.clientId,
                      clientName: data.clientName,
                      clientEmail: data.clientEmail || prev.clientEmail,
                      clientPhone: data.clientPhone || prev.clientPhone,
                      clientAddress: data.clientAddress || prev.clientAddress,
                    }));
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="clientEmail">Email</Label>
                <Input
                  id="clientEmail"
                  name="clientEmail"
                  type="email"
                  value={formData.clientEmail}
                  onChange={handleChange}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="clientPhone">Telefone</Label>
                <Input
                  id="clientPhone"
                  name="clientPhone"
                  value={formData.clientPhone}
                  onChange={handleChange}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="validUntil" className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Válida até
                </Label>
                <Input
                  id="validUntil"
                  name="validUntil"
                  type="date"
                  value={
                    formData.validUntil ? formData.validUntil.split("T")[0] : ""
                  }
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="clientAddress">Endereço</Label>
              <Input
                id="clientAddress"
                name="clientAddress"
                value={formData.clientAddress}
                onChange={handleChange}
                placeholder="Endereço completo"
              />
            </div>
          </CardContent>
        </Card>

        {/* Product Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Selecione os Produtos
            </CardTitle>
            <CardDescription>
              Clique para adicionar produtos à proposta
            </CardDescription>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum produto cadastrado</p>
                <Button
                  variant="link"
                  onClick={() => router.push("/products/new")}
                >
                  Cadastrar produtos
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {products.map((product) => {
                  const selected = selectedProducts.find(
                    (p) => p.productId === product.id
                  );
                  return (
                    <div
                      key={product.id}
                      className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => toggleProduct(product)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-col">
                          <h4 className="font-medium mr-2">{product.name}</h4>
                        </div>
                        <span className="text-sm font-bold text-primary whitespace-nowrap">
                          R$ {parseFloat(product.price).toFixed(2)}
                        </span>
                      </div>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {product.description}
                        </p>
                      )}

                      {selected && (
                        <div
                          className="flex items-center justify-center gap-2 mt-3 pt-3 border-t"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              updateProductQuantity(product.id, -1)
                            }
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="font-bold w-8 text-center">
                            {selected.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateProductQuantity(product.id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary & Notes */}
        {selectedProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Resumo da Proposta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selected Products Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Produto</th>
                      <th className="text-center p-3 w-20">Qtd</th>
                      <th className="text-right p-3 w-28">Unit.</th>
                      <th className="text-right p-3 w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProducts.map((product) => (
                      <tr key={product.productId} className="border-t">
                        <td className="p-3 font-medium">
                          {product.productName}
                        </td>
                        <td className="p-3 text-center">{product.quantity}</td>
                        <td className="p-3 text-right">
                          R$ {product.unitPrice.toFixed(2)}
                        </td>
                        <td className="p-3 text-right font-medium">
                          R$ {product.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50">
                    <tr className="border-t">
                      <td colSpan={3} className="p-3 text-right">
                        Subtotal:
                      </td>
                      <td className="p-3 text-right font-medium">
                        R$ {calculateSubtotal().toFixed(2)}
                      </td>
                    </tr>
                    {(formData.discount || 0) > 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-3 text-right text-destructive"
                        >
                          Desconto ({formData.discount}%):
                        </td>
                        <td className="p-3 text-right font-medium text-destructive">
                          - R$ {calculateDiscount().toFixed(2)}
                        </td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-primary">
                      <td
                        colSpan={3}
                        className="p-3 text-right text-lg font-bold"
                      >
                        Total:
                      </td>
                      <td className="p-3 text-right text-lg font-bold text-primary">
                        R$ {calculateTotal().toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Discount */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="discount">Desconto:</Label>
                </div>
                <Input
                  id="discount"
                  name="discount"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.discount || 0}
                  onChange={handleChange}
                  className="w-24"
                />
                <span className="text-muted-foreground">%</span>
              </div>

              {/* Custom Notes */}
              <div className="grid gap-2">
                <Label htmlFor="customNotes">Observações Adicionais</Label>
                <Textarea
                  id="customNotes"
                  name="customNotes"
                  value={formData.customNotes || ""}
                  onChange={handleChange}
                  placeholder="Notas ou condições especiais para esta proposta..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/proposals")}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSaving || selectedProducts.length === 0}
            className="gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Proposta
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
