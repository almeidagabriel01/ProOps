"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Upload } from "lucide-react";
import { TenantNiche, NICHE_LABELS } from "@/types";

interface RegisterFormFieldsProps {
  name: string;
  onNameChange: (value: string) => void;
  companyName: string;
  onCompanyNameChange: (value: string) => void;
  companyNiche: TenantNiche;
  onCompanyNicheChange: (value: TenantNiche) => void;
  companyColor: string;
  onCompanyColorChange: (value: string) => void;
  companyLogo: string;
  onCompanyLogoChange: (value: string) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function RegisterFormFields({
  name,
  onNameChange,
  companyName,
  onCompanyNameChange,
  companyNiche,
  onCompanyNicheChange,
  companyColor,
  onCompanyColorChange,
  companyLogo,
  onCompanyLogoChange,
  onLogoUpload,
}: RegisterFormFieldsProps) {
  return (
    <>
      {/* User Info Section */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground border-b border-border pb-2">
          Dados Pessoais
        </p>
        <div className="grid gap-2">
          <Label htmlFor="name" className="text-foreground">
            Seu Nome
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Seu nome completo"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            className="bg-background border-input text-foreground"
          />
        </div>
      </div>

      {/* Company Info Section */}
      <div className="space-y-3 pt-2">
        <p className="text-sm font-medium text-muted-foreground border-b border-border pb-2">
          Dados da Empresa
        </p>

        <div className="grid gap-2">
          <Label htmlFor="companyName" className="text-foreground">
            Nome da Empresa
          </Label>
          <Input
            id="companyName"
            type="text"
            placeholder="Minha Empresa"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            required
            className="bg-background border-input text-foreground"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="niche" className="text-foreground">
              Nicho
            </Label>
            <Select
              id="niche"
              value={companyNiche}
              onChange={(e) =>
                onCompanyNicheChange(e.target.value as TenantNiche)
              }
              className="bg-background border-input text-foreground"
            >
              {(Object.keys(NICHE_LABELS) as TenantNiche[]).map((key) => (
                <option key={key} value={key}>
                  {NICHE_LABELS[key]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="color" className="text-foreground">
              Cor da Marca
            </Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                value={companyColor}
                onChange={(e) => onCompanyColorChange(e.target.value)}
                className="w-12 h-10 p-1 cursor-pointer bg-background border-input"
              />
              <Input
                value={companyColor}
                onChange={(e) => onCompanyColorChange(e.target.value)}
                className="font-mono bg-background border-input text-foreground flex-1"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="logo" className="text-foreground">
            Logo da Empresa
          </Label>
          <div className="flex items-center gap-3">
            {companyLogo ? (
              <div className="relative w-14 h-14 rounded-lg border border-border overflow-hidden bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={companyLogo}
                  alt="Logo preview"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => onCompanyLogoChange("")}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center hover:bg-destructive/90"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30">
                <Upload className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <Input
                id="logo"
                type="file"
                accept="image/*"
                onChange={onLogoUpload}
                className="cursor-pointer bg-background border-input text-foreground"
              />
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG ou SVG. Máx 300KB.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-700 pt-3"></div>
    </>
  );
}

interface CredentialFieldsProps {
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  mode: "login" | "register";
  error?: string;
}

export function CredentialFields({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  mode,
  error,
}: CredentialFieldsProps) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="email" className="text-foreground">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          className="bg-background border-input text-foreground"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password" className="text-foreground">
          Senha
        </Label>
        <Input
          id="password"
          type="password"
          placeholder={
            mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"
          }
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          className="bg-background border-input text-foreground"
        />
      </div>
      {error && <p className="text-sm text-destructive font-medium">{error}</p>}
    </>
  );
}
