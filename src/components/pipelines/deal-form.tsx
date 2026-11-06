"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Contact, Conversation, Deal, PipelineStage } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function toISOStringOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const t = useTranslations("Pipelines.form");
  const supabase = createClient();
  const { accountId, defaultCurrency } = useAuth();

  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [notes, setNotes] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [serviceAt, setServiceAt] = useState("");
  const [driverName, setDriverName] = useState("");
  const [truckPlate, setTruckPlate] = useState("");
  const [baseDepartureAt, setBaseDepartureAt] = useState("");
  const [customerArrivalAt, setCustomerArrivalAt] = useState("");
  const [customerDepartureAt, setCustomerDepartureAt] = useState("");
  const [baseArrivalAt, setBaseArrivalAt] = useState("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset the form fields every time the dialog opens or its input
  // props change. This is a legitimate prop-driven sync; the rule is
  // over-cautious here, hence the block-level disable.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (deal) {
      setTitle(deal.title);
      setCurrency(deal.currency || defaultCurrency);
      // contact_id is nullable when the contact has been deleted
      // (migration 004: ON DELETE SET NULL). "" means "no selection".
      setContactId(deal.contact_id ?? "");
      setStageId(deal.stage_id);
      setNotes(deal.notes ?? "");
      setContainerNumber(deal.container_number ?? "");
      setServiceAt(toDateTimeLocal(deal.service_at));
      setDriverName(deal.driver_name ?? "");
      setTruckPlate(deal.truck_plate ?? "");
      setBaseDepartureAt(toDateTimeLocal(deal.base_departure_at));
      setCustomerArrivalAt(toDateTimeLocal(deal.customer_arrival_at));
      setCustomerDepartureAt(toDateTimeLocal(deal.customer_departure_at));
      setBaseArrivalAt(toDateTimeLocal(deal.base_arrival_at));
    } else {
      setTitle("");
      setCurrency(defaultCurrency);
      setContactId("");
      setStageId(defaultStageId || stages[0]?.id || "");
      setNotes("");
      setContainerNumber("");
      setServiceAt("");
      setDriverName("");
      setTruckPlate("");
      setBaseDepartureAt("");
      setCustomerArrivalAt("");
      setCustomerDepartureAt("");
      setBaseArrivalAt("");
    }
  }, [open, deal, defaultStageId, stages, defaultCurrency]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data once the dialog is open
  useEffect(() => {
    if (!open || !accountId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("contacts").select("*").order("name");
      if (cancelled) return;
      setContacts((data ?? []) as Contact[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, accountId, supabase]);

  // Fetch linked conversation for the selected contact (newest open one).
  // Clearing on no-selection is sync with prop state; the populated
  // case runs setLinkedConversation inside the async fetch callback.
  useEffect(() => {
    if (!open || !contactId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLinkedConversation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setLinkedConversation((data as Conversation | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);

  async function handleSave() {
    if (!contactId || !stageId) {
      toast.error(t("toastRequired"));
      return;
    }
    const dateTimeValues = [
      serviceAt,
      baseDepartureAt,
      customerArrivalAt,
      customerDepartureAt,
      baseArrivalAt,
    ];
    if (
      dateTimeValues.some(
        (dateTime) => dateTime && Number.isNaN(new Date(dateTime).getTime()),
      )
    ) {
      toast.error(t("toastInvalidDateTime"));
      return;
    }
    setSaving(true);

    const payload = {
      title: title.trim(),
      value: deal?.value ?? 0,
      currency,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: deal?.assigned_to ?? null,
      notes: notes.trim() || null,
      expected_close_date: deal?.expected_close_date ?? null,
      container_number: containerNumber.trim() || null,
      service_at: toISOStringOrNull(serviceAt),
      driver_name: driverName.trim() || null,
      truck_plate: truckPlate.trim() || null,
      base_departure_at: toISOStringOrNull(baseDepartureAt),
      customer_arrival_at: toISOStringOrNull(customerArrivalAt),
      customer_departure_at: toISOStringOrNull(customerDepartureAt),
      base_arrival_at: toISOStringOrNull(baseArrivalAt),
    };

    if (deal) {
      const { error } = await supabase
        .from("deals")
        .update({ ...payload, value: deal.value })
        .eq("id", deal.id);
      if (error) {
        toast.error(
          error.code === "42703" || error.code === "PGRST204"
            ? t("toastTransportMigrationRequired")
            : t("toastFailedSave"),
        );
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        toast.error(t("toastNotSignedIn"));
        setSaving(false);
        return;
      }
      if (!accountId) {
        toast.error(t("toastNotLinked"));
        setSaving(false);
        return;
      }
      const { data, error } = await supabase
        .from("deals")
        .insert({
          ...payload,
          user_id: user.id,
          account_id: accountId,
          status: "open",
        })
        .select("id")
        .single();
      if (error || !data) {
        toast.error(
          error?.code === "42703" || error?.code === "PGRST204"
            ? t("toastTransportMigrationRequired")
            : t("toastFailedCreate"),
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    toast.success(deal ? t("toastUpdated") : t("toastCreated"));
    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error(t("toastFailedDelete"));
      return;
    }
    toast.success(t("toastDeleted"));
    setConfirmDelete(false);
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden border-border bg-popover p-0 text-popover-foreground sm:max-w-3xl">
        <div className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className="shrink-0 border-b border-border/50 p-4">
            <DialogTitle className="text-popover-foreground">
              {deal ? t("editDeal") : t("newDeal")}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("contact")}</Label>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">{t("selectContact")}</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.phone}
                    </option>
                  ))}
                </select>

                {linkedConversation && (
                  <Link
                    href="/inbox"
                    className="mt-1 inline-flex items-center gap-1.5 self-start rounded-md bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20"
                  >
                    <MessageSquare className="h-3 w-3" />
                    {t("linkToConversation")}
                  </Link>
                )}
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("os")}</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("osPlaceholder")}
                  className="border-border bg-muted text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("container")}</Label>
                <Input
                  value={containerNumber}
                  onChange={(e) => setContainerNumber(e.target.value)}
                  placeholder={t("containerPlaceholder")}
                  className="border-border bg-muted text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("serviceAt")}</Label>
                <Input
                  type="datetime-local"
                  value={serviceAt}
                  onChange={(e) => setServiceAt(e.target.value)}
                  className="border-border bg-muted text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("driver")}</Label>
                <Input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder={t("driverPlaceholder")}
                  className="border-border bg-muted text-foreground"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("truckPlate")}</Label>
                <Input
                  value={truckPlate}
                  onChange={(e) => setTruckPlate(e.target.value)}
                  placeholder={t("truckPlatePlaceholder")}
                  className="border-border bg-muted text-foreground"
                />
              </div>
            </div>

            <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <h3 className="text-sm font-medium text-foreground">
                {t("tripSchedule")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["baseDepartureAt", baseDepartureAt, setBaseDepartureAt],
                  ["customerArrivalAt", customerArrivalAt, setCustomerArrivalAt],
                  ["customerDepartureAt", customerDepartureAt, setCustomerDepartureAt],
                  ["baseArrivalAt", baseArrivalAt, setBaseArrivalAt],
                ] as const).map(([field, value, setValue]) => (
                  <div key={field} className="grid gap-2">
                    <Label className="text-muted-foreground">{t(field)}</Label>
                    <Input
                      type="datetime-local"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="border-border bg-muted text-foreground"
                    />
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("stage")}</Label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("notes")}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("notesPlaceholder")}
                className="min-h-[100px] border-border bg-muted text-foreground"
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-border/50 bg-popover/80 p-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-muted"
              >
                {t("cancel")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !contactId || !stageId}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? t("saving") : deal ? t("saveChanges") : t("createDeal")}
              </Button>
            </div>

            {deal &&
              (confirmDelete ? (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                  <span className="text-red-300">{t("deletePrompt")}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className="rounded px-2 py-1 text-muted-foreground hover:bg-muted"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? t("deleting") : t("confirm")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("deleteDeal")}
                </button>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
