"use client";

import type { Deal } from "@/types";
import { CalendarDays, CheckCircle2, Clock3, Percent } from "lucide-react";
import { getDealServiceStatus } from "@/lib/deal-service-status";
import { useTranslations } from "next-intl";

interface PipelineAnalyticsProps {
  deals: Deal[];
}

export function PipelineAnalytics({ deals }: PipelineAnalyticsProps) {
  const t = useTranslations("Pipelines.analytics");
  const appointments = deals.filter((deal) => deal.service_at);
  const { onTimeCount, lateCount } = appointments.reduce(
    (counts, deal) => {
      const status = getDealServiceStatus(deal);
      if (status === "on-time") counts.onTimeCount += 1;
      if (status === "late") counts.lateCount += 1;
      return counts;
    },
    { onTimeCount: 0, lateCount: 0 },
  );
  const classifiedAppointments = onTimeCount + lateCount;
  const onTimePercentage =
    classifiedAppointments === 0
      ? "0.0%"
      : `${((onTimeCount / classifiedAppointments) * 100).toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <Metric
        icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />}
        label={t("totalAppointments")}
        value={appointments.length}
      />
      <Metric
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
        label={t("onTimeAppointments")}
        value={onTimeCount}
        valueClassName="text-emerald-400"
      />
      <Metric
        icon={<Clock3 className="h-4 w-4 text-red-400" />}
        label={t("lateAppointments")}
        value={lateCount}
        valueClassName="text-red-400"
      />
      <Metric
        icon={<Percent className="h-4 w-4 text-primary" />}
        label={t("onTimePercentage")}
        value={onTimePercentage}
      />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p
        className={`mt-2 text-2xl font-semibold text-foreground ${valueClassName ?? ""}`}
      >
        {value}
      </p>
    </div>
  );
}
