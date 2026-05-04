"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  useDropdownMenuContext,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Share2, Copy, Paperclip, Eye, FileDown, Palette, Pencil, Trash2 } from "lucide-react";
import { Proposal } from "@/types/proposal";
import { Loader } from "@/components/ui/loader";

export interface ProposalActionsDropdownProps {
  proposal: Proposal;
  canEdit: boolean;
  canCreate: boolean;
  canDelete?: boolean;
  canGeneratePdf?: boolean;
  isSharing?: boolean;
  isDuplicating?: boolean;
  isDownloading?: boolean;
  isEditing?: boolean;
  onShare: () => void;
  onDuplicate: () => void;
  onAttachments: () => void;
  // Optional inline action callbacks — shown inside dropdown on compact screens
  onViewPdf?: () => void;
  onDownloadPdf?: () => void;
  onEditPdf?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** When true, shows all inline actions inside the dropdown (for compact/responsive mode) */
  showAllActions?: boolean;
}

// Inner component to access context
function DuplicateMenuItem({
  isDuplicating,
  onDuplicate,
}: {
  isDuplicating?: boolean;
  onDuplicate: () => void;
}) {
  const { setOpen } = useDropdownMenuContext();
  const wasHereDuplicating = React.useRef(false);

  // Close dropdown when duplication finishes
  React.useEffect(() => {
    if (isDuplicating) {
      wasHereDuplicating.current = true;
    } else if (wasHereDuplicating.current) {
      wasHereDuplicating.current = false;
      setOpen(false);
    }
  }, [isDuplicating, setOpen]);

  return (
    <DropdownMenuItem
      onClick={onDuplicate}
      disabled={isDuplicating}
      preventClose
    >
      {isDuplicating ? (
        <Loader size="sm" className="mr-2" />
      ) : (
        <Copy className="w-4 h-4 mr-2" />
      )}
      Duplicar
    </DropdownMenuItem>
  );
}

function ShareMenuItem({
  canGeneratePdf,
  isSharing,
  onShare,
}: {
  canGeneratePdf: boolean;
  isSharing?: boolean;
  onShare: () => void;
}) {
  const { setOpen } = useDropdownMenuContext();
  const wasHereSharing = React.useRef(false);

  React.useEffect(() => {
    if (isSharing) {
      wasHereSharing.current = true;
    } else if (wasHereSharing.current) {
      wasHereSharing.current = false;
      setOpen(false);
    }
  }, [isSharing, setOpen]);

  return (
    <DropdownMenuItem
      onClick={canGeneratePdf ? onShare : undefined}
      disabled={isSharing || !canGeneratePdf}
      preventClose
    >
      {isSharing ? (
        <Loader size="sm" className="mr-2" />
      ) : (
        <Share2 className="w-4 h-4 mr-2" />
      )}
      Compartilhar
    </DropdownMenuItem>
  );
}

export function ProposalActionsDropdown({
  proposal,
  canEdit,
  canCreate,
  canDelete,
  canGeneratePdf = true,
  isSharing,
  isDuplicating,
  isDownloading,
  isEditing,
  onShare,
  onDuplicate,
  onAttachments,
  onViewPdf,
  onDownloadPdf,
  onEditPdf,
  onEdit,
  onDelete,
  showAllActions = false,
}: ProposalActionsDropdownProps) {
  const attachmentsCount = proposal.attachments?.length || 0;
  const isDraft = proposal.status === "draft";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Mais ações"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Inline actions — shown only when showAllActions is true (compact mode) */}
        {showAllActions && (
          <>
            {/* Ver PDF */}
            {onViewPdf && (
              <DropdownMenuItem
                onClick={!isDraft ? onViewPdf : undefined}
                disabled={isDraft}
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver PDF
              </DropdownMenuItem>
            )}

            {/* Baixar PDF */}
            {onDownloadPdf && (
              <DropdownMenuItem
                onClick={canGeneratePdf ? onDownloadPdf : undefined}
                disabled={isDownloading || !canGeneratePdf}
              >
                {isDownloading ? (
                  <Loader size="sm" className="mr-2" />
                ) : (
                  <FileDown className="w-4 h-4 mr-2" />
                )}
                Baixar PDF
              </DropdownMenuItem>
            )}

            {/* Editar PDF */}
            {onEditPdf && canEdit && (
              <DropdownMenuItem
                onClick={canGeneratePdf ? onEditPdf : undefined}
                disabled={!canGeneratePdf}
              >
                <Palette className="w-4 h-4 mr-2" />
                Editar PDF
              </DropdownMenuItem>
            )}

            {/* Editar */}
            {onEdit && canEdit && (
              <DropdownMenuItem onClick={onEdit} disabled={isEditing}>
                {isEditing ? (
                  <Loader size="sm" className="mr-2" />
                ) : (
                  <Pencil className="w-4 h-4 mr-2" />
                )}
                Editar
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
          </>
        )}

        {/* Compartilhar */}
        <ShareMenuItem
          canGeneratePdf={canGeneratePdf}
          isSharing={isSharing}
          onShare={onShare}
        />

        {/* Duplicar */}
        {canCreate && (
          <DuplicateMenuItem
            isDuplicating={isDuplicating}
            onDuplicate={onDuplicate}
          />
        )}

        {/* Anexos */}
        {canEdit && (
          <DropdownMenuItem onClick={onAttachments}>
            <Paperclip className="w-4 h-4 mr-2" />
            Anexos
            {attachmentsCount > 0 && (
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {attachmentsCount}
              </span>
            )}
          </DropdownMenuItem>
        )}

        {/* Excluir — shown only in compact mode */}
        {showAllActions && onDelete && canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
