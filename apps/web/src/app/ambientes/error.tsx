"use client";

import { RouteError } from "@/components/shared/route-error";
import { useNicheVocabulary } from "@/hooks/useNicheVocabulary";
import { os } from "@/lib/niches/vocabulary";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const v = useNicheVocabulary();
  return <RouteError error={error} reset={reset} moduleName={`${os(v.place)} ${v.place.plural}`} />;
}
