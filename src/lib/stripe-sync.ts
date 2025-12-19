import { getStripe } from "./stripe";
import Stripe from "stripe";
import { UserPlan } from "@/types";

export async function fetchPlansFromStripe(): Promise<UserPlan[]> {
  const stripe = getStripe();

  try {
    // 1. Buscar produtos ativos
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price'],
    });

    // 2. Buscar preços ativos
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
    });

    // 3. Mapear produtos para o formato UserPlan
    const plans: UserPlan[] = [];

    // Ordem desejada baseada no metadata 'order' ou fallback para nome
    const tierOrder: Record<string, number> = {
      'starter': 1,
      'pro': 2,
      'enterprise': 3
    };

    for (const product of products.data) {
      const tier = product.metadata.tier || product.name.toLowerCase();
      
      // Ignorar produtos sem tier definido ou que não sejam os principais
      if (!['starter', 'pro', 'enterprise'].includes(tier)) continue;

      const productPrices = prices.data.filter(p => p.product === product.id);
      
      const monthlyPrice = productPrices.find(p => p.recurring?.interval === 'month');
      const yearlyPrice = productPrices.find(p => p.recurring?.interval === 'year');

      if (!monthlyPrice) continue; // Precisa ter pelo menos preço mensal

      plans.push({
        id: product.id, // Usando ID do produto como ID do plano
        name: product.name,
        tier: tier as 'starter' | 'pro' | 'enterprise',
        description: product.description || '',
        price: (monthlyPrice.unit_amount || 0) / 100,
        pricing: {
          monthly: (monthlyPrice.unit_amount || 0) / 100,
          yearly: (yearlyPrice?.unit_amount || 0) / 100,
        },
        order: parseInt(product.metadata.order || '0') || tierOrder[tier] || 99,
        highlighted: product.metadata.highlighted === 'true',
        features: {
            // Features podem vir do metadata do produto (JSON string) ou hardcoded por enquanto
            // Idealmente viriam do Stripe metadata
            maxProposals: parseInt(product.metadata.maxProposals || '0'),
            maxClients: parseInt(product.metadata.maxClients || '0'),
            maxProducts: parseInt(product.metadata.maxProducts || '0'),
            maxUsers: parseInt(product.metadata.maxUsers || '0'),
            hasFinancial: product.metadata.hasFinancial === 'true',
            canCustomizeTheme: product.metadata.canCustomizeTheme === 'true',
            maxPdfTemplates: parseInt(product.metadata.maxPdfTemplates || '1'),
            canEditPdfSections: product.metadata.canEditPdfSections === 'true',
            maxImagesPerProduct: parseInt(product.metadata.maxImagesPerProduct || '2'),
            maxStorageMB: parseInt(product.metadata.maxStorageMB || '200'),
        },
        createdAt: new Date().toISOString(), // Placeholder
      });
    }

    return plans.sort((a, b) => a.order - b.order);
  } catch (error) {
    console.error("Error fetching plans from Stripe:", error);
    return [];
  }
}
