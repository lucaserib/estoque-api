export const TRIAL_DAYS = 7;

export const PRICING = {
  MONTHLY_FIRST_CYCLE: 19.7,
  MONTHLY_RENEWAL: 37.9,
  ANNUAL: 389.7,
} as const;

export function trialEndsAt(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}
