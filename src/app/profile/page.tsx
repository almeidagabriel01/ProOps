"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    User as UserIcon,
    Mail,
    Building2,
    Shield,
    Crown,
    Zap,
    Building,
    Check,
    Loader2,
    CreditCard,
    ExternalLink,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useTenant } from "@/providers/tenant-provider";
import { PlanService } from "@/services/plan-service";
import { UserPlan } from "@/types";
import { cn } from "@/lib/utils";

interface PlanPreview {
    currentPlan: { tier: string; price: number };
    newPlan: { tier: string; price: number };
    amountDue: number;
    creditAmount: number;
    isUpgrade: boolean;
    isDowngrade: boolean;
    paymentMethod: {
        brand: string;
        last4: string;
        expMonth: number;
        expYear: number;
    } | null;
    nextBillingDate: string;
}

const tierIcons: Record<string, React.ElementType> = {
    starter: Zap,
    pro: Crown,
    enterprise: Building,
};

const tierColors: Record<string, string> = {
    starter: "from-blue-500 to-blue-600",
    pro: "from-emerald-500 to-teal-600",
    enterprise: "from-purple-500 to-purple-600",
};

export default function ProfilePage() {
    const { user } = useAuth();
    const { tenant } = useTenant();
    const searchParams = useSearchParams();
    const [userPlan, setUserPlan] = React.useState<UserPlan | null>(null);
    const [allPlans, setAllPlans] = React.useState<UserPlan[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [upgradingPlan, setUpgradingPlan] = React.useState<string | null>(null);
    const [downgradingPlan, setDowngradingPlan] = React.useState<string | null>(null);
    const [openingPortal, setOpeningPortal] = React.useState(false);
    const toastShownRef = React.useRef(false);

    // Confirmation modal state
    const [confirmDialogOpen, setConfirmDialogOpen] = React.useState(false);
    const [selectedPlan, setSelectedPlan] = React.useState<UserPlan | null>(null);
    const [planPreview, setPlanPreview] = React.useState<PlanPreview | null>(null);
    const [loadingPreview, setLoadingPreview] = React.useState(false);
    const [isFirstSubscription, setIsFirstSubscription] = React.useState(false);

    // Handle success/canceled from Stripe redirect or localStorage
    React.useEffect(() => {
        // Prevent duplicate toasts on re-renders
        if (toastShownRef.current) return;

        // Check localStorage first (for messages that need to persist across reload)
        const savedMessage = localStorage.getItem('profile_message');
        if (savedMessage) {
            try {
                const msg = JSON.parse(savedMessage);
                if (msg.type === 'success') {
                    toast.success(msg.text, { toastId: 'profile-success' });
                } else {
                    toast.error(msg.text, { toastId: 'profile-error' });
                }
                toastShownRef.current = true;
                localStorage.removeItem('profile_message');
            } catch (e) {
                localStorage.removeItem('profile_message');
            }
            window.history.replaceState({}, '', '/profile');
            return;
        }

        // Check URL params
        const urlParams = new URLSearchParams(window.location.search);
        const success = searchParams.get('success') || urlParams.get('success');
        const canceled = searchParams.get('canceled') || urlParams.get('canceled');

        if (success === 'true') {
            toast.success('Pagamento realizado com sucesso! Seu plano foi atualizado.', { toastId: 'stripe-success' });
            toastShownRef.current = true;
            window.history.replaceState({}, '', '/profile');
        } else if (canceled === 'true') {
            toast.error('Pagamento cancelado. Nenhuma alteração foi feita.', { toastId: 'stripe-canceled' });
            toastShownRef.current = true;
            window.history.replaceState({}, '', '/profile');
        }
    }, [searchParams]);

    React.useEffect(() => {
        const loadPlans = async () => {
            try {
                const plans = await PlanService.getPlans();
                setAllPlans(plans);

                if (user?.planId) {
                    const plan = await PlanService.getPlanById(user.planId);
                    setUserPlan(plan);
                } else {
                    // Default to starter plan if no plan is set
                    const starterPlan = plans.find((p) => p.tier === "starter");
                    setUserPlan(starterPlan || plans[0] || null);
                }
            } catch (error) {
                console.error("Error loading plans:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadPlans();
    }, [user?.planId]);

    const getRoleLabel = (role: string) => {
        switch (role) {
            case "superadmin":
                return "Super Admin";
            case "admin":
                return "Administrador";
            case "user":
                return "Usuário";
            default:
                return role;
        }
    };

    const getRoleBadgeVariant = (role: string) => {
        switch (role) {
            case "superadmin":
                return "destructive";
            case "admin":
                return "default";
            default:
                return "outline";
        }
    };

    const formatPrice = (price: number) => {
        if (price === 0) return "Grátis";
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(price);
    };

    const formatLimit = (value: number) => {
        return value === -1 ? "Ilimitado" : value.toString();
    };

    const isCurrentPlan = (plan: UserPlan) => {
        return (
            userPlan?.id === plan.id ||
            (!userPlan && plan.tier === "starter") ||
            userPlan?.tier === plan.tier
        );
    };

    const upgradePlans = allPlans.filter(
        (p) => (userPlan ? p.order > userPlan.order : p.tier !== "starter")
    );

    // Show plan change confirmation modal
    const showPlanChangeConfirmation = async (plan: UserPlan, isUpgrade: boolean) => {
        if (!user) return;

        setSelectedPlan(plan);
        setLoadingPreview(true);
        setConfirmDialogOpen(true);

        try {
            // Check if user has an existing subscription
            const hasSubscription = userPlan && userPlan.tier !== 'starter';

            if (!hasSubscription) {
                // First subscription - no preview needed, proceed directly
                setIsFirstSubscription(true);
                setPlanPreview(null);
            } else {
                // Get preview from API
                setIsFirstSubscription(false);
                const response = await fetch('/api/stripe/preview', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.id,
                        newPlanTier: plan.tier,
                    }),
                });

                const data = await response.json();
                if (data.preview) {
                    setPlanPreview(data.preview);
                } else {
                    setIsFirstSubscription(true);
                    setPlanPreview(null);
                }
            }
        } catch (error) {
            console.error('Preview error:', error);
            toast.error('Erro ao carregar prévia. Tente novamente.');
            setConfirmDialogOpen(false);
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleUpgrade = (plan: UserPlan) => {
        showPlanChangeConfirmation(plan, true);
    };

    const confirmPlanChange = async () => {
        if (!user || !selectedPlan) return;

        const isUpgrade = planPreview?.isUpgrade ?? true;

        if (isUpgrade) {
            setUpgradingPlan(selectedPlan.tier);
        } else {
            setDowngradingPlan(selectedPlan.tier);
        }
        setConfirmDialogOpen(false);

        try {
            // Use checkout for all plan changes
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                    planTier: selectedPlan.tier,
                    userEmail: user.email,
                }),
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else if (data.success) {
                localStorage.setItem('profile_message', JSON.stringify({ type: 'success', text: 'Plano atualizado com sucesso!' }));
                window.location.reload();
            } else {
                throw new Error(data.error || 'Falha ao processar');
            }
        } catch (error) {
            console.error('Plan change error:', error);
            toast.error('Erro ao processar alteração de plano. Tente novamente.');
            setUpgradingPlan(null);
            setDowngradingPlan(null);
        }
    };

    const handleDowngrade = (plan: UserPlan) => {
        showPlanChangeConfirmation(plan, false);
    };

    const handleManagePayment = async () => {
        if (!user) return;

        setOpeningPortal(true);

        try {
            const response = await fetch('/api/stripe/portal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                }),
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Falha ao abrir portal');
            }
        } catch (error) {
            console.error('Portal error:', error);
            toast.error('Erro ao abrir gerenciamento de pagamento.');
            setOpeningPortal(false);
        }
    };

    return (
        <>
            <div className="space-y-6 max-w-5xl mx-auto">

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
                    <p className="text-muted-foreground mt-1">
                        Visualize e gerencie suas informações pessoais
                    </p>
                </div>

                {/* Profile Card */}
                <Card>
                    <CardHeader className="pb-4">
                        <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center shrink-0">
                                <UserIcon className="w-10 h-10 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <CardTitle className="text-2xl">
                                            {user?.name || "Usuário"}
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-2 mt-1">
                                            <Mail className="w-4 h-4" />
                                            {user?.email || "email@exemplo.com"}
                                        </CardDescription>
                                    </div>
                                    {tenant && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                                            <Building2 className="w-4 h-4" />
                                            <span className="font-medium text-foreground">{tenant.name}</span>
                                            <span>•</span>
                                            <span className="capitalize">{tenant.niche?.replace(/_/g, " ")}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2 mt-3">
                                    <Badge
                                        variant={
                                            getRoleBadgeVariant(user?.role || "user") as
                                            | "default"
                                            | "outline"
                                            | "destructive"
                                        }
                                    >
                                        <Shield className="w-3 h-3 mr-1" />
                                        {getRoleLabel(user?.role || "user")}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                {/* Plans Section - Current + Upgrades */}
                {!isLoading && allPlans.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold">Meu Plano</h2>
                                <p className="text-muted-foreground text-sm">
                                    Compare seu plano atual com as opções de upgrade
                                </p>
                            </div>
                            {userPlan && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleManagePayment}
                                    disabled={openingPortal}
                                >
                                    {openingPortal ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Abrindo...
                                        </>
                                    ) : (
                                        <>
                                            <CreditCard className="w-4 h-4 mr-2" />
                                            Gerenciar Pagamento
                                            <ExternalLink className="w-3 h-3 ml-1" />
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>

                        <div className="grid md:grid-cols-3 gap-4">
                            {allPlans.map((plan) => {
                                const Icon = tierIcons[plan.tier];
                                const isCurrent = isCurrentPlan(plan);
                                const canUpgrade = userPlan ? plan.order > userPlan.order : plan.tier !== "starter";

                                return (
                                    <Card
                                        key={plan.id}
                                        className={cn(
                                            "relative overflow-hidden transition-all duration-300 flex flex-col",
                                            isCurrent && "ring-2 ring-primary shadow-lg",
                                            !isCurrent && "hover:shadow-lg hover:scale-[1.02]",
                                            plan.highlighted && !isCurrent && "ring-2 ring-emerald-500/50"
                                        )}
                                    >
                                        {/* Current Plan Badge */}
                                        {isCurrent && (
                                            <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-center py-1 text-xs font-semibold">
                                                Plano Atual
                                            </div>
                                        )}

                                        {/* Popular Badge (only if not current) */}
                                        {plan.highlighted && !isCurrent && (
                                            <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-center py-1 text-xs font-semibold">
                                                Mais Popular
                                            </div>
                                        )}

                                        <CardHeader className={cn("text-center pb-2", (isCurrent || plan.highlighted) && "pt-8")}>
                                            <div
                                                className={cn(
                                                    "h-12 w-12 mx-auto rounded-xl bg-gradient-to-br flex items-center justify-center mb-2",
                                                    tierColors[plan.tier]
                                                )}
                                            >
                                                <Icon className="w-6 h-6 text-white" />
                                            </div>
                                            <CardTitle className="text-lg">{plan.name}</CardTitle>
                                            <CardDescription className="text-xs min-h-[32px]">
                                                {plan.description}
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent className="space-y-4 pt-0 flex-1">
                                            {/* Price */}
                                            <div className="text-center">
                                                <span className="text-2xl font-bold">
                                                    {formatPrice(plan.price)}
                                                </span>
                                                {plan.price > 0 && (
                                                    <span className="text-muted-foreground text-sm">/mês</span>
                                                )}
                                            </div>

                                            {/* Features */}
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Propostas</span>
                                                    <span className="font-medium">
                                                        {formatLimit(plan.features.maxProposals)}
                                                        {plan.features.maxProposals > 0 && "/mês"}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Clientes</span>
                                                    <span className="font-medium">
                                                        {formatLimit(plan.features.maxClients)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Usuários</span>
                                                    <span className="font-medium">
                                                        {formatLimit(plan.features.maxUsers)}
                                                    </span>
                                                </div>

                                                {/* Boolean features */}
                                                <div className="pt-2 border-t space-y-1">
                                                    {plan.features.customBranding && (
                                                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                                            <Check className="w-3 h-3" />
                                                            <span>Branding</span>
                                                        </div>
                                                    )}
                                                    {plan.features.prioritySupport && (
                                                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                                            <Check className="w-3 h-3" />
                                                            <span>Suporte prioritário</span>
                                                        </div>
                                                    )}
                                                    {plan.features.apiAccess && (
                                                        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                                                            <Check className="w-3 h-3" />
                                                            <span>API</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>

                                        <div className="p-4 pt-0 mt-auto">
                                            {isCurrent ? (
                                                <Button className="w-full" size="sm" variant="secondary" disabled>
                                                    Plano Atual
                                                </Button>
                                            ) : canUpgrade ? (
                                                <Button
                                                    className="w-full"
                                                    size="sm"
                                                    onClick={() => handleUpgrade(plan)}
                                                    disabled={upgradingPlan !== null || downgradingPlan !== null}
                                                >
                                                    {upgradingPlan === plan.tier ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            Processando...
                                                        </>
                                                    ) : (
                                                        'Fazer Upgrade'
                                                    )}
                                                </Button>
                                            ) : (
                                                <Button
                                                    className="w-full"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDowngrade(plan)}
                                                    disabled={upgradingPlan !== null || downgradingPlan !== null}
                                                >
                                                    {downgradingPlan === plan.tier ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                            Processando...
                                                        </>
                                                    ) : (
                                                        'Fazer Downgrade'
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Plan Change Confirmation Dialog */}
            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {loadingPreview ? 'Carregando...' : (
                                planPreview?.isUpgrade ? 'Confirmar Upgrade' :
                                    planPreview?.isDowngrade ? 'Confirmar Downgrade' :
                                        'Assinar Plano'
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedPlan && (
                                <>Alteração para o plano <strong>{selectedPlan.name}</strong></>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {loadingPreview ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : isFirstSubscription ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg">
                                <p className="text-sm text-muted-foreground">
                                    Você será redirecionado para a página de pagamento do Stripe.
                                </p>
                                <p className="text-lg font-semibold mt-2">
                                    Valor: {formatPrice(selectedPlan?.price || 0)}/mês
                                </p>
                            </div>
                        </div>
                    ) : planPreview ? (
                        <div className="space-y-4">
                            {/* Price Summary */}
                            <div className="p-4 bg-muted rounded-lg space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span>Plano atual ({planPreview.currentPlan.tier})</span>
                                    <span>{formatPrice(planPreview.currentPlan.price)}/mês</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>Novo plano ({planPreview.newPlan.tier})</span>
                                    <span>{formatPrice(planPreview.newPlan.price)}/mês</span>
                                </div>
                                {planPreview.creditAmount > 0 && (
                                    <div className="flex justify-between text-sm text-emerald-600">
                                        <span>Crédito (tempo não usado)</span>
                                        <span>-{formatPrice(planPreview.creditAmount)}</span>
                                    </div>
                                )}
                                <div className="border-t pt-2 flex justify-between font-semibold">
                                    <span>{planPreview.isUpgrade ? 'A cobrar agora' : 'Crédito para próxima fatura'}</span>
                                    <span className={planPreview.isUpgrade ? 'text-primary' : 'text-emerald-600'}>
                                        {planPreview.isUpgrade ? formatPrice(planPreview.amountDue) : formatPrice(planPreview.creditAmount)}
                                    </span>
                                </div>
                            </div>

                            {/* Payment Method */}
                            {planPreview.paymentMethod && (
                                <div className="p-4 border rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <CreditCard className="w-5 h-5 text-muted-foreground" />
                                            <div>
                                                <p className="text-sm font-medium capitalize">
                                                    {planPreview.paymentMethod.brand} •••• {planPreview.paymentMethod.last4}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Expira em {planPreview.paymentMethod.expMonth}/{planPreview.paymentMethod.expYear}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setConfirmDialogOpen(false);
                                                handleManagePayment();
                                            }}
                                        >
                                            Alterar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-muted-foreground text-center">
                                Próxima cobrança: {planPreview.nextBillingDate}
                            </p>
                        </div>
                    ) : null}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={confirmPlanChange}
                            disabled={loadingPreview || upgradingPlan !== null || downgradingPlan !== null}
                        >
                            {(upgradingPlan || downgradingPlan) ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processando...
                                </>
                            ) : (
                                planPreview?.isUpgrade ? 'Confirmar Upgrade' :
                                    planPreview?.isDowngrade ? 'Confirmar Downgrade' :
                                        'Ir para Pagamento'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
