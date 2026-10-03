"use client";

import * as React from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { downscaleCatalogImage } from "@/lib/image-downscale";
import { toast } from "@/lib/toast";
import { FieldService } from "@/services/field-service-service";
import type { ServiceOrderPhoto } from "@/types/field-service";

/** Limite do backend para a foto já reduzida (`decodePhotoDataUrl`). */
const PHOTO_MAX_BYTES = 700 * 1024;

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler a foto."));
    reader.readAsDataURL(file);
  });
}

interface PhotosSectionProps {
  orderId: string;
  photos: ServiceOrderPhoto[];
  canEdit: boolean;
}

/**
 * Fotos do atendimento: antes, durante e depois. A foto é reduzida no aparelho
 * antes de subir, porque no celular a câmera tira arquivos de vários MB.
 */
export function PhotosSection({ orderId, photos, canEdit }: PhotosSectionProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const reduced = await downscaleCatalogImage(file);
        if (reduced.size > PHOTO_MAX_BYTES) {
          toast.error(`${file.name} ficou grande demais mesmo reduzida.`);
          continue;
        }
        await FieldService.uploadPhoto(orderId, await fileToDataUrl(reduced));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar a foto.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (photoId: string) => {
    setRemoving(photoId);
    try {
      await FieldService.removePhoto(orderId, photoId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir a foto.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-3">
      {photos.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma foto ainda.</p>}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
              <a href={photo.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto do Storage com token, fora do otimizador */}
                <img src={photo.url} alt={photo.caption ?? "Foto do atendimento"} className="h-full w-full object-cover" />
              </a>
              {canEdit && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  aria-label="Excluir foto"
                  className="absolute right-1 top-1 h-7 w-7 opacity-90"
                  onClick={() => remove(photo.id)}
                  disabled={removing === photo.id}
                >
                  {removing === photo.id ? <Loader size="sm" variant="button" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader size="sm" variant="button" className="mr-2" /> : <Camera className="mr-2 h-4 w-4" />}
            {uploading ? "Enviando..." : "Tirar ou escolher foto"}
          </Button>
        </>
      )}
    </div>
  );
}
