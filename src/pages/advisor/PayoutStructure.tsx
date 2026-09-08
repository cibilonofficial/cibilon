import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle2,
  Info,
  Mail,
  MapPin,
  Percent,
  Phone,
  Printer,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Misc';
import { StatCard } from '@/components/ui/StatCard';
import {
  MobileCardList,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableWrap,
} from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import {
  CIBILON_CONTACT,
  PAYOUT_DATA,
  type PayoutCategory,
} from '@/data/payoutStructureData';

export function PayoutStructure() {
  const [selectedCatId, setSelectedCatId] = useState<string>('personal-loan');
  const [query, setQuery] = useState('');
  const [highRateOnly, setHighRateOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'rate-desc' | 'name-asc'>('default');

  const currentCategory = useMemo<PayoutCategory>(() => {
    return PAYOUT_DATA.find((c) => c.id === selectedCatId) || PAYOUT_DATA[0];
  }, [selectedCatId]);

  const tabs = useMemo(
    () =>
      PAYOUT_DATA.map((cat) => ({
        id: cat.id,
        label: `${cat.name}`,
        count: cat.items.length,
      })),
    [],
  );

  const filteredItems = useMemo(() => {
    let list = currentCategory.items.filter((item) => {
      const q = query.toLowerCase().trim();
      if (!q) return true;
      return (
        item.lender.toLowerCase().includes(q) ||
        item.product.toLowerCase().includes(q) ||
        item.payout.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q))
      );
    });

    if (highRateOnly) {
      list = list.filter((item) => item.highlight || (item.numericRate !== undefined && item.numericRate >= 2.8));
    }

    if (sortBy === 'rate-desc') {
      list = [...list].sort((a, b) => (b.numericRate ?? 0) - (a.numericRate ?? 0));
    } else if (sortBy === 'name-asc') {
      list = [...list].sort((a, b) => a.lender.localeCompare(b.lender));
    }

    return list;
  }, [currentCategory, query, highRateOnly, sortBy]);

  const stats = useMemo(() => {
    const rates = currentCategory.items
      .map((i) => i.numericRate)
      .filter((r): r is number => r !== undefined);
    const maxRate = rates.length > 0 ? Math.max(...rates) : 0;
    const isInsurance = currentCategory.id === 'insurance';

    return {
      totalLenders: currentCategory.items.length,
      maxPayout: maxRate > 0 ? `${maxRate}%` : 'Variable / PF',
      isInsurance,
      highlightCount: currentCategory.items.filter((i) => i.highlight).length,
    };
  }, [currentCategory]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Official Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 p-6 text-white shadow-raised sm:p-8">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-200 backdrop-blur-sm">
                <Calendar className="size-3.5" />
                Valid: {CIBILON_CONTACT.effectiveMonth}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-sm">
                <CheckCircle2 className="size-3.5" />
                Verified Rate Card
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Advisor Payout Structure
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
              Official commission rates and terms for partner Banks, NBFCs, and Insurance underwriters.
              All disbursements are credited according to this verified schedule.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-xs backdrop-blur-md sm:min-w-[280px]">
            <div className="font-semibold uppercase tracking-wider text-brand-200">Cibilon Financial Desk</div>
            <div className="flex items-center gap-2 text-slate-300">
              <Phone className="size-3.5 shrink-0 text-brand-300" />
              <span>{CIBILON_CONTACT.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Mail className="size-3.5 shrink-0 text-brand-300" />
              <span>{CIBILON_CONTACT.email}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <MapPin className="size-3.5 shrink-0 text-brand-300" />
              <span className="truncate">{CIBILON_CONTACT.address}</span>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 size-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Category"
          value={currentCategory.name}
          footnote={`${currentCategory.items.length} Products listed`}
          icon={<Building2 className="size-4" />}
          tone="brand"
        />
        <StatCard
          label="Top Commission Rate"
          value={stats.maxPayout}
          footnote={stats.isInsurance ? 'On Net Premium' : 'On Net Disbursed'}
          icon={<TrendingUp className="size-4" />}
          tone="money"
        />
        <StatCard
          label="High-Payout Programs"
          value={stats.highlightCount}
          footnote="Premium earning brackets"
          icon={<Sparkles className="size-4" />}
          tone="info"
        />
        <StatCard
          label="TDS & GST Settlement"
          value="Exclusive 2%"
          footnote="TDS deducted; GST extra"
          icon={<Percent className="size-4" />}
          tone="warn"
        />
      </div>

      {/* Category Tabs */}
      <Card>
        <div className="border-b border-slate-200 px-4 pt-3 sm:px-6">
          <Tabs tabs={tabs} active={selectedCatId} onChange={(id) => setSelectedCatId(id)} />
        </div>

        <CardHeader
          title={currentCategory.name}
          subtitle={currentCategory.description}
          action={
            <Button variant="secondary" size="sm" onClick={handlePrint} icon={<Printer className="size-4" />}>
              Print / Save PDF
            </Button>
          }
        />

        {/* Filter / Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/75 px-4 py-3 sm:px-6">
          <div className="relative min-w-[220px] flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${currentCategory.name} lenders or schemes…`}
              className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHighRateOnly(!highRateOnly)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
                highRateOnly
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100',
              )}
            >
              <Sparkles className="size-3.5 text-emerald-600" />
              High Yield Only
            </button>

            <div className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white p-0.5 text-xs text-slate-600">
              <button
                type="button"
                onClick={() => setSortBy('default')}
                className={cn('rounded px-2.5 py-1 font-medium transition-colors', sortBy === 'default' && 'bg-slate-100 text-slate-900')}
              >
                Default
              </button>
              <button
                type="button"
                onClick={() => setSortBy('rate-desc')}
                className={cn('inline-flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-colors', sortBy === 'rate-desc' && 'bg-brand-50 text-brand-900 font-semibold')}
              >
                <ArrowUpDown className="size-3" />
                Rate
              </button>
              <button
                type="button"
                onClick={() => setSortBy('name-asc')}
                className={cn('rounded px-2.5 py-1 font-medium transition-colors', sortBy === 'name-asc' && 'bg-slate-100 text-slate-900')}
              >
                A-Z
              </button>
            </div>
          </div>
        </div>

        {/* Content Table */}
        <CardBody className="p-0">
          {filteredItems.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Search className="size-5" />}
                title="No programs match your search"
                description={`Try modifying your search "${query}" or resetting the high yield filter.`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => { setQuery(''); setHighRateOnly(false); }}>
                    Reset Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block">
                <TableWrap>
                  <THead>
                    <TH align="center" className="w-14">#</TH>
                    <TH className="w-72">Bank / NBFC / Underwriter</TH>
                    <TH>Product / Scheme Details</TH>
                    <TH align="right" className="w-40">Net Payout</TH>
                    <TH className="w-72">Conditions & Notes</TH>
                  </THead>
                  <TBody>
                    {filteredItems.map((item, index) => {
                      const isHigh = item.highlight || (item.numericRate !== undefined && item.numericRate >= 2.8);
                      return (
                        <TR key={item.id} className={cn(isHigh ? 'bg-emerald-50/30 hover:bg-emerald-50/60' : undefined)}>
                          <TD align="center" className="font-mono text-xs text-slate-400">{index + 1}</TD>
                          <TD>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">{item.lender}</span>
                              {item.highlight && (
                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Top Tier
                                </span>
                              )}
                            </div>
                          </TD>
                          <TD>
                            <span className="text-xs font-medium text-slate-700">{item.product}</span>
                          </TD>
                          <TD align="right">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-md px-2.5 py-1 font-mono text-xs font-bold',
                                isHigh
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-brand-50 text-brand-900',
                              )}
                            >
                              {item.payout}
                            </span>
                          </TD>
                          <TD>
                            {item.notes ? (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                <Info className="size-3 text-slate-400" />
                                {item.notes}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </TableWrap>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden">
                <MobileCardList>
                  {filteredItems.map((item, index) => {
                    const isHigh = item.highlight || (item.numericRate !== undefined && item.numericRate >= 2.8);
                    return (
                      <div key={item.id} className="p-4 space-y-2.5 border-b border-slate-100 last:border-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono text-slate-400">#{index + 1}</span>
                              <h4 className="font-semibold text-slate-900 text-sm">{item.lender}</h4>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">{item.product}</p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 rounded-md px-2.5 py-1 font-mono text-xs font-bold',
                              isHigh ? 'bg-emerald-600 text-white' : 'bg-brand-50 text-brand-900',
                            )}
                          >
                            {item.payout}
                          </span>
                        </div>
                        {item.notes && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 p-2 rounded">
                            <Info className="size-3 shrink-0 text-slate-400" />
                            <span>{item.notes}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </MobileCardList>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {/* Terms & Conditions Card */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardHeader
          title={`Terms & Conditions — ${currentCategory.name}`}
          subtitle="Important regulatory, clawback, and calculation guidelines applicable to this payout section."
        />
        <CardBody className="pt-0">
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs text-slate-700">
            {currentCategory.terms.map((term, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg bg-white/80 p-3 border border-amber-200/60">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-[10px] text-amber-900">
                  {i + 1}
                </span>
                <span className="leading-relaxed">{term}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/60 pt-3 text-[11px] text-slate-500">
            <span>Official Circular: {CIBILON_CONTACT.tagline}</span>
            <span>Registered Office: {CIBILON_CONTACT.address}</span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
