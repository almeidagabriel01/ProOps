"use client";

import * as React from "react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  Eye,
  Share2,
  FileDown,
  FileText,
  Copy,
  Paperclip,
  Trash2,
  Loader2,
} from "lucide-react";
import { Proposal } from "@/types/proposal";

interface ProposalActionsDropdownProps {
  proposal: Proposal;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  isSharing?: boolean;
  isDownloading?: boolean;
  isEditing?: boolean;
  isDuplicating?: boolean;
  onShare: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onAttachments: () => void;
}

export function ProposalActionsDropdown({
  proposal,
  canEdit,
  canCreate,
  canDelete,
  isSharing,
  isDownloading,
  isEditing,
  isDuplicating,
  onShare,
  onDownload,
  onEdit,
  onDuplicate,
  onDelete,
  onAttachments,
}: ProposalActionsDropdownProps) {
  const attachmentsCount = proposal.attachments?.length || 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Ações">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Ver PDF */}
        <Link href={`/proposals/${proposal.id}/view`}>
          <DropdownMenuItem>
            <Eye className="w-4 h-4 mr-2" />
            Ver PDF
          </DropdownMenuItem>
        </Link>

        {/* Compartilhar */}
        <DropdownMenuItem onClick={onShare} disabled={isSharing}>
          {isSharing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Share2 className="w-4 h-4 mr-2" />
          )}
          Compartilhar
        </DropdownMenuItem>

        {/* Baixar PDF */}
        <DropdownMenuItem onClick={onDownload} disabled={isDownloading}>
          {isDownloading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileDown className="w-4 h-4 mr-2" />
          )}
          Baixar PDF
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Editar */}
        {canEdit && (
          <DropdownMenuItem onClick={onEdit} disabled={isEditing}>
            {isEditing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Editar
          </DropdownMenuItem>
        )}

        {/* Duplicar */}
        {canCreate && (
          <DropdownMenuItem onClick={onDuplicate} disabled={isDuplicating}>
            {isDuplicating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            Duplicar
          </DropdownMenuItem>
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

        {canDelete && (
          <>
            <DropdownMenuSeparator />
            {/* Excluir */}
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
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
