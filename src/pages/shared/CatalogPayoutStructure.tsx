import { useMemo, useState } from 'react';
import { BadgePercent, Pencil, Plus, Search } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { usePayoutRateCard } from '@/hooks/usePayoutRateCard';
import type { PayoutRateCardEntry } from '@/types';

type Draft = Pick<PayoutRateCardEntry, 'providerName' | 'productName' | 'payoutText' | 'notes'> & { id?: string; percentageRate: string };

export function CatalogPayoutStructure({ editable = false }: { editable?: boolean }) {
  const { entries, loading, refresh } = usePayoutRateCard();
  const toast = useToast();
  const categories = useMemo(() => [...new Map(entries.map((entry) => [entry.categoryId, entry.categoryName])).entries()], [entries]);
  const [selectedId, setSelectedId] = useState('');
  const categoryId = categories.some(([id]) => id === selectedId) ? selectedId : categories[0]?.[0] ?? '';
  const categoryName = categories.find(([id]) => id === categoryId)?.[1] ?? 'Payout structure';
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const categoryEntries = entries.filter((entry) => entry.categoryId === categoryId);
  const filtered = categoryEntries.filter((entry) => `${entry.providerName} ${entry.productName} ${entry.payoutText}`.toLowerCase().includes(query.toLowerCase()));
  const rates = categoryEntries.flatMap((entry) => entry.percentageRate == null ? [] : [entry.percentageRate]);
  const minimum = rates.length ? Math.min(...rates) : null;
  const maximum = rates.length ? Math.max(...rates) : null;
  const tabs = categories.map(([id, name]) => ({ id, label: name, count: entries.filter((entry) => entry.categoryId === id).length }));

  const edit = (entry?: PayoutRateCardEntry) => setDraft(entry ? {
    id: entry.id, providerName: entry.providerName, productName: entry.productName,
    payoutText: entry.payoutText, percentageRate: entry.percentageRate?.toString() ?? '', notes: entry.notes,
  } : { providerName: '', productName: '', payoutText: '', percentageRate: '', notes: null });

  const save = async () => {
    if (!draft || !categoryId || !draft.providerName.trim() || !draft.productName.trim() || !draft.payoutText.trim()) return;
    try {
      await apiRequest(draft.id ? `/payout-rate-card/${draft.id}` : '/payout-rate-card', {
        method: draft.id ? 'PATCH' : 'POST',
        body: {
          ...(!draft.id ? { categoryId, categoryName } : {}), providerName: draft.providerName,
          productName: draft.productName, payoutText: draft.payoutText,
          percentageRate: draft.percentageRate === '' ? null : Number(draft.percentageRate), notes: draft.notes || null,
          effectiveMonth: categoryEntries[0]?.effectiveMonth ?? 'JULY-2025',
        },
      });
      await refresh(); setDraft(null);
      toast.success('Payout structure updated', 'Lead estimates now use the updated category range.');
    } catch (error) { toast.error('Could not update payout structure', error instanceof Error ? error.message : 'Please try again.'); }
  };

  return <div className="space-y-5 pb-10">
    <PageHeader title="Payout structure" description={`Verified Cibilon rate card - ${categoryEntries[0]?.effectiveMonth ?? 'July 2025'}`} actions={editable && categoryId ? <Button icon={<Plus className="size-4" />} onClick={() => edit()}>Add option</Button> : undefined} />
    {tabs.length > 0 && <Card><div className="overflow-x-auto px-4 pt-3"><Tabs tabs={tabs} active={categoryId} onChange={setSelectedId} /></div></Card>}
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardBody><p className="text-xs text-slate-500">Programs</p><p className="mt-1 text-2xl font-semibold">{categoryEntries.length}</p></CardBody></Card>
      <Card><CardBody><p className="text-xs text-slate-500">Lowest numeric payout</p><p className="mt-1 text-2xl font-semibold text-money-700">{minimum == null ? 'Variable / PF linked' : `${minimum}%`}</p></CardBody></Card>
      <Card><CardBody><p className="text-xs text-slate-500">Highest numeric payout</p><p className="mt-1 text-2xl font-semibold text-money-700">{maximum == null ? 'Variable / PF linked' : `${maximum}%`}</p></CardBody></Card>
    </div>
    <Card>
      <CardHeader title={categoryName} subtitle="Rates and conditions transcribed from the uploaded official payout structure." />
      <div className="border-y border-slate-200 bg-slate-50 p-3"><div className="relative max-w-lg"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm" placeholder="Search provider, product, or payout..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
      <CardBody>
        {!loading && filtered.length === 0 ? <EmptyState icon={<BadgePercent className="size-5" />} title="No payout options found" description="Try another category or search term." /> : <div className="space-y-2">{filtered.map((entry) => <div key={entry.id} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1.2fr_1fr_auto_auto] md:items-center">
          <div><p className="text-sm font-semibold text-slate-900">{entry.providerName}</p>{entry.notes && <p className="mt-0.5 text-xs text-slate-500">{entry.notes}</p>}</div>
          <p className="text-sm text-slate-600">{entry.productName}</p>
          <span className="tnum justify-self-start rounded-md bg-money-50 px-2.5 py-1 text-sm font-semibold text-money-700 md:justify-self-end">{entry.payoutText}</span>
          {editable && <Button variant="ghost" size="icon" aria-label={`Edit ${entry.providerName}`} onClick={() => edit(entry)}><Pencil className="size-4" /></Button>}
        </div>)}</div>}
      </CardBody>
    </Card>
    <p className="text-xs text-slate-500">Percentage ranges exclude rows marked PF-linked, payout-share, or other non-numeric conditions because those require manual confirmation.</p>
    <Modal open={Boolean(draft)} onClose={() => setDraft(null)} title={draft?.id ? 'Edit payout option' : 'Add payout option'} footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button disabled={!draft?.providerName.trim() || !draft?.productName.trim() || !draft?.payoutText.trim()} onClick={() => void save()}>Save option</Button></>}>
      {draft && <div className="space-y-4"><Input label="Bank / NBFC / insurer" value={draft.providerName} onChange={(e) => setDraft({ ...draft, providerName: e.target.value })} /><Input label="Product / condition" value={draft.productName} onChange={(e) => setDraft({ ...draft, productName: e.target.value })} /><Input label="Displayed payout" placeholder="2.90% or PF linked" value={draft.payoutText} onChange={(e) => setDraft({ ...draft, payoutText: e.target.value })} /><Input label="Numeric percentage used for range" type="number" min="0" max="100" step="0.01" value={draft.percentageRate} onChange={(e) => setDraft({ ...draft, percentageRate: e.target.value })} hint="Leave blank for PF-linked or variable rows." /><Textarea label="Notes" rows={2} value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></div>}
    </Modal>
  </div>;
}
