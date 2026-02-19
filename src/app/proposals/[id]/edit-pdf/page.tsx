"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { ProposalPdfViewer } from "@/components/pdf/proposal-pdf-viewer";
import { ArrowLeft, Save, Loader2, ZoomIn, ZoomOut, FileDown } from "lucide-react";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { useEditPdfPage } from "@/components/features/proposal/edit-pdf/use-edit-pdf-page";
import { PdfEditorTabs } from "@/components/features/proposal/edit-pdf/pdf-editor-tabs";
import { lightenColor } from "@/components/features/proposal/edit-pdf/pdf-theme-utils";
import { SaveConfirmationModal } from "@/components/features/proposal/edit-pdf/save-confirmation-modal";

export default function EditPdfPage() {
  // Modal states
  const [showSaveModal, setShowSaveModal] = React.useState(false);
  const [showSaveDefaultModal, setShowSaveDefaultModal] = React.useState(false);
  const {
    proposal,
    template,
    tenant,
    isLoading,
    isPlanLoading,
    canAccessPage,
    isSaving,
    isGenerating,
    showUpgradeModal,
    setShowUpgradeModal,

    // Cover
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

    // Theme
    theme,
    setTheme,
    primaryColor,
    setPrimaryColor,
    fontFamily,
    setFontFamily,

    // Sections
    sections,
    setSections,
    repeatHeader,
    setRepeatHeader,
    canEditPdfSections,
    maxPdfTemplates,

    // Cover Elements
    coverElements,
    setCoverElements,

    // Preview
    previewZoom,
    setPreviewZoom,

    // Actions
    handleSave,
    handleGeneratePdf,
    handleSaveDefault,
    isSavingDefault,
  } = useEditPdfPage();

  const router = useRouter();

  // Premium color based on tenant theme
  const premiumColor = tenant?.primaryColor
    ? lightenColor(tenant.primaryColor, 30)
    : "#a78bfa";

  if (!isPlanLoading && !canAccessPage) {
    return (
      <UpgradeRequired
        feature="Editor de PDF"
        description="O editor de PDF permite personalizar templates e estilos das suas propostas. Faça upgrade para o plano Pro ou Enterprise para acessar."
      />
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/proposals/${proposal?.id}/view`)}
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
            onClick={handleGeneratePdf}
            disabled={isGenerating || isSaving || isSavingDefault}
            className="gap-2"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Baixar PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowSaveDefaultModal(true)}
            disabled={isSavingDefault || isSaving}
            className="gap-2"
          >
            {isSavingDefault ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar Configurações
          </Button>
          <Button
            variant="default"
            onClick={() => setShowSaveModal(true)}
            disabled={isSaving || isSavingDefault}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Editor Panel */}
        <div className="space-y-4 min-w-0">
          <PdfEditorTabs
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
            primaryColor={primaryColor}
            setPrimaryColor={setPrimaryColor}
            fontFamily={fontFamily}
            setFontFamily={setFontFamily}
            repeatHeader={repeatHeader}
            setRepeatHeader={setRepeatHeader}
            sections={sections}
            setSections={setSections}
            canEditPdfSections={canEditPdfSections}
            coverElements={coverElements}
            setCoverElements={setCoverElements}
            premiumColor={premiumColor}
            maxPdfTemplates={maxPdfTemplates}
            setShowUpgradeModal={setShowUpgradeModal}
            clientName={proposal.clientName}
            tenantColor={tenant?.primaryColor}
            validUntil={proposal.validUntil}
          />
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
                    onClick={() => setPreviewZoom((z) => Math.min(2, z + 0.1))}
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
                  className="mx-auto shadow-2xl origin-top transition-transform"
                  style={{
                    width: "794px",
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
                      logoStyle,
                      coverImageOpacity,
                      coverImageFit,
                      coverImagePosition: coverImagePosition as string,
                      sections,
                      coverElements,
                      repeatHeader,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upgrade Modal for Premium Features */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature="Templates Premium"
        description="Desbloqueie templates adicionais e personalize completamente suas propostas em PDF. Faça upgrade para o plano Enterprise para ter acesso a todos os recursos."
        requiredPlan="enterprise"
      />

      {/* Save Confirmation Modal */}
      <SaveConfirmationModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={async () => {
          await handleSave();
          setShowSaveModal(false);
        }}
        type="save"
        isLoading={isSaving}
      />

      {/* Save Default Configuration Modal */}
      <SaveConfirmationModal
        isOpen={showSaveDefaultModal}
        onClose={() => setShowSaveDefaultModal(false)}
        onConfirm={async () => {
          await handleSaveDefault();
          setShowSaveDefaultModal(false);
        }}
        type="saveDefault"
        isLoading={isSavingDefault}
      />
    </div>
  );
}
