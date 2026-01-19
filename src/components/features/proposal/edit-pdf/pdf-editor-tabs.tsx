import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layout, FileText, Palette, Crown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  PdfSectionEditor,
  PdfSection,
  CoverElement,
} from "@/components/features/proposal/pdf-section-editor";
import { PdfCoverTab } from "./pdf-cover-tab";
import { PdfStyleTab } from "./pdf-style-tab";
import { ThemeType } from "./pdf-theme-utils";

interface PdfEditorTabsProps {
  // Cover Tab Props
  coverTitle: string;
  setCoverTitle: (val: string) => void;
  coverImage: string;
  setCoverImage: (val: string) => void;
  coverLogo: string;
  setCoverLogo: (val: string) => void;
  logoStyle?: "original" | "rounded" | "circle";
  setLogoStyle?: (val: "original" | "rounded" | "circle") => void;
  coverImageOpacity: number;
  setCoverImageOpacity: (val: number) => void;
  coverImageFit: "cover" | "contain";
  setCoverImageFit: (val: "cover" | "contain") => void;
  coverImagePosition: string;
  setCoverImagePosition: (val: string) => void;
  theme: ThemeType;
  setTheme: (val: ThemeType) => void;

  // Style Tab Props
  primaryColor: string;
  setPrimaryColor: (val: string) => void;
  fontFamily: string;
  setFontFamily: (val: string) => void;
  repeatHeader: boolean;
  setRepeatHeader: (val: boolean) => void;

  // Content Tab Props
  sections: PdfSection[];
  setSections: React.Dispatch<React.SetStateAction<PdfSection[]>>;
  canEditPdfSections: boolean;

  // Cover Elements
  coverElements?: CoverElement[];
  setCoverElements?: (elements: CoverElement[]) => void;

  // Shared / Other
  premiumColor: string;
  maxPdfTemplates: number;
  setShowUpgradeModal: (val: boolean) => void;
  clientName?: string;
  tenantColor?: string; // Tenant's primary color
}

export function PdfEditorTabs({
  coverTitle,
  setCoverTitle,
  coverImage,
  setCoverImage,
  coverLogo,
  setCoverLogo,
  logoStyle,
  setLogoStyle,
  coverImageOpacity,
  setCoverImageOpacity,
  coverImageFit,
  setCoverImageFit,
  coverImagePosition,
  setCoverImagePosition,
  theme,
  setTheme,
  primaryColor,
  setPrimaryColor,
  fontFamily,
  setFontFamily,
  repeatHeader,
  setRepeatHeader,
  sections,
  setSections,
  canEditPdfSections,
  coverElements,
  setCoverElements,
  premiumColor,
  maxPdfTemplates,
  setShowUpgradeModal,
  clientName,
  tenantColor,
}: PdfEditorTabsProps) {
  return (
    <Tabs defaultValue="cover">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="cover" className="gap-1">
          <Layout className="w-4 h-4" />
          Capa
        </TabsTrigger>
        {canEditPdfSections ? (
          <TabsTrigger value="content" className="gap-1">
            <FileText className="w-4 h-4" />
            Conteúdo
          </TabsTrigger>
        ) : (
          <div
            onClick={() => setShowUpgradeModal(true)}
            className="flex items-center justify-center gap-1 cursor-pointer px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-muted"
            style={{ color: premiumColor }}
          >
            <Crown className="w-4 h-4" />
            Conteúdo
          </div>
        )}
        <TabsTrigger value="style" className="gap-1">
          <Palette className="w-4 h-4" />
          Estilo
        </TabsTrigger>
      </TabsList>

      {/* Cover Tab */}
      <TabsContent value="cover" className="space-y-4 mt-4">
        <PdfCoverTab
          coverTitle={coverTitle}
          setCoverTitle={setCoverTitle}
          coverImage={coverImage}
          setCoverImage={setCoverImage}
          coverLogo={coverLogo}
          setCoverLogo={setCoverLogo}
          logoStyle={logoStyle}
          setLogoStyle={setLogoStyle}
          coverImageOpacity={coverImageOpacity}
          setCoverImageOpacity={setCoverImageOpacity}
          coverImageFit={coverImageFit}
          setCoverImageFit={setCoverImageFit}
          coverImagePosition={coverImagePosition}
          setCoverImagePosition={setCoverImagePosition}
          theme={theme}
          setTheme={setTheme}
          setPrimaryColor={setPrimaryColor}
          setSections={setSections}
          premiumColor={premiumColor}
          maxPdfTemplates={maxPdfTemplates}
          setShowUpgradeModal={setShowUpgradeModal}
          coverElements={coverElements}
          setCoverElements={setCoverElements}
          primaryColor={primaryColor}
          canEditCoverElements={canEditPdfSections}
          clientName={clientName}
        />
      </TabsContent>

      {/* Content Tab */}
      <TabsContent value="content" className="space-y-4 mt-4">
        <Card className="relative">
          <CardHeader className="flex flex-row items-center gap-2">
            <CardTitle>Seções do Documento</CardTitle>
            {!canEditPdfSections && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: premiumColor, color: "white" }}
              >
                <Crown className="w-3 h-3" />
                Enterprise
              </div>
            )}
          </CardHeader>
          {canEditPdfSections ? (
            <>
              <p className="text-sm text-muted-foreground px-6 pb-2">
                Adicione, remova e personalize as seções
              </p>
              <CardContent>
                <PdfSectionEditor
                  sections={sections}
                  onChange={setSections}
                  primaryColor={primaryColor}
                />
              </CardContent>
            </>
          ) : (
            <CardContent>
              <button
                type="button"
                onClick={() => setShowUpgradeModal(true)}
                className="w-full py-8 px-4 border-2 border-dashed rounded-lg transition-all hover:opacity-100 opacity-80 flex flex-col items-center gap-3"
                style={{ borderColor: premiumColor }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: premiumColor }}
                >
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-semibold" style={{ color: premiumColor }}>
                    Funcionalidade Enterprise
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Personalize completamente as seções do seu PDF.
                    <br />
                    Clique para fazer upgrade.
                  </p>
                </div>
              </button>
            </CardContent>
          )}
        </Card>
      </TabsContent>

      {/* Style Tab */}
      <TabsContent value="style" className="space-y-4 mt-4">
        <PdfStyleTab
          primaryColor={primaryColor}
          setPrimaryColor={setPrimaryColor}
          fontFamily={fontFamily}
          setFontFamily={setFontFamily}
          repeatHeader={repeatHeader}
          setRepeatHeader={setRepeatHeader}
          setSections={setSections}
          tenantColor={tenantColor}
          theme={theme}
        />
      </TabsContent>
    </Tabs>
  );
}
