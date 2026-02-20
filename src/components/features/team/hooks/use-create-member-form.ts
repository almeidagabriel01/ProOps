import React, { useState, useEffect } from "react";
import {
  useCreateMember,
  getDefaultPermissions,
} from "@/hooks/useCreateMember";
import { useUpgradeModal } from "@/components/ui/upgrade-modal";
import { roleConfig } from "../team-constants";
import { useTenant } from "@/providers/tenant-provider";

interface UseCreateMemberFormProps {
  onSuccess: () => void;
}

export function useCreateMemberForm({ onSuccess }: UseCreateMemberFormProps) {
  const { createMember, isLoading, error } = useCreateMember();
  const { tenantOwner } = useTenant();
  const upgradeModal = useUpgradeModal();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("viewer");
  const [customPermissions, setCustomPermissions] = useState(
    getDefaultPermissions("viewer"),
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = React.useState(false);

  const handleRoleSelect = (roleId: string) => {
    setSelectedRole(roleId);
    setCustomPermissions(
      getDefaultPermissions(roleId as keyof typeof roleConfig),
    );
  };

  const handleSubmit = async () => {
    const result = await createMember({
      name,
      email,
      password: password || undefined,
      phoneNumber: phoneNumber || undefined,
      permissions: customPermissions,
      targetMasterId: tenantOwner?.id, // Pass master ID for super admin support
    });

    if (result?.success) {
      setName("");
      setEmail("");
      setPassword("");
      setPhoneNumber("");
      setSelectedRole("viewer");
      setCustomPermissions(getDefaultPermissions("viewer"));
      onSuccess();
    } else if (
      result?.error &&
      ["resource-exhausted", "failed-precondition"].includes(result.error.code)
    ) {
      // Show upgrade modal for limit errors
      upgradeModal.showUpgradeModal(
        "Limite de Equipe Atingido",
        "Você atingiu o limite de membros do seu plano atual. Faça upgrade para adicionar mais pessoas à sua equipe.",
        "pro",
      );
    }
  };

  // Limpar erros automaticamente quando os campos mudam
  React.useEffect(() => {
    if (name && name.trim().length >= 2 && errors.name) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.name;
        return newErrors;
      });
    }
  }, [name, errors.name]);

  React.useEffect(() => {
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && errors.email) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.email;
        return newErrors;
      });
    }
  }, [email, errors.email]);

  React.useEffect(() => {
    if (password && password.length >= 6 && errors.password) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.password;
        return newErrors;
      });
    }
  }, [password, errors.password]);

  // Validação do Step 1 (Informações)
  const validateStep1 = (): boolean => {
    let isValid = true;
    const newErrors: Record<string, string> = {};

    if (!name || name.trim().length < 2) {
      newErrors.name = "Nome deve ter pelo menos 2 caracteres";
      isValid = false;
    }

    if (!email || !email.trim()) {
      newErrors.email = "Email é obrigatório";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Email inválido";
      isValid = false;
    }

    if (!password || password.length < 6) {
      newErrors.password = "Senha deve ter pelo menos 6 caracteres";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  return {
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    phoneNumber,
    setPhoneNumber,
    selectedRole,
    customPermissions,
    setCustomPermissions,
    errors,
    showPassword,
    setShowPassword,
    handleRoleSelect,
    handleSubmit,
    validateStep1,
    isLoading,
    error,
    upgradeModal,
  };
}
