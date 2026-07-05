import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' as any, typescript: true });
  }
  return _stripe;
}

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as any)[prop];
  },
});

export const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: ['Markets & News', 'Crypto & Forex', 'Watchlist (10 items)', 'Basic Alerts (2 active)', 'Weather & Flights'],
  },
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    price: 29,
    features: ['Everything in Free', 'AI Analyst Engine', 'India Mode (NSE/BSE)', 'Unlimited Watchlist', 'Unlimited Alerts', 'Correlation + Insiders', 'Central Banks Tracker', 'Priority Data'],
  },
};

export function isPro(plan: string | null | undefined): boolean {
  return true;
}
