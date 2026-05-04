"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Ban, LayoutDashboard } from "lucide-react";

interface PageUnavailableStateProps {
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
}

export function PageUnavailableState({
  title,
  description,
  ctaHref = "/dashboard",
  ctaLabel = "Ir para Dashboard",
}: PageUnavailableStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Ban className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <Link href={ctaHref}>
          <Button className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            {ctaLabel}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
