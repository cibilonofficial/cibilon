import type { PayoutRateCardEntry, ProductConfig, ServiceType } from '../types/index.js';

export function payoutRange(product: ProductConfig | undefined, amount: number) {
  if (!product || !Number.isFinite(amount) || amount <= 0) return null;
  const options = product.commissionOptions ?? [];
  const percentages = options
    .filter((rule) => rule.calculationType === 'PERCENTAGE' && rule.percentageRate != null)
    .map((rule) => rule.percentageRate as number);
  if (percentages.length) {
    const minRate = Math.min(...percentages);
    const maxRate = Math.max(...percentages);
    return {
      minimum: Math.round((amount * minRate) / 100),
      maximum: Math.round((amount * maxRate) / 100),
      minRate,
      maxRate,
      kind: 'percentage' as const,
    };
  }
  const flats = options
    .filter((rule) => rule.calculationType === 'FLAT' && rule.flatAmount != null)
    .map((rule) => rule.flatAmount as number);
  const fallback = product.flatPayout != null ? [product.flatPayout] : [];
  const values = flats.length ? flats : fallback;
  if (!values.length) return null;
  return {
    minimum: Math.min(...values), maximum: Math.max(...values),
    minRate: null, maxRate: null, kind: 'flat' as const,
  };
}

export function calculateEmi(principal: number, annualRate: number, tenureMonths: number) {
  if (![principal, annualRate, tenureMonths].every(Number.isFinite) || principal <= 0 || annualRate < 0 || tenureMonths <= 0) return null;
  const monthlyRate = annualRate / 1200;
  const emi = monthlyRate === 0
    ? principal / tenureMonths
    : principal * monthlyRate * (1 + monthlyRate) ** tenureMonths
      / ((1 + monthlyRate) ** tenureMonths - 1);
  const total = emi * tenureMonths;
  return { emi, total, interest: total - principal };
}

export function payoutRangeFromRateCard(entries: PayoutRateCardEntry[], service: ServiceType | '', amount: number) {
  if (!service || !Number.isFinite(amount) || amount <= 0) return null;
  const categoryName = service === 'Loan Against Property' ? 'Loan Against Property' : service;
  const rates = entries
    .filter((entry) => entry.categoryName === categoryName && entry.percentageRate != null)
    .map((entry) => entry.percentageRate as number);
  if (!rates.length) return null;
  const minRate = Math.min(...rates);
  const maxRate = Math.max(...rates);
  return {
    minimum: Math.round(amount * minRate) / 100,
    maximum: Math.round(amount * maxRate) / 100,
    minRate, maxRate,
  };
}
