"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { BillingInterval, UserPlan } from "@/types";
import { PlanPreview } from "@/types/plan";
import { formatPrice } from "@/utils/format";

interface PlanChangeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedPlan: UserPlan | null;
    preview: PlanPreview | null;
    isLoading: boolean;
    isFirstSubscription: boolean;
    billingInterval: BillingInterval;
    isProcessing: boolean;
    onConfirm: () => void;
    onManagePayment: () => void;
}

export function PlanChangeDialog({
    open,
    onOpenChange,
    selectedPlan,
    preview,
    isLoading,
    isFirstSubscription,
    billingInterval,
    isProcessing,
    onConfirm,
    onManagePayment,
}: PlanChangeDialogProps) {
    const getTitle = () => {
        if (isLoading) return 'Carregando...';
        if (preview?.isUpgrade) return 'Confirmar Upgrade';
        if (preview?.isDowngrade) return 'Confirmar Downgrade';
        return 'Assinar Plano';
    };

    const getConfirmButtonText = () => {
        if (isProcessing) return 'Processando...';
        if (preview?.isUpgrade) return 'Confirmar Upgrade';
        if (preview?.isDowngrade) return 'Confirmar Downgrade';
        return 'Ir para Pagamento';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{getTitle()}</DialogTitle>
                    <DialogDescription>
                        {selectedPlan && (
                            <>Alteração para o plano <strong>{selectedPlan.name}</strong></>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <LoadingState />
                ) : isFirstSubscription ? (
                    <FirstSubscriptionContent
                        price={
                            selectedPlan?.pricing?.[billingInterval] ??
                            selectedPlan?.price ??
                            0
                        }
                        billingInterval={billingInterval}
                    />
                ) : preview ? (
                    <PreviewContent
                        preview={preview}
                        onManagePayment={() => {
                            onOpenChange(false);
                            onManagePayment();
                        }}
                    />
                ) : null}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isLoading || isProcessing}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processando...
                            </>
                        ) : (
                            getConfirmButtonText()
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function LoadingState() {
    return (
        <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    );
}

function FirstSubscriptionContent({
    price,
    billingInterval,
}: {
    price: number;
    billingInterval: BillingInterval;
}) {
    return (
        <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                    Você será redirecionado para a página de pagamento do Stripe.
                </p>
                <p className="text-lg font-semibold mt-2">
                    Valor: {formatPrice(price)}/{billingInterval === "yearly" ? "ano" : "mês"}
                </p>
            </div>
        </div>
    );
}

function PreviewContent({
    preview,
    onManagePayment
}: {
    preview: PlanPreview;
    onManagePayment: () => void;
}) {
    return (
        <div className="space-y-4">
            {/* Price Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex justify-between text-sm">
                    <span>Plano atual ({preview.currentPlan.tier})</span>
                    <span>{formatPrice(preview.currentPlan.price)}/{preview.currentPlan.interval === 'yearly' ? 'ano' : 'mês'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span>Novo plano ({preview.newPlan.tier})</span>
                    <span>{formatPrice(preview.newPlan.price)}/{preview.newPlan.interval === 'yearly' ? 'ano' : 'mês'}</span>
                </div>
                {preview.creditAmount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                        <span>Crédito (tempo não usado)</span>
                        <span>-{formatPrice(preview.creditAmount)}</span>
                    </div>
                )}
                <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>{preview.isUpgrade ? 'A cobrar agora' : 'Crédito para próxima fatura'}</span>
                    <span className={preview.isUpgrade ? 'text-primary' : 'text-emerald-600'}>
                        {preview.isUpgrade ? formatPrice(preview.amountDue) : formatPrice(preview.creditAmount)}
                    </span>
                </div>
            </div>

            {/* Payment Method */}
            {preview.paymentMethod && (
                <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium capitalize">
                                    {preview.paymentMethod.brand} •••• {preview.paymentMethod.last4}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Expira em {preview.paymentMethod.expMonth}/{preview.paymentMethod.expYear}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onManagePayment}
                        >
                            Alterar
                        </Button>
                    </div>
                </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
                Próxima cobrança: {preview.nextBillingDate}
            </p>
        </div>
    );
}
