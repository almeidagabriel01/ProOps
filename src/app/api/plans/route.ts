import { NextResponse } from 'next/server';
import { fetchPlansFromStripe } from '@/lib/stripe-sync';
import { DEFAULT_PLANS } from '@/services/plan-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Tenta buscar do Stripe primeiro
    const stripePlans = await fetchPlansFromStripe();

    if (stripePlans.length > 0) {
      // Merge com DEFAULT_PLANS para garantir features e descrições
      const mergedPlans = stripePlans.map(stripePlan => {
        const defaultPlan = DEFAULT_PLANS.find(p => p.tier === stripePlan.tier);
        return {
          ...defaultPlan, // Features, description, etc.
          ...stripePlan,  // Preços e IDs do Stripe (sobrescreve)
          features: {
             ...defaultPlan?.features,
             ...stripePlan.features // Se o Stripe tiver features no metadata, usa elas
          }
        };
      });
      
      return NextResponse.json(mergedPlans);
    }

    // Fallback: Retorna os planos padrão se Stripe falhar ou estiver vazio
    return NextResponse.json(DEFAULT_PLANS.map(p => ({...p, id: p.tier})), { status: 200 });
  } catch (error) {
    console.error('Error in plans API:', error);
    // Fallback em caso de erro
    return NextResponse.json(DEFAULT_PLANS.map(p => ({...p, id: p.tier})), { status: 200 });
  }
}
