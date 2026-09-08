import { useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, Banknote, Building2, Car, Check, ChevronRight,
  Copy, FileCheck2, FileText, GraduationCap, HeartHandshake, Home,
  Info, Printer, RotateCcw, Search, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import {
  DOCUMENTATION_DATA,
  type DocumentCategoryConfig,
  type DocumentVariant,
} from '@/data/documentationData';

const ICON_MAP: Record<string, React.ElementType> = {
  Banknote, Building2, Home, ShieldCheck, GraduationCap, Car, HeartHandshake, Activity,
};

const SERVICE_ORDER = [
  'personal-loan', 'business-loan', 'home-loan', 'lap', 'education-loan',
  'life-insurance', 'health-insurance', 'car-loan',
] as const;

const orderedServices = SERVICE_ORDER.map((id) => DOCUMENTATION_DATA.find((service) => service.id === id))
  .filter((service): service is DocumentCategoryConfig => Boolean(service));

function serviceLabel(service: DocumentCategoryConfig) {
  return service.id === 'lap' ? 'LAP' : service.name;
}

function variantLabel(variant: DocumentVariant) {
  if (variant.id === 'salaried') return 'Salaried';
  if (variant.id === 'self-employed' || variant.id === 'senp') return 'Self Employed';
  return variant.title;
}

export function RequiredDocuments() {
  const toast = useToast();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const category = DOCUMENTATION_DATA.find((item) => item.id === categoryId) ?? null;
  const variant = category?.variants.find((item) => item.id === variantId) ?? null;
  const isDirectService = category?.domain === 'insurance' && category.variants.length === 1;

  const filteredSections = useMemo(() => {
    if (!variant) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return variant.sections;
    return variant.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          [item.name, item.notes, item.format].some((value) => value?.toLowerCase().includes(needle)),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [query, variant]);

  const allIds = variant?.sections.flatMap((section) => section.items.map((item) => item.id)) ?? [];
  const checkedCount = allIds.filter((id) => checked[id]).length;

  const selectService = (service: DocumentCategoryConfig) => {
    setCategoryId(service.id);
    setVariantId(service.domain === 'insurance' && service.variants.length === 1 ? service.variants[0].id : null);
    setQuery('');
  };

  const backToServices = () => {
    setCategoryId(null);
    setVariantId(null);
    setQuery('');
  };

  const backOneLevel = () => {
    if (variant && !isDirectService) {
      setVariantId(null);
      setQuery('');
    } else backToServices();
  };

  const resetChecklist = () => {
    setChecked((current) => {
      const next = { ...current };
      allIds.forEach((id) => delete next[id]);
      return next;
    });
    toast.info('Checklist reset', 'All checkmarks for this document list were cleared.');
  };

  const copyChecklist = async () => {
    if (!category || !variant) return;
    const text = [
      `DOCUMENT CHECKLIST — ${serviceLabel(category).toUpperCase()}`,
      `Type: ${variantLabel(variant)}`,
      '',
      ...variant.sections.flatMap((section) => [
        section.title.toUpperCase(),
        ...section.items.map((item) => `${checked[item.id] ? '✓' : '□'} ${item.name}${item.notes ? ` — ${item.notes}` : ''}`),
        '',
      ]),
    ].join('\n');
    await navigator.clipboard.writeText(text);
    toast.success('Checklist copied', 'It is ready to paste into WhatsApp or email.');
  };

  return (
    <div className="space-y-6 pb-12">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 p-6 text-white shadow-raised sm:p-8">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-brand-100 ring-1 ring-white/15">
            <FileCheck2 className="size-3.5" /> Document guide
          </span>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Required Documents</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-300">
            Select a service and applicant type to reveal only the relevant, grouped checklist.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-medium">
            <button type="button" onClick={backToServices} className={cn('rounded-full px-3 py-1.5', !category ? 'bg-white text-brand-900' : 'bg-white/10 text-white hover:bg-white/15')}>
              1&nbsp; Services
            </button>
            <ChevronRight className="size-4 text-brand-300" />
            <span className={cn('rounded-full px-3 py-1.5', category && !variant ? 'bg-white text-brand-900' : 'bg-white/10 text-slate-300')}>
              2&nbsp; Type
            </span>
            <ChevronRight className="size-4 text-brand-300" />
            <span className={cn('rounded-full px-3 py-1.5', variant ? 'bg-white text-brand-900' : 'bg-white/10 text-slate-300')}>
              3&nbsp; Documents
            </span>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-money-500/15 blur-3xl" />
      </section>

      {!category && <ServiceSelection onSelect={selectService} />}

      {category && !variant && (
        <section className="space-y-4">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={backToServices}>
            Back to Services
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{serviceLabel(category)}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {category.id === 'business-loan' ? 'Select Business Constitution' : 'Select Applicant Type'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Choose one option to view its document checklist.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {category.variants.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setVariantId(item.id); setQuery(''); }}
                className="group flex min-h-32 items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-card transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-raised"
              >
                <span>
                  <span className="block text-base font-semibold text-slate-900">{variantLabel(item)}</span>
                  {item.subtitle && <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">{item.subtitle}</span>}
                </span>
                <span className="ml-4 flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-transform group-hover:translate-x-1">
                  <ChevronRight className="size-5" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {category && variant && (
        <section className="space-y-4">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={backOneLevel}>
            {isDirectService ? 'Back to Services' : `Back to ${serviceLabel(category)}`}
          </Button>
          <Card>
            <CardHeader
              title={`${serviceLabel(category)} — ${variantLabel(variant)}`}
              subtitle={variant.subtitle ?? category.tagline}
              action={<div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={resetChecklist}>Reset</Button>
                <Button variant="secondary" size="sm" icon={<Printer className="size-3.5" />} onClick={() => window.print()}>Print</Button>
                <Button size="sm" icon={<Copy className="size-3.5" />} onClick={() => void copyChecklist()}>Copy checklist</Button>
              </div>}
            />
            <CardBody className="space-y-5">
              <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this document list…" prefix={<Search className="size-4" />} containerClassName="w-full sm:max-w-md" />
                <p className="shrink-0 text-xs font-medium text-slate-600">{checkedCount} of {allIds.length} collected</p>
              </div>

              {variant.specialInstructions?.length ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                  <p className="flex items-center gap-2 font-semibold"><Info className="size-4" /> Important instructions</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">{variant.specialInstructions.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              ) : null}

              {filteredSections.length === 0 ? (
                <EmptyState icon={<Search className="size-5" />} title="No documents found" description={`No documents match “${query}”.`} />
              ) : filteredSections.map((section, index) => (
                <article key={section.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <header className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3.5 sm:px-5">
                    <span className="flex size-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">{index + 1}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
                      {section.description && <p className="text-xs text-slate-500">{section.description}</p>}
                    </div>
                    {section.badge && <span className="ml-auto rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold text-brand-700 ring-1 ring-brand-200">{section.badge}</span>}
                  </header>
                  <ul className="divide-y divide-slate-100">
                    {section.items.map((item) => {
                      const done = Boolean(checked[item.id]);
                      return <li key={item.id}>
                        <button type="button" onClick={() => setChecked((current) => ({ ...current, [item.id]: !current[item.id] }))} className={cn('flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors sm:px-5', done ? 'bg-money-50/60' : 'hover:bg-slate-50')}>
                          <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border', done ? 'border-money-600 bg-money-600 text-white' : 'border-slate-300 bg-white')}>{done && <Check className="size-3.5 stroke-[3]" />}</span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-sm font-medium', done ? 'text-money-800 line-through' : 'text-slate-800')}>{item.name}</span>
                            {item.notes && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.notes}</span>}
                          </span>
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', item.mandatory ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500')}>{item.mandatory ? 'Mandatory' : 'Optional'}</span>
                        </button>
                      </li>;
                    })}
                  </ul>
                </article>
              ))}
            </CardBody>
          </Card>
        </section>
      )}
    </div>
  );
}

function ServiceSelection({ onSelect }: { onSelect: (service: DocumentCategoryConfig) => void }) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Step 1</p>
      <h2 className="mt-1 text-xl font-semibold text-slate-900">Select a Service</h2>
      <p className="mt-1 text-sm text-slate-500">Documents and applicant types will appear after you choose a service.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {orderedServices.map((service) => {
          const Icon = ICON_MAP[service.iconName] ?? FileText;
          return (
            <button key={service.id} type="button" onClick={() => onSelect(service)} className="group flex min-h-44 flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-card transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-raised">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="size-5" /></span>
              <span className="mt-4 flex w-full items-center justify-between gap-3">
                <span className="font-semibold text-slate-900">{serviceLabel(service)}</span>
                <ChevronRight className="size-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-brand-700" />
              </span>
              <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{service.tagline}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
