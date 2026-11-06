"use client";

import type { Deal, PipelineStage } from "@/types";
import { Calendar, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useTranslations } from "next-intl";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || "?").trim();
  if (!source) return "?";
  return source.charAt(0).toUpperCase();
}

export function DealCard({ deal, stage, onEdit, isOverlay }: DealCardProps) {
  const t = useTranslations("Pipelines.card");
  const contactLabel = deal.contact?.name || deal.contact?.phone || t("noContact");
  const assigneeLabel = deal.assignee?.full_name || null;
  const tripTimes = [
    ["baseDepartureAt", deal.base_departure_at],
    ["customerArrivalAt", deal.customer_arrival_at],
    ["customerDepartureAt", deal.customer_departure_at],
    ["baseArrivalAt", deal.base_arrival_at],
  ] as const;
  const hasTripTimes = tripTimes.some(([, value]) => value);
  const details: [string, string | null | undefined][] = [
    [t("container"), deal.container_number],
    [t("serviceAt"), deal.service_at ? formatDateTime(deal.service_at) : null],
    [t("driver"), deal.driver_name],
    [t("truckPlate"), deal.truck_plate],
  ];

  return (
    <button
      type="button"
      onClick={(e) => {
        // `onClick` still fires after a non-drag tap because the PointerSensor
        // requires 5px movement before it counts as a drag.
        if (isOverlay) return;
        e.stopPropagation();
        onEdit(deal);
      }}
      className={`group relative w-full cursor-pointer rounded-xl border border-border/50 bg-muted/70 pl-4 pr-3 py-3 text-left shadow-sm transition-all ${
        isOverlay
          ? "shadow-xl"
          : "hover:-translate-y-0.5 hover:border-border hover:bg-muted hover:shadow-lg"
      }`}
    >
      {/* 4px left accent bar using stage color */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] text-muted-foreground">{t("customer")}</span>
          <h4 className="truncate text-sm font-semibold leading-snug text-foreground">
            {contactLabel}
          </h4>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {t("os")}: {deal.title || "—"}
          </span>
          {deal.status === "won" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              <Check className="h-3 w-3" />
              {t("won")}
            </span>
          )}
          {deal.status === "lost" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              <X className="h-3 w-3" />
              {t("lost")}
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] leading-snug">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <span className="block text-muted-foreground">{label}</span>
            <span
              className="block truncate font-medium text-foreground"
              title={value || undefined}
            >
              {value || "—"}
            </span>
          </div>
        ))}
      </div>

      {hasTripTimes && (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-background/50 px-2 py-1.5 text-[10px] leading-snug">
          {tripTimes.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <span className="block text-muted-foreground">{t(key)}</span>
              <span
                className="block truncate text-foreground"
                title={value ? formatDateTime(value) : undefined}
              >
                {value ? formatDateTime(value) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold text-primary">
          {formatCurrency(deal.value, deal.currency)}
        </span>
        {deal.expected_close_date && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(`${deal.expected_close_date}T00:00:00`).toLocaleDateString(
              "pt-BR",
            )}
          </span>
        )}
      </div>

      {assigneeLabel && (
        <div className="mt-2 flex items-center justify-end">
          <span
            title={assigneeLabel}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
          >
            {initials(assigneeLabel)}
          </span>
        </div>
      )}
    </button>
  );
}
