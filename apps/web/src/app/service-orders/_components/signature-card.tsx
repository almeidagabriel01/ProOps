import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceOrder } from "@/types/field-service";
import { formatWhen } from "@/lib/field-service/service-orders";

/** Quem assinou, quando e o traço; ou por que a OS fechou sem assinatura. */
export function SignatureCard({ order }: { order: ServiceOrder }) {
  const signature = order.signature;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assinatura do cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {signature ? (
          <>
            <div className="rounded-lg border bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- PNG do Storage com token */}
              <img src={signature.imageUrl} alt={`Assinatura de ${signature.name}`} className="mx-auto max-h-32" />
            </div>
            <p className="font-medium">{signature.name}</p>
            {signature.document && <p className="text-muted-foreground">{signature.document}</p>}
            <p className="text-xs text-muted-foreground">
              Assinada em {formatWhen(signature.signedAt)}. Código de conferência {signature.contentHash.slice(0, 12)}.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Sem assinatura: {order.noSignatureReason}</p>
        )}
      </CardContent>
    </Card>
  );
}
