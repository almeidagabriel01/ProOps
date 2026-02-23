"use client";

import { useState } from "react";
import { Tenant, TenantNiche, NICHE_LABELS } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  Shield,
  Loader2,
  Save,
  Palette,
  Camera,
  X,
} from "lucide-react";
import { TenantService } from "@/services/tenant-service";
import { ALLOWED_TYPES } from "@/services/storage-service";
import { toast } from '@/lib/toast';

interface OrganizationFormProps {
  tenant: Tenant | null;
  isMaster: boolean;
}

export function OrganizationForm({ tenant, isMaster }: OrganizationFormProps) {
  const [name, setName] = useState(tenant?.name || "");
  const [niche, setNiche] = useState<TenantNiche | "">(tenant?.niche || "");
  const [primaryColor, setPrimaryColor] = useState(
    tenant?.primaryColor || "#000000",
  );
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl || "");
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Initial values for comparison
  const initialName = tenant?.name || "";
  const initialNiche = tenant?.niche || "";
  const initialColor = tenant?.primaryColor || "#000000";
  const initialLogo = tenant?.logoUrl || "";

  const hasChanges =
    (name !== initialName ||
      niche !== initialNiche ||
      primaryColor !== initialColor ||
      logoUrl !== initialLogo) &&
    name.trim().length > 0;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(
          "O arquivo deve ser uma imagem válida (JPEG, PNG, GIF, WebP ou SVG).",
        );
        e.target.value = "";
        return;
      }
      // Validate size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error("O logo deve ter no máximo 2MB.");
        e.target.value = "";
        return;
      }
      // Convert to Base64
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!tenant || !hasChanges) return;

    setIsLoading(true);
    try {
      await TenantService.updateTenant(tenant.id, {
        name,
        niche: niche as TenantNiche,
        primaryColor,
        logoUrl,
      });
      toast.success("Organização atualizada com sucesso!");
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar organização.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMaster) {
    return (
      <Card className="flex flex-col bg-muted/20 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            Organização
          </CardTitle>
          <CardDescription>Detalhes da empresa onde você atua.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <div className="relative">
              <Input
                value={tenant?.name || "N/A"}
                readOnly
                className="pl-9 bg-muted/50"
              />
              <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="pt-4 border-t mt-auto">
            <div className="flex items-center justify-between bg-secondary/20 p-3 rounded-lg border border-secondary/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Sua Função</p>
                  <p className="text-xs text-muted-foreground">
                    Membro da Equipe
                  </p>
                </div>
              </div>
              <Badge variant="secondary">USER</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              * Contate o administrador para alterações.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Building2 className="w-5 h-5 text-primary" />
            Gerenciar Organização
          </CardTitle>
          <CardDescription>
            Atualize os dados e a aparência da sua empresa.
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsEditing(!isEditing)}
          className="shrink-0"
        >
          <div className="sr-only">Editar</div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <Label htmlFor="orgName">Nome da Empresa</Label>
          <div className="relative">
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-9"
              disabled={!isEditing}
            />
            <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Label htmlFor="niche">Nicho de Atuação</Label>
          <Select
            id="niche"
            value={niche}
            onChange={(e) => setNiche(e.target.value as TenantNiche)}
            disabled={!isEditing}
          >
            <option value="" disabled>
              Selecione um nicho
            </option>
            {Object.entries(NICHE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {/* Logo Upload Section */}
        <div className="flex flex-col gap-4">
          <Label>Foto de Perfil da Organização</Label>
          <div className="flex items-center gap-4">
            {/* Avatar Preview */}
            <div className="relative">
              <Avatar className="w-20 h-20 border-2 border-muted">
                {logoUrl ? (
                  <AvatarImage
                    src={logoUrl}
                    alt={name}
                    className="object-cover"
                  />
                ) : (
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {name ? name.charAt(0).toUpperCase() : "?"}
                  </AvatarFallback>
                )}
              </Avatar>
              {isEditing && logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl("")}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Upload Controls */}
            <div className="flex flex-col gap-2">
              <input
                type="file"
                id="orgLogoPicker"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={!isEditing}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  document.getElementById("orgLogoPicker")?.click()
                }
                className="gap-2"
                disabled={!isEditing}
              >
                <Camera className="w-4 h-4" />
                {logoUrl ? "Alterar Logo" : "Adicionar Logo"}
              </Button>
              <p className="text-xs text-muted-foreground">
                PNG, JPG ou SVG. Máximo 2MB.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Label htmlFor="color">Cor Principal (Tema)</Label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Input
                id="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="pl-9"
                placeholder="#000000"
                disabled={!isEditing}
              />
              <Palette className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>
            <div
              className="w-10 h-10 rounded-md border shadow-sm shrink-0"
              style={{ backgroundColor: primaryColor }}
            />
            {isEditing && (
              <>
                <input
                  type="color"
                  className="invisible w-0 h-0 p-0 absolute"
                  id="colorPicker"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={() =>
                    document.getElementById("colorPicker")?.click()
                  }
                >
                  <Palette className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="pt-4 border-t mt-auto">
          <div className="flex items-center justify-between bg-primary/5 p-3 rounded-lg border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Administrador</p>
                <p className="text-xs text-muted-foreground">
                  Você gerencia esta conta
                </p>
              </div>
            </div>
            <Badge>MASTER</Badge>
          </div>
        </div>
      </CardContent>
      {isEditing && (
        <CardFooter className="border-t bg-muted/10 px-6 py-4">
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
