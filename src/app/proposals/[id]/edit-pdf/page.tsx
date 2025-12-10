"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MockDB, Proposal, ProposalTemplate } from "@/lib/mock-db";
import { useTenant } from "@/providers/tenant-provider";
import {
  PdfSectionEditor,
  PdfSection,
  createDefaultSections,
} from "@/components/features/proposal/pdf-section-editor";
import { RenderPagedContent } from "@/components/pdf/render-paged-content";
import { ProposalPdfViewer } from "@/components/pdf/proposal-pdf-viewer";
import {
  ArrowLeft,
  FileDown,
  Save,
  Loader2,
  Palette,
  ZoomIn,
  ZoomOut,
  Layout,
  FileText,
  Upload,
  X,
} from "lucide-react";

const fontOptions = [
  { value: "'Inter', sans-serif", label: "Inter (Moderna)" },
  { value: "'Playfair Display', serif", label: "Playfair Display (Elegante)" },
  { value: "Georgia, serif", label: "Georgia (Clássica)" },
  { value: "'Roboto', sans-serif", label: "Roboto (Clean)" },
  { value: "'Lato', sans-serif", label: "Lato (Profissional)" },
  { value: "'Montserrat', sans-serif", label: "Montserrat (Moderna)" },
];

const themeOptions = [
  {
    value: "modern",
    label: "Moderno",
    description: "Gradientes vibrantes",
    preview: "bg-gradient-to-br from-blue-600 to-blue-800",
    defaultColor: "#2563eb",
  },
  {
    value: "classic",
    label: "Clássico",
    description: "Elegante e formal",
    preview: "bg-white border-2",
    defaultColor: "#334155",
  },
  {
    value: "minimal",
    label: "Minimalista",
    description: "Limpo e direto",
    preview: "bg-gray-50",
    defaultColor: "#0f172a",
  },
  {
    value: "tech",
    label: "Tech",
    description: "Futurista e dark",
    preview: "bg-gradient-to-b from-gray-900 to-gray-800",
    defaultColor: "#06b6d4",
  },
  {
    value: "elegant",
    label: "Elegante",
    description: "Premium dourado",
    preview: "bg-gradient-to-br from-gray-900 to-gray-700",
    defaultColor: "#D4AF37",
  },
  {
    value: "bold",
    label: "Impactante",
    description: "Cores vibrantes",
    preview: "bg-gradient-to-br from-purple-600 to-pink-600",
    defaultColor: "#9333ea",
  },
];

type ThemeType = "modern" | "classic" | "minimal" | "tech" | "elegant" | "bold";

export default function EditPdfPage() {
  const params = useParams();
  const router = useRouter();
  const { tenant } = useTenant();
  const proposalId = params.id as string;

  const [proposal, setProposal] = React.useState<Proposal | null>(null);
  const [template, setTemplate] = React.useState<ProposalTemplate | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Cover settings
  const [coverTitle, setCoverTitle] = React.useState("");
  const [coverImage, setCoverImage] = React.useState<string>("");
  const [coverLogo, setCoverLogo] = React.useState<string>("");
  const [coverImageOpacity, setCoverImageOpacity] = React.useState(30);
  const [coverImageFit, setCoverImageFit] = React.useState<"cover" | "contain">(
    "cover"
  );
  const [coverImagePosition, setCoverImagePosition] = React.useState("center");
  const [theme, setTheme] = React.useState<ThemeType>("modern");

  // Style settings
  const [primaryColor, setPrimaryColor] = React.useState("#2563eb");
  const [fontFamily, setFontFamily] = React.useState("'Inter', sans-serif");

  // Editable sections
  const [sections, setSections] = React.useState<PdfSection[]>([]);
  const [repeatHeader, setRepeatHeader] = React.useState(false);

  // Preview zoom
  const [previewZoom, setPreviewZoom] = React.useState(0.5);

  React.useEffect(() => {
    if (proposalId && tenant) {
      const p = MockDB.getProposalById(proposalId);
      if (p) {
        // Inject placeholders for missing images (for demo purposes)
        p.products = p.products.map((prod) => ({
          ...prod,
          productImage:
            prod.productImage ||
            "https://placehold.co/200x200/e2e8f0/64748b?text=Produto",
        }));

        setProposal(p);
        const t = p.templateId
          ? MockDB.getProposalTemplateById(p.templateId)
          : MockDB.initializeDefaultTemplate(
              tenant.id,
              tenant.name,
              tenant.primaryColor
            );

        if (t) {
          setTemplate(t);
          setCoverTitle(p.title || "");
          setPrimaryColor(t.primaryColor);
          setFontFamily(t.fontFamily);
          setTheme(t.theme as ThemeType);
          if (t.coverImage) setCoverImage(t.coverImage);
          if ((t as any).coverLogo) setCoverLogo((t as any).coverLogo);
          else if (tenant.logoUrl) setCoverLogo(tenant.logoUrl);

          if ((t as any).coverImageSettings) {
            const s = (t as any).coverImageSettings;
            if (s.opacity !== undefined) setCoverImageOpacity(s.opacity);
            if (s.fit) setCoverImageFit(s.fit);
            if (s.fit) setCoverImageFit(s.fit);
            if (s.position) setCoverImagePosition(s.position);
          }
          if ((t as any).repeatHeader !== undefined)
            setRepeatHeader((t as any).repeatHeader);

          // Create default sections from template
          setSections(createDefaultSections(t, t.primaryColor));
        }
      }
      setIsLoading(false);
    }
  }, [proposalId, tenant]);

  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCoverImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCoverLogo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!proposal || !template) return;
    setIsSaving(true);

    try {
      MockDB.updateProposalTemplate(template.id, {
        primaryColor,
        fontFamily,
        theme,
        coverImage,
        coverLogo,
        coverImageSettings: {
          opacity: coverImageOpacity,
          fit: coverImageFit,
          position: coverImagePosition,
        },
        repeatHeader,
      } as any);

      MockDB.updateProposal(proposal.id, {
        title: coverTitle,
      });

      await new Promise((r) => setTimeout(r, 300));
      alert("Alterações salvas!");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      // Select all specific page containers
      const pageElements = document.querySelectorAll(".pdf-page-container");
      if (!pageElements || pageElements.length === 0) {
        alert("Erro: Páginas não encontradas");
        return;
      }

      // Ensure fonts are loaded
      await document.fonts.ready;

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;

      // Create a temporary container for isolated rendering
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      container.style.width = "210mm";
      container.style.height = "297mm";
      document.body.appendChild(container);

      try {
        for (let i = 0; i < pageElements.length; i++) {
          const originalPage = pageElements[i] as HTMLElement;

          // Clone the page node
          const clonedPage = originalPage.cloneNode(true) as HTMLElement;

          // Reset any potential transforms/margins on the clone itself
          clonedPage.style.transform = "none";
          clonedPage.style.margin = "0";
          clonedPage.style.boxShadow = "none"; // Remove shadow for PDF

          // Clear container and append clone
          container.innerHTML = "";
          container.appendChild(clonedPage);

          // Capture the isolated clone
          const canvas = await html2canvas(clonedPage, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            width: container.offsetWidth, // Force A4 width in px
            height: container.offsetHeight, // Force A4 height in px
            windowWidth: container.offsetWidth,
            windowHeight: container.offsetHeight,
            onclone: (clonedDoc) => {
              // Fix unsupported colors in the cloned document context
              const allElements = clonedDoc.querySelectorAll("*");
              allElements.forEach((el) => {
                const element = el as HTMLElement;
                const cs = window.getComputedStyle(element);
                if (
                  cs.backgroundColor.includes("lab") ||
                  cs.backgroundColor.includes("oklab")
                ) {
                  element.style.backgroundColor = "#ffffff";
                }
                if (cs.color.includes("lab") || cs.color.includes("oklab")) {
                  element.style.color = "#000000";
                }
              });
            },
          });

          const imgData = canvas.toDataURL("image/jpeg", 0.95);

          if (i > 0) {
            pdf.addPage();
          }

          pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
        }
      } finally {
        // Clean up
        document.body.removeChild(container);
      }

      pdf.save(
        `proposta-${proposal?.title?.toLowerCase().replace(/\s+/g, "-") || "comercial"}.pdf`
      );
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  // Adjust color helper
  const adjustColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, Math.max(0, (num >> 16) + amt));
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
    const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
    return (
      "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
    );
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal || !template) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Proposta não encontrada</p>
        <Button variant="link" onClick={() => router.push("/proposals")}>
          Voltar para propostas
        </Button>
      </div>
    );
  }

  const products = proposal.products || [];
  const subtotal = products.reduce((sum, p) => sum + p.total, 0);
  const discountAmt = (subtotal * (proposal.discount || 0)) / 100;
  const total = subtotal - discountAmt;

  // Theme-based content styles
  const getContentStyles = () => {
    const base = {
      container: {
        backgroundColor: "#ffffff",
        color: "#1f2937",
        padding: "48px",
        position: "relative" as const,
        overflow: "hidden" as const,
      },
      headerBorder: { borderColor: primaryColor },
      headerTitle: { color: primaryColor },
      headerSub: { color: "#4b5563" },
      sectionText: { color: "#374151" },
      productTitle: { borderColor: primaryColor, color: primaryColor },
      productCard: {
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        color: "#1f2937",
      },
      productCardAlt: {
        backgroundColor: "#f9fafb",
        borderColor: "#e5e7eb",
        color: "#1f2937",
      },
      productSub: { color: "#6b7280" },
      total: { color: primaryColor },
    };

    // For content, we want to keep readability high (mostly white backgrounds),
    // but we can adjust some borders/text if needed for specific themes.
    switch (theme) {
      case "tech":
        return {
          ...base,
          // Tech keeps white background for readability but adds tech decorations
          headerSub: { color: "#6b7280" },
          productCard: {
            backgroundColor: "#ffffff",
            borderColor: primaryColor, // tech border
            color: "#1f2937",
          },
          productCardAlt: {
            backgroundColor: "#f3f4f6", // slight gray
            borderColor: primaryColor,
            color: "#1f2937",
          },
        };
      case "elegant":
        return {
          ...base,
          headerBorder: { borderColor: primaryColor },
          headerTitle: { color: primaryColor },
          productTitle: { borderColor: primaryColor, color: primaryColor },
          total: { color: primaryColor },
          productCard: {
            backgroundColor: "#ffffff",
            borderColor: primaryColor,
            color: "#1f2937",
          },
          productCardAlt: {
            backgroundColor: "#fafaf9",
            borderColor: primaryColor,
            color: "#1f2937",
          },
        };
      case "bold":
        return {
          ...base,
          container: {
            backgroundColor: primaryColor,
            color: "#ffffff",
            padding: "48px",
            position: "relative" as const,
            overflow: "hidden" as const,
          },
          headerBorder: { borderColor: "#ffffff" },
          headerTitle: { color: "#ffffff" },
          headerSub: { color: "rgba(255,255,255,0.8)" },
          sectionText: { color: "#ffffff" },
          productTitle: { borderColor: "#ffffff", color: "#ffffff" },
          productCard: {
            backgroundColor: "rgba(255,255,255,0.1)",
            borderColor: "rgba(255,255,255,0.2)",
            color: "#ffffff",
          },
          productCardAlt: {
            backgroundColor: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.1)",
            color: "#ffffff",
          },
          productSub: { color: "rgba(255,255,255,0.7)" },
          total: { color: "#ffffff" },
        };
      case "minimal":
        return base;
      default:
        return base;
    }
  };

  const contentStyles = getContentStyles();

  const renderThemeDecorations = () => {
    switch (theme) {
      case "modern":
        return (
          <>
            <div
              className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-100/50 to-transparent rounded-bl-full pointer-events-none"
              style={
                {
                  "--tw-gradient-from": `${primaryColor}20`,
                } as React.CSSProperties
              }
            />
            <div
              className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-100/50 to-transparent rounded-tr-full pointer-events-none"
              style={
                {
                  "--tw-gradient-from": `${primaryColor}20`,
                } as React.CSSProperties
              }
            />
          </>
        );
      case "tech":
        return (
          <>
            <div
              className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"
              style={
                {
                  "--tw-gradient-via": `${primaryColor}80`,
                } as React.CSSProperties
              }
            />
            <div
              className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 pointer-events-none"
              style={{ borderColor: primaryColor }}
            />
            <div
              className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 pointer-events-none"
              style={{ borderColor: primaryColor }}
            />
            <div
              className="absolute top-12 right-4 w-2 h-2 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
            <div
              className="absolute bottom-12 left-4 w-2 h-2 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
          </>
        );
      case "elegant":
        return (
          <>
            <div
              className="absolute inset-6 border pointer-events-none"
              style={{ borderColor: primaryColor, opacity: 0.3 }}
            />
            <div
              className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 pointer-events-none"
              style={{ borderColor: primaryColor }}
            />
            <div
              className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 pointer-events-none"
              style={{ borderColor: primaryColor }}
            />
            <div
              className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 pointer-events-none"
              style={{ borderColor: primaryColor }}
            />
            <div
              className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 pointer-events-none"
              style={{ borderColor: primaryColor }}
            />
          </>
        );
      case "bold":
        return (
          <>
            <div
              className="absolute left-0 top-0 bottom-0 w-4"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-bl-full -z-10 opacity-10" />
          </>
        );
      case "classic":
        return (
          <div
            className="absolute inset-8 border pointer-events-none"
            style={{
              borderColor: primaryColor,
              opacity: 0.1,
              borderWidth: "1px",
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/proposals/${proposalId}/view`)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Editor de PDF</h1>
            <p className="text-muted-foreground text-sm">
              Personalize completamente sua proposta
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </Button>
          <Button
            onClick={handleGeneratePdf}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Baixar PDF
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div className="space-y-4">
          <Tabs defaultValue="content">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="cover" className="gap-1">
                <Layout className="w-4 h-4" />
                Capa
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-1">
                <FileText className="w-4 h-4" />
                Conteúdo
              </TabsTrigger>
              <TabsTrigger value="style" className="gap-1">
                <Palette className="w-4 h-4" />
                Estilo
              </TabsTrigger>
            </TabsList>

            {/* Cover Tab */}
            <TabsContent value="cover" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Capa da Proposta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Título Principal</Label>
                    <Input
                      value={coverTitle}
                      onChange={(e) => setCoverTitle(e.target.value)}
                      placeholder="Título da proposta"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Imagem de Capa (aparece como fundo)</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {coverImage ? (
                        <div className="space-y-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverImage}
                            alt="Capa"
                            className="max-h-64 mx-auto rounded shadow-sm object-cover"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setCoverImage("")}
                          >
                            Remover
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer block py-4">
                          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Clique para upload
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleCoverImageUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Logo da Capa</Label>
                    <div className="flex items-center gap-4">
                      {coverLogo ? (
                        <div className="relative border rounded p-2 bg-muted/20">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={coverLogo}
                            alt="Logo"
                            className="h-10 object-contain"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => setCoverLogo("")}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">
                          Sem logo selecionada
                        </div>
                      )}
                      <label className="cursor-pointer">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          asChild
                        >
                          <span>
                            <Upload className="w-4 h-4" />
                            Upload Logo
                          </span>
                        </Button>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleLogoUpload}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-4 p-4 border rounded-lg bg-muted/10">
                    <Label className="font-semibold">
                      Ajustes da Imagem de Fundo
                    </Label>

                    <div className="grid gap-2">
                      <div className="flex justify-between">
                        <Label className="text-xs">
                          Opacidade ({coverImageOpacity}%)
                        </Label>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={coverImageOpacity}
                        onChange={(e) =>
                          setCoverImageOpacity(parseInt(e.target.value))
                        }
                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className="text-xs">Ajuste</Label>
                        <Select
                          value={coverImageFit}
                          onChange={(e) =>
                            setCoverImageFit(e.target.value as any)
                          }
                        >
                          <option value="cover">Preencher (Cover)</option>
                          <option value="contain">Conter (Contain)</option>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs">Posição</Label>
                        <Select
                          value={coverImagePosition}
                          onChange={(e) =>
                            setCoverImagePosition(e.target.value)
                          }
                        >
                          <option value="top">Topo</option>
                          <option value="center">Centro</option>
                          <option value="bottom">Base</option>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Tema da Capa</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {themeOptions.map((t) => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => {
                            setTheme(t.value as ThemeType);
                            // Set default color if available
                            if ((t as any).defaultColor) {
                              setPrimaryColor((t as any).defaultColor);
                            }
                            // Reset section colors to ensure theme application
                            // We keep other styles (bold, size, etc), just reset color properties
                            setSections((prev) =>
                              prev.map((s) => ({
                                ...s,
                                styles: {
                                  ...s.styles,
                                  color: undefined, // Reset text color to inherit theme
                                  backgroundColor:
                                    s.styles.backgroundColor === "#ffffff" ||
                                    s.styles.backgroundColor === "#f9fafb"
                                      ? undefined
                                      : s.styles.backgroundColor, // Reset bg only if it was default white/gray
                                },
                              }))
                            );
                          }}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            theme === t.value
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div
                            className={`w-full h-8 rounded mb-2 ${t.preview}`}
                            style={
                              t.value === "classic"
                                ? { borderColor: primaryColor }
                                : undefined
                            }
                          />
                          <div className="font-medium text-sm">{t.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Seções do Documento</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Adicione, remova e personalize as seções
                  </p>
                </CardHeader>
                <CardContent>
                  <PdfSectionEditor
                    sections={sections}
                    onChange={setSections}
                    primaryColor={primaryColor}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cores e Fontes Globais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Cor Principal</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => {
                          const newColor = e.target.value;
                          setPrimaryColor(newColor);
                          setSections((prev) =>
                            prev.map((s) => ({
                              ...s,
                              styles: {
                                ...s.styles,
                                color: undefined, // Reset to inherit new global color
                              },
                            }))
                          );
                        }}
                        className="w-14 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => {
                          const newColor = e.target.value;
                          setPrimaryColor(newColor);
                          setSections((prev) =>
                            prev.map((s) => ({
                              ...s,
                              styles: {
                                ...s.styles,
                                color: undefined, // Reset to inherit new global color
                              },
                            }))
                          );
                        }}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Fonte Principal</Label>
                    <Select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                    >
                      {fontOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="repeat-header-style"
                      checked={repeatHeader}
                      onCheckedChange={setRepeatHeader}
                    />
                    <Label htmlFor="repeat-header-style">
                      Repetir cabeçalho em todas as páginas
                    </Label>
                  </div>
                  <div
                    className="p-4 rounded-lg bg-muted"
                    style={{ fontFamily }}
                  >
                    <div
                      className="text-lg font-bold mb-2"
                      style={{ color: primaryColor }}
                    >
                      Prévia do Estilo
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Este é um exemplo de como o texto aparecerá.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview Panel */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Preview em tempo real
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setPreviewZoom((z) => Math.max(0.2, z - 0.1))
                    }
                    title="Diminuir zoom"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-12 text-center">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPreviewZoom((z) => Math.min(1, z + 0.1))}
                    title="Aumentar zoom"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-lg">
              <div className="max-h-[75vh] overflow-auto bg-gray-200 p-4">
                <div
                  id="pdf-preview-content"
                  className="w-[210mm] mx-auto shadow-2xl origin-top transition-transform"
                  style={{
                    transform: `scale(${previewZoom})`,
                    marginBottom: `${-100 + previewZoom * 100}%`,
                    fontFamily,
                  }}
                >
                  <ProposalPdfViewer
                    proposal={proposal}
                    tenant={tenant}
                    customSettings={{
                      theme,
                      primaryColor,
                      fontFamily,
                      coverTitle,
                      coverImage,
                      coverLogo,
                      coverImageOpacity,
                      coverImageFit,
                      coverImagePosition: coverImagePosition as any,
                      sections,
                      repeatHeader,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
