/**
 * ERP-29 RFQ, tenders and proposals (light) — docs/04-erp-control-tower.md.
 * Source §6 (Enterprise: RFQ / tender), §11 Dept 1 (RFQ / tender, proposals;
 * AI proposal drafts). A list and one detail page.
 */
import { EmptyState } from "@shared/ui/EmptyState";
import { Bot, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { proposalDraft } from "@shared/engines/departments";
import { useData, useDemoNow } from "@shared/hooks/useDemo";
import { formatDate, formatDateTime, formatINR } from "@shared/lib/format";
import { addDaysToDate, istDate } from "@shared/lib/time";
import { useDemoStore } from "@shared/store";
import type { Rfq, Service } from "@shared/types";
import { Button } from "@shared/ui/button";
import { Field } from "@shared/ui/FormField";
import { Input } from "@shared/ui/input";
import { NativeSelect } from "@shared/ui/NativeSelect";
import { PageHeader } from "@shared/ui/Page";
import { SimulatedTag } from "@shared/ui/SimulatedTag";
import { Chip } from "@shared/ui/StatusChip";
import type { Tone } from "@shared/ui/tones";
import { useErpSession } from "./useErpSession";

const STATUS_TONE: Record<Rfq["status"], Tone> = {
  received: "info",
  pricing: "warning",
  submitted: "info",
  won: "success",
  lost: "neutral",
};
const SERVICES: Service[] = [
  "expressPtl",
  "standardPtl",
  "express",
  "standard",
  "economy",
];

export default function ERP29Rfqs() {
  const { t } = useTranslation();
  const data = useData((d) => d);
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const open = data.rfqs[params.get("id") ?? ""];
  if (open) return <RfqDetail r={open} onBack={() => setParams({})} />;
  const list = Object.values(data.rfqs).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
  const who = (r: Rfq) =>
    r.customerId ? data.customers[r.customerId]?.shortName : r.prospect;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("erp29.title")}
        subtitle={t("erp29.subtitle")}
        actions={
          <Button onClick={() => setAdding(!adding)}>
            <Plus /> {t("erp29.new")}
          </Button>
        }
        className="mb-0"
      />
      {adding && (
        <NewRfq onDone={(id) => (setAdding(false), id && setParams({ id }))} />
      )}
      {list.length === 0 ? (
        <EmptyState
          title={t("erp29.empty")}
          action={
            <Button onClick={() => setAdding(true)}>{t("erp29.new")}</Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table
            className="w-full text-table [&_td]:pr-3 [&_th]:pr-3"
            data-testid="rfqs"
          >
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t("erp29.col.rfq")}</th>
                <th>{t("erp29.col.customer")}</th>
                <th>{t("erp29.col.lanes")}</th>
                <th>{t("erp29.col.due")}</th>
                <th>{t("erp29.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r.id}
                  className="border-b last:border-0"
                  aria-label={r.id}
                >
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      className="tabular font-medium text-primary hover:underline"
                      onClick={() => setParams({ id: r.id })}
                    >
                      {r.id}
                    </button>
                    <span className="block text-caption text-muted-foreground">
                      {r.title}
                    </span>
                  </td>
                  <td>{who(r)}</td>
                  <td>
                    {r.lanes.map((l) => `${l.origin} → ${l.dest}`).join(", ")}
                  </td>
                  <td className="tabular">{formatDate(r.dueDate)}</td>
                  <td>
                    <Chip tone={STATUS_TONE[r.status]}>
                      {t(`erp29.status.${r.status}`)}
                    </Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewRfq({ onDone }: { onDone: (id?: string) => void }) {
  const { t } = useTranslation();
  const { user } = useErpSession();
  const data = useData((d) => d);
  const now = useDemoNow();
  const [customerId, setCustomerId] = useState("");
  const [prospect, setProspect] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(addDaysToDate(istDate(now), 14));
  const [lane, setLane] = useState({
    origin: "Delhi NCR",
    dest: "",
    monthlyShipments: "",
    service: "standardPtl" as Service,
  });
  const origins = [
    ...new Set(Object.values(data.lanes).map((l) => l.originRegion)),
  ];
  const ok =
    (customerId || prospect.trim()) &&
    title.trim() &&
    lane.dest.trim() &&
    Number(lane.monthlyShipments) > 0;
  return (
    <section
      className="grid gap-3 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-3"
      aria-label={t("erp29.new")}
    >
      <Field label={t("erp29.customer")} htmlFor="rfq-c">
        <NativeSelect
          id="rfq-c"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
        >
          <option value="">{t("erp29.prospectOption")}</option>
          {Object.values(data.customers).map((c) => (
            <option key={c.id} value={c.id}>
              {c.shortName}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {!customerId && (
        <Field label={t("erp29.prospect")} htmlFor="rfq-p">
          <Input
            id="rfq-p"
            value={prospect}
            onChange={(e) => setProspect(e.target.value)}
          />
        </Field>
      )}
      <Field label={t("erp29.titleField")} htmlFor="rfq-t">
        <Input
          id="rfq-t"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label={t("erp29.col.due")} htmlFor="rfq-d">
        <Input
          id="rfq-d"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </Field>
      <Field label={t("erp29.origin")} htmlFor="rfq-o">
        <NativeSelect
          id="rfq-o"
          value={lane.origin}
          onChange={(e) => setLane({ ...lane, origin: e.target.value })}
        >
          {origins.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t("erp29.dest")} htmlFor="rfq-dest">
        <Input
          id="rfq-dest"
          value={lane.dest}
          onChange={(e) => setLane({ ...lane, dest: e.target.value })}
        />
      </Field>
      <Field label={t("erp29.monthly")} htmlFor="rfq-m">
        <Input
          id="rfq-m"
          type="number"
          value={lane.monthlyShipments}
          onChange={(e) =>
            setLane({ ...lane, monthlyShipments: e.target.value })
          }
        />
      </Field>
      <Field label={t("erp29.service")} htmlFor="rfq-s">
        <NativeSelect
          id="rfq-s"
          value={lane.service}
          onChange={(e) =>
            setLane({ ...lane, service: e.target.value as Service })
          }
        >
          {SERVICES.map((s) => (
            <option key={s} value={s}>
              {t(`service.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="flex items-end gap-2">
        <Button
          disabled={!ok}
          onClick={() => {
            const id = useDemoStore
              .getState()
              .createRfq(
                {
                  customerId: customerId || undefined,
                  prospect,
                  title,
                  dueDate: due,
                  lanes: [
                    {
                      origin: lane.origin,
                      dest: lane.dest.trim(),
                      monthlyShipments: Number(lane.monthlyShipments),
                      service: lane.service,
                    },
                  ],
                },
                user.id,
              );
            if (id) toast.success(t("erp29.created", { id }));
            onDone(id);
          }}
        >
          {t("erp29.save")}
        </Button>
        <Button variant="outline" onClick={() => onDone()}>
          {t("common.cancel")}
        </Button>
      </div>
    </section>
  );
}

function RfqDetail({ r, onBack }: { r: Rfq; onBack: () => void }) {
  const { t } = useTranslation();
  const { user } = useErpSession();
  const data = useData((d) => d);
  const [note, setNote] = useState("");
  const draft = r.proposalAt ? proposalDraft(data, r) : undefined;
  const act = (status: Rfq["status"]) => {
    useDemoStore.getState().setRfqStatus(r.id, status, note, user.id);
    setNote("");
    toast.success(t("erp29.moved", { status: t(`erp29.status.${status}`) }));
  };
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="w-fit text-caption font-medium text-primary hover:underline"
      >
        ← {t("erp29.back")}
      </button>
      <PageHeader
        title={`${r.id} · ${r.title}`}
        subtitle={`${r.customerId ? data.customers[r.customerId]?.shortName : r.prospect} · ${t("erp29.dueOn", { date: formatDate(r.dueDate) })}`}
        actions={
          <Chip tone={STATUS_TONE[r.status]}>
            {t(`erp29.status.${r.status}`)}
          </Chip>
        }
        className="mb-0"
      />
      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table
          className="w-full text-table [&_td]:pr-3 [&_th]:pr-3"
          data-testid="rfq-lanes"
        >
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t("erp29.col.lanes")}</th>
              <th>{t("erp29.service")}</th>
              <th className="text-right">{t("erp29.monthly")}</th>
            </tr>
          </thead>
          <tbody>
            {r.lanes.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2">
                  {l.origin} → {l.dest}
                </td>
                <td>{t(`service.${l.service}`)}</td>
                <td className="tabular text-right">{l.monthlyShipments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section
        className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card"
        aria-label={t("erp29.proposal")}
      >
        <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
          <Bot className="size-5 text-muted-foreground" aria-hidden />{" "}
          {t("erp29.proposal")} <SimulatedTag />
        </h2>
        {draft ? (
          <div data-testid="proposal">
            <p className="mb-2">
              {t("erp29.cover", {
                customer: r.customerId
                  ? data.customers[r.customerId]?.shortName
                  : r.prospect,
                card: data.rateCards[draft.cardId]?.name,
              })}
            </p>
            <table className="w-full text-table [&_td]:py-1 [&_td]:pr-3">
              <tbody>
                {draft.lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td>
                      {l.origin} → {l.dest} · {t(`service.${l.service}`)}
                    </td>
                    <td className="tabular">
                      {l.perKg
                        ? t("erp29.rate", {
                            rate: formatINR(l.perKg),
                            min: l.minKg,
                          })
                        : t("erp29.noRate")}
                    </td>
                    <td className="tabular">
                      {l.transitDays
                        ? t("erp29.transit", { days: l.transitDays })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-caption text-muted-foreground">
              {t("erp29.draftNote", { at: formatDateTime(r.proposalAt!) })}
            </p>
          </div>
        ) : (
          <Button
            variant="outline"
            className="self-start"
            onClick={() => useDemoStore.getState().draftProposal(r.id, user.id)}
          >
            {t("erp29.draft")}
          </Button>
        )}
      </section>

      {(r.status === "received" ||
        r.status === "pricing" ||
        r.status === "submitted") && (
        <section className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-5 shadow-card">
          <Field
            label={t("erp29.note")}
            htmlFor="rfq-note"
            className="min-w-72 flex-1"
          >
            <Input
              id="rfq-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {r.status === "received" && (
            <Button onClick={() => act("pricing")}>
              {t("erp29.toPricing")}
            </Button>
          )}
          {r.status === "pricing" && (
            <Button onClick={() => act("submitted")}>
              {t("erp29.submit")}
            </Button>
          )}
          {r.status === "submitted" && (
            <>
              <Button onClick={() => act("won")}>{t("erp29.won")}</Button>
              <Button
                variant="outline"
                disabled={!note.trim()}
                onClick={() => act("lost")}
              >
                {t("erp29.lost")}
              </Button>
            </>
          )}
        </section>
      )}

      <section className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="mb-2 font-heading text-section font-semibold">
          {t("erp29.log")}
        </h2>
        <ol className="flex flex-col gap-1 text-table">
          {r.log.map((l, i) => (
            <li key={i}>
              <span className="tabular text-muted-foreground">
                {formatDateTime(l.at)}
              </span>{" "}
              · {data.staff[l.by]?.name} · {l.text}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
