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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { SistemaSelector } from "@/components/features/automation";
import { AmbienteManagerDialog } from "@/components/features/automation/ambiente-manager-dialog";
import { SistemaManagerDialog } from "@/components/features/automation/sistema-manager-dialog";
import { SistemaTemplateDialog } from "@/components/features/automation/sistema-template-dialog";
import { ProposalSistema, Sistema } from "@/types/automation";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LimitReachedModal } from "@/components/ui/limit-reached-modal";
import {
  Save,
  ArrowLeft,
  Loader2,
  Package,
  Plus,
  Minus,
  User,
  Calendar,
  Percent,
  FileText,
  Cpu,
  Trash2,
  Settings,
  Pencil,
} from "lucide-react";

interface SimpleProposalFormProps {
  proposalId?: string;
}

export function SimpleProposalForm({ proposalId }: SimpleProposalFormProps) {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreateProposal, getProposalCount, features } = usePlanLimits();

  // Limit modal state
  const [showLimitModal, setShowLimitModal] = React.useState(false);
  const [currentProposalCount, setCurrentProposalCount] = React.useState(0);

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

  // Estado para sistemas de automação
  const [selectedSistemas, setSelectedSistemas] = React.useState<
    ProposalSistema[]
  >([]);
  // IDs dos produtos que vieram do template de sistema (não são extras)
  const [systemProductIds, setSystemProductIds] = React.useState<Set<string>>(
    new Set()
  );
  // Key para forçar reset do SistemaSelector após adicionar um sistema
  const [selectorKey, setSelectorKey] = React.useState(0);

  // Estados para gerenciamento de ambiente/sistema
  const [isAmbienteManagerOpen, setIsAmbienteManagerOpen] =
    React.useState(false);
  const [isSistemaManagerOpen, setIsSistemaManagerOpen] = React.useState(false);
  const [isSistemaTemplateOpen, setIsSistemaTemplateOpen] =
    React.useState(false);
  const [editingSistema, setEditingSistema] = React.useState<Sistema | null>(
    null
  );
  const [managerFilterAmbienteId, setManagerFilterAmbienteId] = React.useState<
    string | undefined
  >(undefined);
  const [openedFromManager, setOpenedFromManager] = React.useState(false);

  // Estado para edição de seleção (trocar sistema/ambiente de um item já adicionado)
  const [editingSelectionIndex, setEditingSelectionIndex] = React.useState<
    number | null
  >(null);

  // Cor primária do tenant
  const primaryColor = tenant?.primaryColor || "#2563eb";

  // Helper para calcular cor de texto com contraste
  const getContrastTextColor = (hexColor: string): string => {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#1f2937" : "#ffffff";
  };

  // Verificar se é nicho de automação
  const isAutomacaoNiche = tenant?.niche === "automacao_residencial";

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

            // Carregar sistemas salvos (para nicho automação)
            if (proposal.sistemas && proposal.sistemas.length > 0) {
              const sistemas: ProposalSistema[] = proposal.sistemas.map(
                (s: any) => ({
                  sistemaId: s.sistemaId,
                  sistemaName: s.sistemaName,
                  ambienteId: s.ambienteId,
                  ambienteName: s.ambienteName,
                  description: s.description,
                  products: (proposal.products || [])
                    .filter((p: any) => s.productIds?.includes(p.productId))
                    .map((p: any) => ({
                      productId: p.productId,
                      productName: p.productName,
                      quantity: p.quantity,
                    })),
                })
              );
              setSelectedSistemas(sistemas);

              // Marcar produtos do sistema
              const sysProductIds = new Set(
                proposal.sistemas.flatMap((s: any) => s.productIds || [])
              );
              setSystemProductIds(sysProductIds);
            }
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

  // Separar produtos do sistema vs extras
  const sistemaProductIds = new Set(
    selectedSistemas.flatMap((s) => s.products.map((p) => p.productId))
  );
  // Filter out products that have instance ID (New System) OR are in claimed IDs set (Legacy System)
  const extraProducts = selectedProducts.filter(
    (p) => !p.systemInstanceId && !sistemaProductIds.has(p.productId)
  );

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

  const updateProductQuantity = (
    productId: string,
    delta: number,
    systemInstanceId?: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      products: selectedProducts.map((p) => {
        // If systemInstanceId is provided, strict match on it
        if (
          systemInstanceId &&
          p.systemInstanceId === systemInstanceId &&
          p.productId === productId
        ) {
          const newQty = Math.max(1, p.quantity + delta);
          return { ...p, quantity: newQty, total: newQty * p.unitPrice };
        }
        // Legacy/compatibility: if no systemInstanceId provided in call (e.g. extras), match by ID only if the product ALSO has no systemInstanceId
        else if (
          !systemInstanceId &&
          !p.systemInstanceId &&
          p.productId === productId
        ) {
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

    // Check proposal limit only for NEW proposals (not edits)
    if (!proposalId) {
      const canCreate = await canCreateProposal();
      if (!canCreate) {
        const count = await getProposalCount();
        setCurrentProposalCount(count);
        setShowLimitModal(true);
        return;
      }
    }

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
          sistemas:
            selectedSistemas.length > 0
              ? selectedSistemas.map((s) => ({
                  sistemaId: s.sistemaId,
                  sistemaName: s.sistemaName,
                  ambienteId: s.ambienteId,
                  ambienteName: s.ambienteName,
                  description: s.description,
                  productIds: s.products.map((p) => p.productId),
                }))
              : undefined,
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
          // Salvar sistemas de automação
          sistemas:
            selectedSistemas.length > 0
              ? selectedSistemas.map((s) => ({
                  sistemaId: s.sistemaId,
                  sistemaName: s.sistemaName,
                  ambienteId: s.ambienteId,
                  ambienteName: s.ambienteName,
                  description: s.description,
                  productIds: s.products.map((p) => p.productId),
                }))
              : undefined,
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
        {/* Automation - Múltiplos Sistemas (only for automacao_residencial niche) */}
        {isAutomacaoNiche && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-5 h-5" />
                Sistemas de Automação
              </CardTitle>
              <CardDescription>
                Adicione um ou mais sistemas de automação à proposta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lista de sistemas já adicionados */}
              {selectedSistemas.length > 0 && (
                <div className="space-y-4">
                  {selectedSistemas.map((sistema, sistemaIndex) => {
                    const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
                    // Filter matching instance
                    const sistemaProducts = selectedProducts.filter(
                      (p) => p.systemInstanceId === systemInstanceId
                    );
                    const sistemaTotal = sistemaProducts.reduce(
                      (sum, p) => sum + p.total,
                      0
                    );

                    return (
                      <div
                        key={`${sistema.sistemaId}-${sistema.ambienteId}`}
                        className="rounded-lg overflow-hidden shadow-sm"
                        style={{
                          border: `2px solid ${primaryColor}`,
                          backgroundColor: `${primaryColor}08`,
                        }}
                      >
                        {/* Header do Sistema */}
                        <div
                          className="p-4 flex items-center justify-between"
                          style={{ backgroundColor: `${primaryColor}15` }}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <Cpu className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-xs font-medium uppercase tracking-wide px-2 py-0.5 rounded flex-shrink-0"
                                  style={{
                                    backgroundColor: primaryColor,
                                    color: getContrastTextColor(primaryColor),
                                  }}
                                >
                                  📍 {sistema.ambienteName}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-lg text-foreground truncate">
                                  {sistema.sistemaName}
                                </h4>
                              </div>
                              {sistema.description && (
                                <p className="mt-1 text-sm text-foreground leading-relaxed break-words">
                                  {sistema.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                            <span
                              className="font-bold text-lg"
                              style={{ color: primaryColor }}
                            >
                              R$ {sistemaTotal.toFixed(2)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() =>
                                setEditingSelectionIndex(sistemaIndex)
                              }
                              title="Trocar Sistema/Ambiente"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                // Remover sistema e seus produtos por instanceId
                                setSelectedSistemas((prev) =>
                                  prev.filter((_, i) => i !== sistemaIndex)
                                );
                                setFormData((prev) => ({
                                  ...prev,
                                  products: (prev.products || []).filter(
                                    (p) =>
                                      p.systemInstanceId !== systemInstanceId
                                  ),
                                }));
                                // We don't need to maintain systemProductIds for this logic anymore, but we can clean up if needed
                                // Assuming we move away from strict set
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Produtos do Sistema */}
                        <div className="p-4 space-y-2 bg-background">
                          {sistemaProducts.length > 0 ? (
                            sistemaProducts.map((product, idx) => (
                              <div
                                key={`${product.productId}-${idx}`} // Use index + ID as fallback, but ID should be unique within instance
                                className={`flex items-center justify-between p-3 rounded-lg border ${product.isExtra ? "bg-blue-50/50 border-blue-100" : "bg-muted/30"}`}
                              >
                                <div className="flex items-center gap-3">
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h5 className="font-medium text-sm">
                                        {product.productName}
                                      </h5>
                                      {product.isExtra && (
                                        <Badge
                                          variant="default"
                                          className="text-[10px] h-5 px-1 bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200"
                                        >
                                          Extra
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      R$ {product.unitPrice.toFixed(2)} x{" "}
                                      {product.quantity}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      updateProductQuantity(
                                        product.productId,
                                        -1,
                                        systemInstanceId
                                      )
                                    }
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="font-bold w-6 text-center text-sm">
                                    {product.quantity}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() =>
                                      updateProductQuantity(
                                        product.productId,
                                        1,
                                        systemInstanceId
                                      )
                                    }
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                  <span className="font-semibold text-sm ml-2">
                                    R$ {product.total.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              Nenhum produto neste sistema
                            </p>
                          )}

                          {/* Adicionar Produto Extra ao Sistema */}
                          <div
                            className="mt-4 p-4 rounded-lg"
                            style={{
                              backgroundColor: `${primaryColor}08`,
                              border: `2px dashed ${primaryColor}40`,
                            }}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <Plus
                                className="w-4 h-4"
                                style={{ color: primaryColor }}
                              />
                              <span
                                className="text-sm font-semibold"
                                style={{ color: primaryColor }}
                              >
                                Adicionar Produto Extra a este Sistema
                              </span>
                            </div>
                            {products.filter(
                              (p) =>
                                !sistemaProducts.some(
                                  (sp) => sp.productId === p.id
                                )
                            ).length === 0 ? (
                              <p className="text-sm text-muted-foreground italic text-center py-2">
                                Todos os produtos disponíveis já foram
                                adicionados a este sistema.
                              </p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {products
                                  .filter(
                                    (p) =>
                                      !sistemaProducts.some(
                                        (sp) => sp.productId === p.id
                                      )
                                  ) // Only exclude what is ALREADY in this instance
                                  .slice(0, 9)
                                  .map((product) => (
                                    <button
                                      key={product.id}
                                      type="button"
                                      className="flex items-center gap-2 p-2 text-left rounded-lg border bg-background hover:border-primary hover:shadow-sm transition-all"
                                      onClick={() => {
                                        const price = parseFloat(product.price);
                                        const newProduct: ProposalProduct = {
                                          productId: product.id,
                                          productName: product.name,
                                          productImage:
                                            product.images?.[0] ||
                                            product.image ||
                                            "",
                                          productImages: product.images || [],
                                          productDescription:
                                            product.description || "",
                                          quantity: 1,
                                          unitPrice: price,
                                          total: price,
                                          manufacturer: product.manufacturer,
                                          category: product.category,
                                          systemInstanceId: systemInstanceId, // TAG IT
                                          isExtra: true,
                                        };

                                        setSelectedSistemas((prev) =>
                                          prev.map((s, i) => {
                                            if (i === sistemaIndex) {
                                              return {
                                                ...s,
                                                products: [
                                                  ...s.products,
                                                  {
                                                    productId: product.id,
                                                    productName: product.name,
                                                    quantity: 1,
                                                  },
                                                ],
                                              };
                                            }
                                            return s;
                                          })
                                        );

                                        setFormData((prev) => ({
                                          ...prev,
                                          products: [
                                            ...(prev.products || []),
                                            newProduct,
                                          ],
                                        }));

                                        // Legacy set update - beneficial for global extra logic
                                        setSystemProductIds(
                                          (prev) =>
                                            new Set([...prev, product.id])
                                        );
                                      }}
                                    >
                                      <Plus className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium truncate">
                                          {product.name}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                          R${" "}
                                          {parseFloat(product.price).toFixed(2)}
                                        </p>
                                      </div>
                                    </button>
                                  ))}
                              </div>
                            )}
                            {/* Simplified logic for counters relying on checking logic presence */}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Adicionar novo sistema */}
              <div className="border-2 border-dashed rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-3 text-center">
                  {selectedSistemas.length === 0
                    ? "Selecione o primeiro sistema para esta proposta"
                    : "+ Adicionar outro sistema"}
                </p>
                <SistemaSelector
                  key={selectorKey}
                  value={null}
                  onChange={(sistema) => {
                    if (sistema) {
                      // Check for duplicates BEFORE updating state
                      const exists = selectedSistemas.some(
                        (s) =>
                          s.sistemaId === sistema.sistemaId &&
                          s.ambienteId === sistema.ambienteId
                      );

                      if (exists) {
                        alert("Este sistema já foi adicionado a esta proposta");
                        setSelectorKey((prev) => prev + 1); // Reset selector even on duplicate
                        return;
                      }

                      // Adicionar novo sistema
                      setSelectedSistemas((prev) => [...prev, sistema]);

                      // Adicionar produtos do sistema à proposta
                      const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;

                      const newProducts: ProposalProduct[] =
                        sistema.products.map((sp) => {
                          const existingProduct = products.find(
                            (p) => p.id === sp.productId
                          );
                          const price = existingProduct
                            ? parseFloat(existingProduct.price)
                            : 0;
                          return {
                            productId: sp.productId,
                            productName: sp.productName,
                            productImage:
                              existingProduct?.images?.[0] ||
                              existingProduct?.image ||
                              "",
                            productImages: existingProduct?.images || [],
                            productDescription:
                              existingProduct?.description || "",
                            quantity: sp.quantity,
                            unitPrice: price,
                            total: price * sp.quantity,
                            manufacturer: existingProduct?.manufacturer,
                            category: existingProduct?.category,
                            systemInstanceId: systemInstanceId, // Tag with instance ID
                          };
                        });

                      // Atualizar systemProductIds
                      setSystemProductIds((prev) => {
                        const newSet = new Set(prev);
                        sistema.products.forEach((sp) =>
                          newSet.add(sp.productId)
                        );
                        return newSet;
                      });

                      // Adicionar produtos ao formData (APPEND, allow duplicates if different instance)
                      setFormData((prev) => ({
                        ...prev,
                        products: [...(prev.products || []), ...newProducts],
                      }));

                      // Incrementar key para resetar o SistemaSelector
                      setSelectorKey((prev) => prev + 1);
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}
        {/* Produtos Extras */}{" "}
        {/* Produtos Extras - NÃO mostrar para nicho automação */}
        {!isAutomacaoNiche && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Produtos Extras (Avulsos)
              </CardTitle>
              <CardDescription>
                Selecione produtos que NÃO fazem parte dos sistemas acima
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
                  {products
                    .filter((product) => !systemProductIds.has(product.id)) // Não mostrar produtos que já estão no sistema
                    .map((product) => {
                      const selected = extraProducts.find(
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
                              <h4 className="font-medium mr-2">
                                {product.name}
                              </h4>
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
                                onClick={() =>
                                  updateProductQuantity(product.id, 1)
                                }
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
        )}
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
                    {/* Produtos agrupados por sistema */}
                    {isAutomacaoNiche &&
                      selectedSistemas.map((sistema, sistemaIdx) => {
                        const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
                        const sistemaProducts = selectedProducts.filter(
                          (p) => p.systemInstanceId === systemInstanceId
                        );
                        const sistemaTotal = sistemaProducts.reduce(
                          (sum, p) => sum + p.total,
                          0
                        );

                        if (sistemaProducts.length === 0) return null;

                        return (
                          <React.Fragment key={`sistema-${sistemaIdx}`}>
                            <tr
                              className="border-t"
                              style={{ backgroundColor: `${primaryColor}15` }}
                            >
                              <td
                                colSpan={4}
                                className="p-2 font-semibold text-sm"
                                style={{ color: primaryColor }}
                              >
                                📍 {sistema.ambienteName} →{" "}
                                {sistema.sistemaName}
                              </td>
                            </tr>
                            {sistemaProducts.map((product, idx) => (
                              <tr
                                key={`${product.productId}-${idx}`}
                                className="border-t"
                              >
                                <td className="p-3 font-medium pl-6">
                                  <div className="flex items-center gap-2">
                                    <span>{product.productName}</span>
                                    {product.isExtra && (
                                      <Badge
                                        variant="default"
                                        className="text-[10px] h-5 px-1 bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200"
                                      >
                                        Extra
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  {product.quantity}
                                </td>
                                <td className="p-3 text-right">
                                  R$ {product.unitPrice.toFixed(2)}
                                </td>
                                <td className="p-3 text-right font-medium">
                                  R$ {product.total.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-muted/30">
                              <td
                                colSpan={3}
                                className="p-2 text-right text-sm pl-6"
                              >
                                Subtotal do Sistema:
                              </td>
                              <td
                                className="p-2 text-right font-medium text-sm"
                                style={{ color: primaryColor }}
                              >
                                R$ {sistemaTotal.toFixed(2)}
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}

                    {/* Produtos extras (não pertencem a nenhum sistema) */}
                    {isAutomacaoNiche && extraProducts.length > 0 && (
                      <React.Fragment>
                        <tr className="border-t bg-gray-100">
                          <td
                            colSpan={4}
                            className="p-2 font-semibold text-sm text-gray-600"
                          >
                            📦 Produtos Extras (não vinculados a sistemas)
                          </td>
                        </tr>
                        {extraProducts.map((product) => (
                          <tr key={product.productId} className="border-t">
                            <td className="p-3 font-medium pl-6">
                              {product.productName}
                              <span className="ml-2 text-xs text-gray-400">
                                (Extra)
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {product.quantity}
                            </td>
                            <td className="p-3 text-right">
                              R$ {product.unitPrice.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-medium">
                              R$ {product.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )}

                    {/* Para nicho não-automação, mostrar todos os produtos normalmente */}
                    {!isAutomacaoNiche &&
                      selectedProducts.map((product) => (
                        <tr key={product.productId} className="border-t">
                          <td className="p-3 font-medium">
                            {product.productName}
                          </td>
                          <td className="p-3 text-center">
                            {product.quantity}
                          </td>
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

              {/* Dialog de Edição de Seleção */}
              <Dialog
                open={editingSelectionIndex !== null}
                onOpenChange={(open) => !open && setEditingSelectionIndex(null)}
              >
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Editar Seleção</DialogTitle>
                  </DialogHeader>
                  {editingSelectionIndex !== null &&
                    selectedSistemas[editingSelectionIndex] && (
                      <SistemaSelector
                        value={selectedSistemas[editingSelectionIndex]}
                        onChange={(newSistema) => {
                          if (newSistema) {
                            const oldSistema =
                              selectedSistemas[editingSelectionIndex];
                            const oldInstanceId = `${oldSistema.sistemaId}-${oldSistema.ambienteId}`;
                            const newInstanceId = `${newSistema.sistemaId}-${newSistema.ambienteId}`;

                            // Verificar duplicidade (exceto com ele mesmo)
                            const exists = selectedSistemas.some(
                              (s, idx) =>
                                idx !== editingSelectionIndex &&
                                s.sistemaId === newSistema.sistemaId &&
                                s.ambienteId === newSistema.ambienteId
                            );

                            if (exists) {
                              alert("Este sistema já existe na proposta.");
                              return;
                            }

                            // 1. Atualizar lista de sistemas
                            const newSelectedSistemas = [...selectedSistemas];
                            newSelectedSistemas[editingSelectionIndex] =
                              newSistema;
                            setSelectedSistemas(newSelectedSistemas);

                            // 2. Atualizar produtos
                            setFormData((prev) => {
                              const currentProducts = prev.products || [];

                              // Produtos que NÃO pertencem ao sistema antigo (mantém inalterados)
                              const otherProducts = currentProducts.filter(
                                (p) => p.systemInstanceId !== oldInstanceId
                              );

                              // Produtos extras do sistema antigo -> migrar para o novo ID
                              const migratedExtras = currentProducts
                                .filter(
                                  (p) =>
                                    p.systemInstanceId === oldInstanceId &&
                                    p.isExtra
                                )
                                .map((p) => ({
                                  ...p,
                                  systemInstanceId: newInstanceId,
                                }));

                              // Novos produtos padrão do sistema selecionado
                              const newStandardProducts =
                                newSistema.products.map((sp) => {
                                  const existingProduct = products.find(
                                    (p) => p.id === sp.productId
                                  );
                                  const price = existingProduct
                                    ? parseFloat(existingProduct.price)
                                    : 0;
                                  return {
                                    productId: sp.productId,
                                    productName: sp.productName,
                                    productImage:
                                      existingProduct?.images?.[0] ||
                                      existingProduct?.image ||
                                      "",
                                    productImages:
                                      existingProduct?.images || [],
                                    productDescription:
                                      existingProduct?.description || "",
                                    quantity: sp.quantity,
                                    unitPrice: price,
                                    total: price * sp.quantity,
                                    manufacturer: existingProduct?.manufacturer,
                                    category: existingProduct?.category,
                                    systemInstanceId: newInstanceId,
                                    isExtra: false,
                                  };
                                });

                              return {
                                ...prev,
                                products: [
                                  ...otherProducts,
                                  ...migratedExtras,
                                  ...newStandardProducts,
                                ],
                              };
                            });

                            setEditingSelectionIndex(null);
                          }
                        }}
                      />
                    )}
                </DialogContent>
              </Dialog>

              {/* Dialogs de Gerenciamento */}
              <AmbienteManagerDialog
                isOpen={isAmbienteManagerOpen}
                onClose={() => setIsAmbienteManagerOpen(false)}
                onAmbientesChange={() => {
                  // Forçar atualização do seletor incrementando a key
                  setSelectorKey((prev) => prev + 1);
                }}
              />

              <SistemaManagerDialog
                isOpen={isSistemaManagerOpen}
                onClose={() => setIsSistemaManagerOpen(false)}
                filterAmbienteId={managerFilterAmbienteId}
                onSistemasChange={() => {
                  // Forçar atualização do seletor
                  setSelectorKey((prev) => prev + 1);
                }}
                onEditSistema={(sistema) => {
                  setEditingSistema(sistema);
                  setOpenedFromManager(true);
                  setIsSistemaTemplateOpen(true);
                }}
                onCreateNew={() => {
                  setEditingSistema(null);
                  setOpenedFromManager(true);
                  setIsSistemaTemplateOpen(true);
                }}
              />

              <SistemaTemplateDialog
                isOpen={isSistemaTemplateOpen}
                onClose={() => {
                  setIsSistemaTemplateOpen(false);
                  setOpenedFromManager(false);
                }}
                editingSistema={editingSistema}
                preselectedAmbienteId={managerFilterAmbienteId || ""}
                onSave={() => {
                  // Forçar atualização do seletor
                  setSelectorKey((prev) => prev + 1);
                  // Se veio do manager, recarregar o manager (ele faz isso sozinho ao abrir, mas podemos forçar se precisar)
                }}
                onBack={
                  openedFromManager
                    ? () => setIsSistemaManagerOpen(true)
                    : undefined
                }
              />

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

      {/* Limit Reached Modal */}
      <LimitReachedModal
        open={showLimitModal}
        onOpenChange={setShowLimitModal}
        resourceType="proposals"
        currentCount={currentProposalCount}
        maxLimit={features?.maxProposals || 0}
      />
    </div>
  );
}
