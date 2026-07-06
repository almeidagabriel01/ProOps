"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { UserService } from "@/services/user-service";
import { setLiaSoundsEnabled } from "@/lib/lia-sounds";

export interface UseLiaSoundPreferenceReturn {
  /** Estado efetivo (otimista) da preferência de sons */
  soundsEnabled: boolean;
  /** Persistência em andamento */
  isSaving: boolean;
  /** Alterna e persiste a preferência; reverte a UI se a API falhar */
  toggleSounds: () => Promise<void>;
}

/**
 * Preferência de efeitos sonoros da Lia.
 * Fonte: users/{uid}.preferences.liaSoundsEnabled (default: ligado).
 * Toggle otimista via PUT /v1/profile; revert em erro.
 * Sincroniza o gate síncrono do módulo lia-sounds a cada mudança.
 */
export function useLiaSoundPreference(): UseLiaSoundPreferenceReturn {
  const { user } = useAuth();
  const rawServerValue = user?.preferences?.liaSoundsEnabled;
  const serverValue = rawServerValue ?? true;

  const [override, setOverride] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const soundsEnabled = override ?? serverValue;

  // Server refresh wins: drop the local override when the doc value changes.
  // Depends on the raw value (undefined | boolean) so that `undefined -> true`
  // (preference materializing in the doc) also clears the override.
  useEffect(() => {
    setOverride(null);
  }, [rawServerValue]);

  useEffect(() => {
    setLiaSoundsEnabled(soundsEnabled);
  }, [soundsEnabled]);

  const toggleSounds = useCallback(async () => {
    const next = !soundsEnabled;
    setOverride(next);
    setIsSaving(true);
    try {
      await UserService.updateProfile({
        preferences: { liaSoundsEnabled: next },
      });
    } catch (error) {
      console.error("Error saving Lia sound preference:", error);
      setOverride(!next);
    } finally {
      setIsSaving(false);
    }
  }, [soundsEnabled]);

  return { soundsEnabled, isSaving, toggleSounds };
}
