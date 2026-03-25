"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Proposal, ProposalAttachment } from "@/types/proposal";
import {
  Upload,
  FileImage,
  FileText,
  Loader2,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { toast } from '@/lib/toast';
import { ProposalService } from "@/services/proposal-service";
import {
  deleteStorageObject,
  uploadProposalAttachment,
} from "@/services/storage-service";
import { formatDateBR } from "@/utils/date-format";

interface ProposalAttachmentsDialogProps {
  proposal: Proposal;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (attachments: ProposalAttachment[]) => void;
}

const ACCEPTED_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  pdf: ["application/pdf"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Domínios do Firebase Storage considerados internos/confiáveis.
 * Arquivos hospedados aqui são enviados pelo próprio sistema.
 */
const TRUSTED_STORAGE_HOSTNAMES = new Set([
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
]);

/** Retorna true quando a URL aponta para armazenamento interno confiável. */
function isInternalStorageUrl(value: string): boolean {
  if (value.startsWith("data:")) return true;
  try {
    const parsed = new URL(value);
    return TRUSTED_STORAGE_HOSTNAMES.has(parsed.hostname);
  } catch {
    return false;
  }
}

function isSafeAttachmentOpenUrl(value: string, type: "image" | "pdf"): boolean {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;

  if (trimmed.startsWith("data:")) {
    const match = trimmed.match(/^data:([^;,]+);base64,/i);
    if (!match) return false;
    const mime = String(match[1] || "").toLowerCase();
    if (type === "pdf") return mime === "application/pdf";
    return mime.startsWith("image/");
  }

  try {
    const parsed = new URL(trimmed);
    const isHttps = parsed.protocol === "https:";
    const isDevHttp =
      parsed.protocol === "http:" && process.env.NODE_ENV !== "production";
    return (isHttps || isDevHttp) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function ProposalAttachmentsDialog({
  proposal,
  isOpen,
  onClose,
  onUpdate,
}: ProposalAttachmentsDialogProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Local state for attachments to ensure immediate UI updates
  const [attachments, setAttachments] = React.useState<ProposalAttachment[]>(
    proposal.attachments || [],
  );

  // Sync local state with prop when proposal changes
  React.useEffect(() => {
    setAttachments(proposal.attachments || []);
  }, [proposal.attachments, proposal.id]);

  const [isDragging, setIsDragging] = React.useState(false);

  // Reusable file processing function
  const processFile = async (file: File) => {
    // Validate file type
    const isImage = ACCEPTED_TYPES.image.includes(file.type);
    const isPdf = ACCEPTED_TYPES.pdf.includes(file.type);

    if (!isImage && !isPdf) {
      toast.error(
        "Tipo de arquivo não suportado. Use imagens (JPG, PNG, WebP) ou PDF.",
      );
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Tamanho máximo: 10MB");
      return;
    }

    setIsUploading(true);

    try {
      const tenantId = String(proposal.tenantId || "").trim();
      if (!tenantId || !proposal.id) {
        toast.error("Não foi possível identificar a proposta para upload.");
        return;
      }

      const upload = await uploadProposalAttachment(file, tenantId, proposal.id);

      const newAttachment: ProposalAttachment = {
        id: crypto.randomUUID(),
        name: file.name || `arquivo-${Date.now()}.${isImage ? "png" : "pdf"}`,
        url: upload.url,
        storagePath: upload.path,
        type: isImage ? "image" : "pdf",
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

      const updatedAttachments = [...attachments, newAttachment];

      await ProposalService.updateProposal(proposal.id, {
        attachments: updatedAttachments,
      });

      setAttachments(updatedAttachments);
      onUpdate(updatedAttachments);
      toast.success("Anexo adicionado com sucesso!");
    } catch (error) {
      console.error("Error uploading attachment:", error);
      toast.error("Erro ao adicionar anexo");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFile(files[0]);
  };

  // Handle paste from clipboard (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await processFile(file);
          return;
        }
      }
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Handle files from drag
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
      return;
    }

    // Handle images dragged from other browser tabs (as URL)
    const imageUrl =
      e.dataTransfer?.getData("text/uri-list") ||
      e.dataTransfer?.getData("text/plain");
    if (
      imageUrl &&
      (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))
    ) {
      // Check if it looks like an image URL
      const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const isImageUrl = imageExtensions.some((ext) =>
        imageUrl.toLowerCase().includes(ext),
      );

      if (isImageUrl) {
        setIsUploading(true);
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const file = new File(
            [blob],
            `imagem-${Date.now()}.${blob.type.split("/")[1] || "png"}`,
            { type: blob.type },
          );
          await processFile(file);
        } catch (error) {
          console.error("Error fetching image from URL:", error);
          toast.error("Não foi possível carregar a imagem desta URL");
          setIsUploading(false);
        }
        return;
      }
    }
  };

  const handleDelete = async (attachmentId: string) => {
    setDeletingId(attachmentId);

    try {
      const attachmentToDelete = attachments.find((a) => a.id === attachmentId);
      const updatedAttachments = attachments.filter(
        (a) => a.id !== attachmentId,
      );

      await ProposalService.updateProposal(proposal.id, {
        attachments: updatedAttachments,
      });

      setAttachments(updatedAttachments);
      onUpdate(updatedAttachments);
      if (attachmentToDelete?.storagePath) {
        void deleteStorageObject(attachmentToDelete.storagePath).catch(
          (deleteError) => {
            console.warn(
              "Não foi possível remover arquivo do storage:",
              deleteError,
            );
          },
        );
      }
      toast.success("Anexo removido com sucesso!");
    } catch (error) {
      console.error("Error deleting attachment:", error);
      toast.error("Erro ao remover anexo");
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const openAttachment = (attachment: ProposalAttachment) => {
    const targetUrl = String(attachment.url || "").trim();
    if (!targetUrl || !isSafeAttachmentOpenUrl(targetUrl, attachment.type)) {
      toast.error("Anexo inválido");
      return;
    }

    // URLs externas (fora do Firebase Storage) exigem confirmação explícita
    // para mitigar phishing — o usuário é avisado antes de sair do sistema.
    if (!isInternalStorageUrl(targetUrl)) {
      const confirmed = window.confirm(
        `Você está prestes a abrir um link externo:\n${targetUrl}\n\nContinuar?`,
      );
      if (!confirmed) return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Anexos da Proposta</DialogTitle>
          <DialogDescription>
            Adicione imagens ou documentos PDF relacionados a esta proposta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4" onPaste={handlePaste} tabIndex={0}>
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/10"
                : "hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.webp,.gif,.pdf"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">
                  Enviando arquivo...
                </span>
              </div>
            ) : isDragging ? (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-primary" />
                <span className="text-sm text-primary font-medium">
                  Solte o arquivo aqui
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique, arraste ou cole (Ctrl+V)
                </span>
                <span className="text-xs text-muted-foreground">
                  Imagens (JPG, PNG, WebP) ou PDF • Máx. 10MB
                </span>
              </div>
            )}
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                Anexos ({attachments.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                  >
                    {/* Icon */}
                    <div className="shrink-0">
                      {attachment.type === "image" ? (
                        <FileImage className="w-5 h-5 text-blue-500" />
                      ) : (
                        <FileText className="w-5 h-5 text-red-500" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)} •{" "}
                        {formatDateBR(attachment.uploadedAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openAttachment(attachment)}
                        title="Abrir"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(attachment.id)}
                        disabled={deletingId === attachment.id}
                        title="Excluir"
                      >
                        {deletingId === attachment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {attachments.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              Nenhum anexo adicionado ainda.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
