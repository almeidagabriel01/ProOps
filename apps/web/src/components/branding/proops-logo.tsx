import Image from "next/image";
import { cn } from "@/lib/utils";

type ProOpsLogoVariant = "full" | "symbol";

interface ProOpsLogoProps {
  variant?: ProOpsLogoVariant;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  interactive?: boolean;
  invertOnDark?: boolean;
}

const LOGO_SRC: Record<ProOpsLogoVariant, string> = {
  full: "/logo/logo-transparent.png",
  symbol: "/logo/logo2-transparent.png",
};

const LOGO_ALT: Record<ProOpsLogoVariant, string> = {
  full: "ProOps",
  symbol: "ProOps symbol",
};

const LOGO_SIZE: Record<ProOpsLogoVariant, { width: number; height: number }> =
  {
    full: { width: 220, height: 76 },
    symbol: { width: 40, height: 40 },
  };

export function ProOpsLogo({
  variant = "full",
  className,
  width,
  height,
  priority = false,
  interactive = true,
  invertOnDark = false,
}: ProOpsLogoProps) {
  const size = LOGO_SIZE[variant];

  return (
    <Image
      src={LOGO_SRC[variant]}
      alt={LOGO_ALT[variant]}
      width={width ?? size.width}
      height={height ?? size.height}
      priority={priority}
      className={cn(
        "object-contain transition-all duration-300",
        invertOnDark && "dark:invert",
        interactive &&
          "cursor-pointer hover:scale-[1.06] hover:-translate-y-0.5 hover:drop-shadow-[0_10px_18px_rgba(0,0,0,0.18)]",
        className,
      )}
    />
  );
}
