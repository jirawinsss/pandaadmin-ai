export type Plan = "free" | "starter" | "pro";

export type PlanLimits = {
  reply: number;
  post: number;
  products: number;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free:    { reply: 10,   post: 5,   products: 3   },
  starter: { reply: 300,  post: 100, products: 30  },
  pro:     { reply: 1500, post: 300, products: 200 },
};

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
};

export function planLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[(plan as Plan) ?? "free"] ?? PLAN_LIMITS.free;
}

export function planLabel(plan: string | null | undefined): string {
  return PLAN_LABEL[(plan as Plan) ?? "free"] ?? "Free";
}
