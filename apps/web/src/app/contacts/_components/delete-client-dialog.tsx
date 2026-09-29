import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type Client } from "@/services/client-service";
import { Loader } from "@/components/ui/loader";

interface DeleteClientDialogProps {
  client: Client | null;
  isOpen: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteClientDialog({
  client,
  isOpen,
  isDeleting,
  onOpenChange,
  onConfirm,
}: DeleteClientDialogProps) {
  if (!client) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o cliente{" "}
            <strong>{client.name}</strong>? Depois de excluir, você tem alguns segundos para desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive hover:bg-destructive/90 gap-2"
            disabled={isDeleting}
          >
            {isDeleting && <Loader size="sm" variant="button" className="text-white" />}
            {isDeleting ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
