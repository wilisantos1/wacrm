"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES, formatCurrency } from "@/lib/currency";
import type {
  Contact,
  Conversation,
  Deal,
  DealProduct,
  DealStatus,
  Product,
  PipelineStage,
  Profile,
} from "@/types";
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
import {
  Check,
  X,
  Trash2,
  MessageSquare,
  DollarSign,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

type DealProductInput = Pick<
  DealProduct,
  "id" | "product_id" | "product_name" | "quantity" | "unit_value"
>;

function getLineTotal(item: DealProductInput) {
  return (Math.round(item.unit_value * 100) * item.quantity) / 100;
}

function getProductsTotal(items: DealProductInput[]) {
  return (
    items.reduce(
      (total, item) => total + Math.round(item.unit_value * 100) * item.quantity,
      0,
    ) / 100
  );
}

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
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [dealProducts, setDealProducts] = useState<DealProductInput[]>([]);
  const [productDataLoading, setProductDataLoading] = useState(false);
  const [productDataError, setProductDataError] = useState(false);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
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
      setValue(String(deal.value ?? ""));
      setCurrency(deal.currency || defaultCurrency);
      // contact_id is nullable when the contact has been deleted
      // (migration 004: ON DELETE SET NULL). "" means "no selection".
      setContactId(deal.contact_id ?? "");
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_to ?? "");
      setExpectedCloseDate(deal.expected_close_date ?? "");
      setNotes(deal.notes ?? "");
      setContainerNumber(deal.container_number ?? "");
      setServiceAt(toDateTimeLocal(deal.service_at));
      setDriverName(deal.driver_name ?? "");
      setTruckPlate(deal.truck_plate ?? "");
      setBaseDepartureAt(toDateTimeLocal(deal.base_departure_at));
      setCustomerArrivalAt(toDateTimeLocal(deal.customer_arrival_at));
      setCustomerDepartureAt(toDateTimeLocal(deal.customer_departure_at));
      setBaseArrivalAt(toDateTimeLocal(deal.base_arrival_at));
      setDealProducts([]);
    } else {
      setTitle("");
      setValue("");
      setCurrency(defaultCurrency);
      setContactId("");
      setStageId(defaultStageId || stages[0]?.id || "");
      setAssignedTo("");
      setExpectedCloseDate("");
      setNotes("");
      setContainerNumber("");
      setServiceAt("");
      setDriverName("");
      setTruckPlate("");
      setBaseDepartureAt("");
      setCustomerArrivalAt("");
      setCustomerDepartureAt("");
      setBaseArrivalAt("");
      setDealProducts([]);
    }
    setProductDataError(false);
  }, [open, deal, defaultStageId, stages, defaultCurrency]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load supporting data once the dialog is open
  useEffect(() => {
    if (!open || !accountId) return;
    let cancelled = false;
    (async () => {
      setProductDataLoading(true);
      const [c, p, productResult, dealProductResult] = await Promise.all([
        supabase.from("contacts").select("*").order("name"),
        supabase.from("profiles").select("*").order("full_name"),
        supabase
          .from("products")
          .select("id, user_id, account_id, name, value, created_at, updated_at")
          .eq("account_id", accountId)
          .order("name"),
        deal
          ? supabase
              .from("deal_products")
              .select("id, product_id, product_name, quantity, unit_value")
              .eq("deal_id", deal.id)
              .eq("account_id", accountId)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (cancelled) return;
      setContacts((c.data ?? []) as Contact[]);
      setProfiles((p.data ?? []) as Profile[]);
      if (productResult.error || dealProductResult.error) {
        const error = productResult.error ?? dealProductResult.error;
        const missingTable =
          error?.code === "42P01" || error?.code === "PGRST205";
        console.error("[DealForm] Failed to load product data:", {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint,
        });
        toast.error(
          missingTable ? t("toastProductsMigrationRequired") : t("toastLoadProducts"),
        );
        setProductDataError(true);
      } else {
        setProducts((productResult.data ?? []) as Product[]);
        setDealProducts((dealProductResult.data ?? []) as DealProductInput[]);
      }
      setProductDataLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, deal, accountId, supabase, t]);

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
    if (!title.trim() || !contactId || !stageId) {
      toast.error(t("toastRequired"));
      return;
    }
    if (productDataLoading || productDataError) return;
    if (dealProducts.some((item) => !item.product_name.trim())) {
      toast.error(t("toastSelectProducts"));
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

    const productsTotal = getProductsTotal(dealProducts);
    const dealValue =
      dealProducts.length > 0 ? productsTotal : parseFloat(value) || 0;
    const payload = {
      title: title.trim(),
      value: dealValue,
      currency,
      contact_id: contactId,
      pipeline_id: pipelineId,
      stage_id: stageId,
      assigned_to: assignedTo || null,
      notes: notes.trim() || null,
      expected_close_date: expectedCloseDate || null,
      container_number: containerNumber.trim() || null,
      service_at: toISOStringOrNull(serviceAt),
      driver_name: driverName.trim() || null,
      truck_plate: truckPlate.trim() || null,
      base_departure_at: toISOStringOrNull(baseDepartureAt),
      customer_arrival_at: toISOStringOrNull(customerArrivalAt),
      customer_departure_at: toISOStringOrNull(customerDepartureAt),
      base_arrival_at: toISOStringOrNull(baseArrivalAt),
    };

    let dealId: string;
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
      dealId = deal.id;
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
      dealId = data.id;
    }

    const { error: productsError } = await supabase.rpc("save_deal_products", {
      p_deal_id: dealId,
      p_items: dealProducts.map((item) => ({
        product_id: products.some((product) => product.id === item.product_id)
          ? item.product_id
          : null,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_value: item.unit_value,
      })),
      p_value: dealValue,
    });
    if (productsError) {
      console.error("[DealForm] Failed to save deal products:", {
        message: productsError.message,
        code: productsError.code,
        details: productsError.details,
        hint: productsError.hint,
      });
      if (!deal) {
        const { error: rollbackError } = await supabase
          .from("deals")
          .delete()
          .eq("id", dealId);
        if (rollbackError) {
          console.error("[DealForm] Failed to remove incomplete deal:", rollbackError.message);
        }
      }
      toast.error(
        productsError.code === "PGRST202"
          ? t("toastProductsMigrationRequired")
          : t("toastFailedSaveProducts"),
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    toast.success(deal ? t("toastUpdated") : t("toastCreated"));
    onOpenChange(false);
    onSaved();
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal) return;
    setStatusAction(status);
    const { error } = await supabase
      .from("deals")
      .update({ status })
      .eq("id", deal.id);
    setStatusAction(null);
    if (error) {
      toast.error(t("toastFailedStatus"));
      return;
    }
    toast.success(
      status === "won" ? t("toastMarkedWon") : status === "lost" ? t("toastMarkedLost") : t("toastReopened"),
    );
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

  function addProduct() {
    setDealProducts((current) => [
      ...current,
      {
        id: `new-${Date.now()}-${current.length}`,
        product_id: null,
        product_name: "",
        quantity: 1,
        unit_value: 0,
      },
    ]);
  }

  function selectProduct(lineId: string, productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setDealProducts((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,
              product_id: product.id,
              product_name: product.name,
              unit_value: Number(product.value),
            }
          : line,
      ),
    );
  }

  function formatDealCurrency(amount: number) {
    return formatCurrency(amount, currency);
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

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-muted-foreground">{t("products")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProduct}
                  disabled={productDataLoading || productDataError || products.length === 0}
                >
                  {t("addProduct")}
                </Button>
              </div>

              {productDataLoading ? (
                <p className="text-sm text-muted-foreground">{t("loadingProducts")}</p>
              ) : products.length === 0 && dealProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noProducts")}</p>
              ) : (
                <div className="space-y-3">
                  {dealProducts.map((line) => (
                    <div
                      key={line.id}
                      className="space-y-2 rounded-md border border-border bg-background p-3"
                    >
                      <div className="flex items-center gap-2">
                        <select
                          value={
                            line.product_id ??
                            (line.product_name ? `snapshot-${line.id}` : "")
                          }
                          onChange={(event) => selectProduct(line.id, event.target.value)}
                          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                        >
                          <option value="" disabled>
                            {t("selectProduct")}
                          </option>
                          {!line.product_id && line.product_name && (
                            <option value={`snapshot-${line.id}`} disabled>
                              {line.product_name} ({t("productUnavailable")})
                            </option>
                          )}
                          {products.map((product) => (
                            <option
                              key={product.id}
                              value={product.id}
                              disabled={
                                product.id !== line.product_id &&
                                dealProducts.some(
                                  (selected) => selected.product_id === product.id,
                                )
                              }
                            >
                              {product.name}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("removeProduct")}
                          onClick={() =>
                            setDealProducts((current) =>
                              current.filter((item) => item.id !== line.id),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="grid gap-1">
                          <Label className="text-xs text-muted-foreground">
                            {t("quantity")}
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={line.quantity}
                            onChange={(event) => {
                              const quantity = Math.max(
                                1,
                                Math.floor(Number(event.target.value) || 1),
                              );
                              setDealProducts((current) =>
                                current.map((item) =>
                                  item.id === line.id ? { ...item, quantity } : item,
                                ),
                              );
                            }}
                            className="border-border bg-muted text-foreground"
                          />
                        </div>
                        <div className="grid gap-1">
                          <span className="text-xs text-muted-foreground">
                            {t("unitValue")}
                          </span>
                          <span className="flex h-9 items-center text-foreground">
                            {formatDealCurrency(line.unit_value)}
                          </span>
                        </div>
                        <div className="grid gap-1">
                          <span className="text-xs text-muted-foreground">
                            {t("lineTotal")}
                          </span>
                          <span className="flex h-9 items-center font-medium text-foreground">
                            {formatDealCurrency(getLineTotal(line))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {dealProducts.length > 0 && (
                    <div className="flex items-center justify-between border-t border-border pt-3 font-semibold">
                      <span className="text-foreground">{t("productsTotal")}</span>
                      <span className="text-foreground">
                        {formatDealCurrency(getProductsTotal(dealProducts))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-[1fr_110px] gap-3">
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("value")}</Label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type={dealProducts.length > 0 ? "text" : "number"}
                    min="0"
                    step="0.01"
                    readOnly={dealProducts.length > 0}
                    value={
                      dealProducts.length > 0
                        ? formatDealCurrency(getProductsTotal(dealProducts))
                        : value
                    }
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    className="border-border bg-muted pl-7 text-foreground"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-muted-foreground">{t("currency")}</Label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-muted-foreground">{t("expectedCloseDate")}</Label>
              <Input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="border-border bg-muted text-foreground"
              />
            </div>

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
              <Label className="text-muted-foreground">{t("assignedTo")}</Label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="">{t("unassigned")}</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
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

            {deal && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t("status")}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => handleStatusChange("won")}
                    disabled={!!statusAction || deal.status === "won"}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {statusAction === "won" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="mr-1 h-4 w-4" />
                        {t("markAsWon")}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleStatusChange("lost")}
                    disabled={!!statusAction || deal.status === "lost"}
                    className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {statusAction === "lost" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="mr-1 h-4 w-4" />
                        {t("markAsLost")}
                      </>
                    )}
                  </Button>
                </div>
                {deal.status && deal.status !== "open" && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleStatusChange("open")}
                    disabled={!!statusAction}
                    className="w-full text-muted-foreground hover:text-foreground"
                  >
                    {t("reopenDeal")}
                  </Button>
                )}
              </div>
            )}
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
                disabled={
                  saving ||
                  productDataLoading ||
                  productDataError ||
                  !title.trim() ||
                  !contactId ||
                  !stageId
                }
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
