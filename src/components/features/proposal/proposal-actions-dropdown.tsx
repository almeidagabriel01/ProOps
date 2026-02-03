"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  useDropdownMenuContext,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, Share2, Copy, Paperclip, Loader2 } from "lucide-react";
import { Proposal } from "@/types/proposal";

export interface ProposalActionsDropdownProps {
  proposal: Proposal;
  canEdit: boolean;
  canCreate: boolean;
  canGeneratePdf?: boolean;
  isSharing?: boolean;
  isDuplicating?: boolean;
  onShare: () => void;
  onDuplicate: () => void;
  onAttachments: () => void;
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
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Copy className="w-4 h-4 mr-2" />
      )}
      Duplicar
    </DropdownMenuItem>
  );
}

export function ProposalActionsDropdown({
  proposal,
  canEdit,
  canCreate,
  canGeneratePdf = true,
  isSharing,
  isDuplicating,
  onShare,
  onDuplicate,
  onAttachments,
}: ProposalActionsDropdownProps) {
  const attachmentsCount = proposal.attachments?.length || 0;

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
        {/* Compartilhar */}
        <DropdownMenuItem
          onClick={canGeneratePdf ? onShare : undefined}
          disabled={isSharing || !canGeneratePdf}
        >
          {isSharing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Share2 className="w-4 h-4 mr-2" />
          )}
          Compartilhar
        </DropdownMenuItem>

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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
