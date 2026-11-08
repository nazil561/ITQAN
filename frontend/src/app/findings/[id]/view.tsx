"use client";

import { ExportProtocolButton } from "@/components/export-protocol-button";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EVIDENCE_META, EvidenceBadge, Notice, SourceList, isComputationalOnly, isTraceable } from "@/components/evidence";
import { QueryView } from "@/components/states";
import { Botanical, Button, PageHeader, Panel, Section, formatDate, formatPercent } from "@/components/ui";
import { useFinding, useInterpretation } from "@/lib/api";
import type { EvidenceItem, Finding } from "@/lib/api/schemas";

function CompoundCard({ c }: { c: Finding["compound_a"] }) {
  return (
    <Link href={`/compounds/${c.id}`} className="block rounded-lg border border-line bg-surface p-4 text-center hover:border-leaf">
      <span className="block text-sm font-medium">{c.name}</span>
      <Botanical className="text-[13px] text-muted">{c.botanical_name}</Botanical>
    </Link>
  );
}

function Diagram({ finding: f }: { finding: Finding }) {
  return (
    <Panel className="mb-10 bg-paper p-4 sm:p-6">
      <div className="grid items-center gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-3">
        <CompoundCard c={f.compound_a} />
        <ArrowRight aria-hidden strokeWidth={1.5} className="mx-auto size-5 text-muted max-md:rotate-90" />
        <div className="rounded-lg bg-leaf-soft p-4 text-center">
          <span className="mb-1 block font-label text-[11px] font-normal tracking-[0.15em] text-ochre uppercase">Shared target</span>
          <span className="block text-sm font-medium">{f.target.symbol}</span>
          <span className="block text-[13px] text-body">{f.target.name}</span>
        </div>
        <ArrowLeft aria-hidden strokeWidth={1.5} className="mx-auto size-5 text-muted max-md:rotate-90" />
        <CompoundCard c={f.compound_b} />
      </div>
      {f.pathways.length > 0 && (
        <p className="mt-4 text-center text-[13px] text-muted">Pathways: {f.pathways.join(", ")}</p>
      )}
    </Panel>
  );
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  return (
    <li className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceBadge category={item.category} />
        <span className="text-[13px] text-muted">{item.subject}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed">{item.statement}</p>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
        {item.method && <div><dt className="inline">Method: </dt><dd className="inline text-body">{item.method}</dd></div>}
        {item.value && <div><dt className="inline">Value: </dt><dd className="inline text-body">{item.value}</dd></div>}
        <div><dt className="inline">Confidence: </dt><dd className="inline text-body tabular-nums">{formatPercent(item.confidence)}</dd></div>
      </dl>
      <div className="mt-3 border-t border-line pt-3">
        <p className="mb-1 text-[13px] font-medium text-ink">Source</p>
        <SourceList sources={item.sources} />
      </div>
    </li>
  );
}

function EvidenceGroup({ title, description, items }: { title: string; description: string; items: EvidenceItem[] }) {
  return (
    <Section title={title} description={description}>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-5 py-6 text-sm text-muted">No evidence of this kind is available for this finding.</p>
      ) : (
        <Panel><ul className="divide-y divide-line">{items.map((e) => <EvidenceCard key={e.id} item={e} />)}</ul></Panel>
      )}
    </Section>
  );
}

function Interpretation({ findingId }: { findingId: string }) {
  const run = useInterpretation(findingId);
  return (
    <Section title="AI interpretation" description="A generated reading of the evidence above. It is not evidence itself and should be checked against the sources." className="mb-0">
      {run.data ? (
        <Panel className="p-5">
          <p className="text-sm leading-relaxed">{run.data.summary}</p>
          {run.data.caveats.length > 0 && (
            <ul className="mt-3 list-disc space-y-0.5 pl-4 text-[13px] text-body">
              {run.data.caveats.map((c) => <li key={c}>{c}</li>)}
            </ul>
          )}
          <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
            {run.data.model} · {formatDate(run.data.generated_at)}
          </p>
        </Panel>
      ) : (
        <Button variant="secondary" disabled={run.isPending} onClick={() => run.mutate()}>
          <Sparkles className="size-4" aria-hidden />
          {run.isPending ? "Generating…" : "Generate interpretation"}
        </Button>
      )}
      {run.isError && <div className="mt-3"><Notice title="Could not generate an interpretation">{run.error.message}</Notice></div>}
    </Section>
  );
}

export function FindingDetailView() {
  const { id } = useParams<{ id: string }>();
  const query = useFinding(id);

  return (
    <QueryView query={query}>
      {(f) => {
        const title = `${f.compound_a.name} and ${f.compound_b.name}`;
        if (!isTraceable(f)) {
          return (
            <>
              <PageHeader title={title} />
              <Notice title="Finding withheld">At least one evidence item has no traceable source, so this finding is not displayed.</Notice>
            </>
          );
        }
        const experimental = f.evidence.filter((e) => !EVIDENCE_META[e.category].computational);
        const computational = f.evidence.filter((e) => EVIDENCE_META[e.category].computational);
        return (
          <>
            <PageHeader
              title={title}
              description={`Candidate relationship via ${f.target.symbol}. Rank ${f.rank}, score ${f.score}. The score orders candidates for investigation and does not measure efficacy.`}
            />

            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-2"><span className="text-muted">Weakest evidence</span><EvidenceBadge category={f.category} /></span>
              <span><span className="text-muted">Confidence </span><span className="tabular-nums">{formatPercent(f.confidence)}</span></span>
              <span><span className="text-muted">Interaction </span>{f.interaction_type}</span>
            </div>

            <div className="mb-6 space-y-3">
              {isComputationalOnly(f) ? (
                <Notice title="Computational only">No experimental evidence supports this relationship. It is a hypothesis to test.</Notice>
              ) : (
                <Notice tone="neutral">A shared target does not demonstrate synergy. This relationship has not been shown to produce a combined effect.</Notice>
              )}
            </div>

            <Diagram finding={f} />

            <EvidenceGroup
              title="Measured and curated evidence"
              description="From experiments or curated scientific databases."
              items={experimental}
            />
            <EvidenceGroup
              title="Inferred and predicted evidence"
              description="Computational results, not experimentally confirmed."
              items={computational}
            />

            {f.missing_data.length > 0 && (
              <Section title="Missing data">
                <Notice>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {f.missing_data.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </Notice>
              </Section>
            )}

            <Interpretation findingId={f.id} />
          </>
        );
      }}
    </QueryView>
  );
}
