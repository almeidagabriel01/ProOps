import { NextResponse } from 'next/server';
import { fetchPlansFromStripe } from '@/lib/stripe-sync';
import { DEFAULT_PLANS } from '@/services/plan-service';
import { PlanFeatures } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Tenta buscar do Stripe primeiro
    const stripePlans = await fetchPlansFromStripe();

    if (stripePlans.length > 0) {
      // Merge com DEFAULT_PLANS para garantir features e descrições
      const mergedPlans = stripePlans.map(stripePlan => {
        const defaultPlan = DEFAULT_PLANS.find(p => p.tier === stripePlan.tier);
        
        // Merge features: usar DEFAULT_PLANS como base, só sobrescrever se Stripe tiver valor real
        const mergedFeatures: PlanFeatures = defaultPlan?.features 
          ? { ...defaultPlan.features } 
          : {
              maxProposals: 0,
              maxClients: 0,
              maxProducts: 0,
              maxUsers: 0,
              hasFinancial: false,
              canCustomizeTheme: false,
              maxPdfTemplates: 1,
              canEditPdfSections: false,
              maxImagesPerProduct: 2,
              maxStorageMB: 200,
            };
        
        // Só sobrescrever se o valor do Stripe for significativo (não zero/false padrao)
        if (stripePlan.features) {
          const sf = stripePlan.features;
          // Só usar valores do Stripe se forem diferentes do default "vazio"
          if (sf.maxProposals !== 0) mergedFeatures.maxProposals = sf.maxProposals;
          if (sf.maxClients !== 0) mergedFeatures.maxClients = sf.maxClients;
          if (sf.maxProducts !== 0) mergedFeatures.maxProducts = sf.maxProducts;
          if (sf.maxUsers !== 0) mergedFeatures.maxUsers = sf.maxUsers;
          if (sf.hasFinancial) mergedFeatures.hasFinancial = sf.hasFinancial;
          if (sf.canCustomizeTheme) mergedFeatures.canCustomizeTheme = sf.canCustomizeTheme;
          if (sf.maxPdfTemplates !== 1) mergedFeatures.maxPdfTemplates = sf.maxPdfTemplates;
          if (sf.canEditPdfSections) mergedFeatures.canEditPdfSections = sf.canEditPdfSections;
          if (sf.maxImagesPerProduct !== 2) mergedFeatures.maxImagesPerProduct = sf.maxImagesPerProduct;
          if (sf.maxStorageMB !== 200) mergedFeatures.maxStorageMB = sf.maxStorageMB;
        }
        
        return {
          ...defaultPlan, // Features, description, etc.
          ...stripePlan,  // Preços e IDs do Stripe (sobrescreve)
          // Mas usar as features mescladas corretamente
          features: mergedFeatures,
          // Manter descrição do DEFAULT_PLANS se Stripe não tiver
          description: stripePlan.description || defaultPlan?.description || '',
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
