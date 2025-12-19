"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Upload, Mail, Lock, Eye, EyeOff } from "lucide-react";
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
  errors?: Record<string, string>;
}

export function CredentialFields({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  mode,
  error,
  errors = {},
}: CredentialFieldsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  // Validate email on blur
  const validateEmail = () => {
    if (!email.trim()) {
      setLocalErrors((prev) => ({ ...prev, email: "Email é obrigatório" }));
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalErrors((prev) => ({ ...prev, email: "Email inválido" }));
    } else {
      setLocalErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }
  };

  // Validate password on blur
  const validatePassword = () => {
    if (!password) {
      setLocalErrors((prev) => ({ ...prev, password: "Senha é obrigatória" }));
    } else if (password.length < 6) {
      setLocalErrors((prev) => ({
        ...prev,
        password: "Senha deve ter pelo menos 6 caracteres",
      }));
    } else {
      setLocalErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.password;
        return newErrors;
      });
    };
  };

  const emailError = errors.email || localErrors.email;
  const passwordError = errors.password || localErrors.password;

  // Prevent autofill on page load but allow autocomplete suggestions when user interacts
  const [emailReadOnly, setEmailReadOnly] = useState(true);
  const [passwordReadOnly, setPasswordReadOnly] = useState(true);

  return (
    <>
      <div className="grid gap-2">
        <Label
          htmlFor="email"
          className="text-foreground flex items-center gap-1"
        >
          Email <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            readOnly={emailReadOnly}
            onFocus={() => { setEmailReadOnly(false); setPasswordReadOnly(false); }}
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            onBlur={validateEmail}
            className={`flex h-12 w-full rounded-xl border-2 border-border/60 bg-card px-4 py-3 text-sm pl-9
              shadow-sm transition-[border-color,box-shadow] duration-200 ease-out
              placeholder:text-muted-foreground/60
              hover:border-primary/40 hover:shadow-md
              focus:outline-none focus:border-primary focus:shadow-lg focus:shadow-primary/10
              focus:ring-4 focus:ring-primary/10
              ${emailError ? "border-destructive" : ""}`}
          />
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        {emailError && <p className="text-sm text-destructive">{emailError}</p>}
      </div>
      <div className="grid gap-2">
        <Label
          htmlFor="password"
          className="text-foreground flex items-center gap-1"
        >
          Senha <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            readOnly={passwordReadOnly}
            onFocus={() => setPasswordReadOnly(false)}
            placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Sua senha"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onBlur={validatePassword}
            className={`flex h-12 w-full rounded-xl border-2 border-border/60 bg-card px-4 py-3 text-sm pl-9 pr-10
              shadow-sm transition-[border-color,box-shadow] duration-200 ease-out
              placeholder:text-muted-foreground/60
              hover:border-primary/40 hover:shadow-md
              focus:outline-none focus:border-primary focus:shadow-lg focus:shadow-primary/10
              focus:ring-4 focus:ring-primary/10
              ${passwordError ? "border-destructive" : ""}`}
          />
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
        {passwordError && (
          <p className="text-sm text-destructive">{passwordError}</p>
        )}
      </div>
      {error && <p className="text-sm text-destructive font-medium">{error}</p>}
    </>
  );
}