"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "positive" | "negative" | "warning" | "accent";
  className?: string;
}

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  accent: "text-amber-700 dark:text-amber-300",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "default", className }: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-xl font-bold tabular-nums sm:text-2xl", toneClasses[tone])}>
              {value}
            </p>
            {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {Icon && (
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
