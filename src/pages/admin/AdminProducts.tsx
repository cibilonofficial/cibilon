import { useMemo, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CreditCard,
  FileText,
  Home,
  Landmark,
  Percent,
  Plus,
  ShieldCheck,
  Trash2,
  Wallet,
  Car,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PageHeader, SectionTitle, Tabs } from '@/components/ui/Misc';
import { StatCard } from '@/components/ui/StatCard';
import { Chip } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatCompactCurrency, formatCurrency } from '@/lib/utils';
import { useData } from '@/store/DataContext';
import type { ProductConfig, ServiceType } from '@/types';

const ICONS: Record<ServiceType, typeof Wallet> = {
  'Personal Loan': Wallet,
  'Business Loan': Briefcase,
  'Home Loan': Home,
  'Loan Against Property': Landmark,
  'Vehicle Loan': Car,
  'Credit Card': CreditCard,
  Insurance: ShieldCheck,
  'Other Financial Services': Boxes,
};

export function AdminProducts() {
  const toast = useToast();
  const { products, lenders, applications, payouts, updateProduct } = useData();

  const [tab, setTab] = useState('all');
  const [editing, setEditing] = useState<ProductConfig | null>(null);
  const [newDoc, setNewDoc] = useState('');
  const [newRule, setNewRule] = useState('');

  const usage = useMemo(() => {
    const map = new Map<string, { files: number; volume: number; payout: number }>();
    applications.forEach((app) => {
      const entry = map.get(app.service) ?? { files: 0, volume: 0, payout: 0 };
      entry.files += 1;
      if (['Disbursed', 'Completed'].includes(app.status)) entry.volume += app.loanAmount;
      map.set(app.service, entry);
    });
    payouts.forEach((p) => {
      const entry = map.get(p.service) ?? { files: 0, volume: 0, payout: 0 };
      entry.payout += p.payoutAmount;
      map.set(p.service, entry);
    });
    return map;
  }, [applications, payouts]);

  const visible = products.filter((p) =>
    tab === 'active' ? p.active : tab === 'inactive' ? !p.active : true,
  );

  const totals = {
    total: products.length,
    active: products.filter((p) => p.active).length,
    documents: products.reduce((sum, p) => sum + p.documents.length, 0),
    lenders: lenders.filter((l) => l.status === 'Active').length,
  };

  const toggleActive = (product: ProductConfig) => {
    updateProduct(product.service, { active: !product.active });
    toast.success(
      product.active ? 'Product disabled' : 'Product enabled',
      `${product.service} is now ${product.active ? 'hidden from' : 'available on'} the lead form.`,
    );
  };

  const saveDraft = () => {
    if (!editing) return;
    updateProduct(editing.service, editing);
    toast.success('Product updated', `${editing.service} configuration saved.`);
    setEditing(null);
  };

  return (
    <>
      <PageHeader
        title="Products & services"
        description="What Cibilon distributes, the documents each product needs and the payout it earns."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Products" value={totals.total} icon={<Boxes className="size-4" />} tone="brand" />
        <StatCard
          label="Live on the lead form"
          value={totals.active}
          icon={<CheckCircle2 className="size-4" />}
          tone="money"
        />
        <StatCard
          label="Checklist items"
          value={totals.documents}
          icon={<FileText className="size-4" />}
          tone="neutral"
        />
        <StatCard
          label="Active lenders"
          value={totals.lenders}
          icon={<Landmark className="size-4" />}
          tone="info"
        />
      </div>

      <Card className="mt-3">
        <div className="px-4 pt-1 sm:px-5">
          <Tabs
            tabs={[
              { id: 'all', label: 'All products', count: products.length },
              { id: 'active', label: 'Active', count: totals.active },
              { id: 'inactive', label: 'Inactive', count: products.length - totals.active },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>
        <CardBody>
          <div className="grid gap-3 lg:grid-cols-2">
            {visible.map((product) => {
              const Icon = ICONS[product.service];
              const stats = usage.get(product.service) ?? { files: 0, volume: 0, payout: 0 };
              return (
                <div
                  key={product.service}
                  className="flex min-w-0 flex-col rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{product.service}</h3>
                        <Chip tone={product.active ? 'money' : 'neutral'}>
                          {product.active ? 'Active' : 'Inactive'}
                        </Chip>
                      </div>
                      <p className="mt-1 text-[13px] leading-snug text-slate-500">
                        {product.tagline}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-4">
                    <Mini
                      label="Ticket size"
                      value={
                        product.maxAmount
                          ? `${formatCompactCurrency(product.minAmount)} – ${formatCompactCurrency(product.maxAmount)}`
                          : '—'
                      }
                    />
                    <Mini
                      label="Tenure"
                      value={product.maxTenure ? `${product.minTenure}–${product.maxTenure} mo` : '—'}
                    />
                    <Mini
                      label="Interest"
                      value={product.interestTo ? `${product.interestFrom}–${product.interestTo}%` : '—'}
                    />
                    <Mini
                      label="Payout"
                      value={
                        product.flatPayout !== null
                          ? `${formatCurrency(product.flatPayout)} flat`
                          : `${product.payoutRate}%`
                      }
                      tone="money"
                    />
                  </dl>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip tone="neutral">{product.documents.length} documents</Chip>
                    <Chip tone="neutral">{product.lenderIds.length} lenders</Chip>
                    <Chip tone="brand">{stats.files} files</Chip>
                    {stats.volume > 0 && (
                      <Chip tone="money">{formatCompactCurrency(stats.volume)} disbursed</Chip>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(product)}>
                      Configure
                    </Button>
                    <Button
                      variant={product.active ? 'ghost' : 'success'}
                      size="sm"
                      onClick={() => toggleActive(product)}
                    >
                      {product.active ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card className="mt-3">
        <CardHeader
          title="Payout economics"
          subtitle="Commission Cibilon earns, per product, across the panel"
        />
        <CardBody>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <li
                key={product.service}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2.5"
              >
                <span className="min-w-0 truncate text-[13px] text-slate-700">
                  {product.service}
                </span>
                <span className="tnum flex shrink-0 items-center gap-1 text-[13px] font-semibold text-money-700">
                  {product.flatPayout !== null ? (
                    formatCurrency(product.flatPayout)
                  ) : (
                    <>
                      {product.payoutRate}
                      <Percent className="size-3" />
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="xl"
        title={editing ? `Configure ${editing.service}` : ''}
        description="Changes apply to new applications raised from the advisor lead form."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveDraft}>Save configuration</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-5">
            <Textarea
              label="Tagline"
              rows={2}
              value={editing.tagline}
              onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
            />

            <div>
              <SectionTitle>Limits</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  label="Minimum amount"
                  type="number"
                  value={editing.minAmount}
                  onChange={(e) => setEditing({ ...editing, minAmount: Number(e.target.value) })}
                />
                <Input
                  label="Maximum amount"
                  type="number"
                  value={editing.maxAmount}
                  onChange={(e) => setEditing({ ...editing, maxAmount: Number(e.target.value) })}
                />
                <Input
                  label="Minimum tenure (months)"
                  type="number"
                  value={editing.minTenure}
                  onChange={(e) => setEditing({ ...editing, minTenure: Number(e.target.value) })}
                />
                <Input
                  label="Maximum tenure (months)"
                  type="number"
                  value={editing.maxTenure}
                  onChange={(e) => setEditing({ ...editing, maxTenure: Number(e.target.value) })}
                />
                <Input
                  label="Interest from (%)"
                  type="number"
                  step="0.05"
                  value={editing.interestFrom}
                  onChange={(e) => setEditing({ ...editing, interestFrom: Number(e.target.value) })}
                />
                <Input
                  label="Interest to (%)"
                  type="number"
                  step="0.05"
                  value={editing.interestTo}
                  onChange={(e) => setEditing({ ...editing, interestTo: Number(e.target.value) })}
                />
                <Input
                  label="Payout rate (%)"
                  type="number"
                  step="0.05"
                  value={editing.payoutRate}
                  onChange={(e) => setEditing({ ...editing, payoutRate: Number(e.target.value) })}
                  hint="Percentage of the disbursed amount"
                />
                <Input
                  label="Flat payout (₹)"
                  type="number"
                  value={editing.flatPayout ?? ''}
                  placeholder="Not applicable"
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      flatPayout: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  hint="Used for products without an amount"
                />
              </div>
            </div>

            <div>
              <SectionTitle>Required documents</SectionTitle>
              <div className="space-y-2">
                {editing.documents.map((doc, index) => (
                  <div
                    key={doc.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-[13px] text-slate-700">{doc.name}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <Checkbox
                        label="Mandatory"
                        checked={doc.required}
                        onChange={() =>
                          setEditing({
                            ...editing,
                            documents: editing.documents.map((d, i) =>
                              i === index ? { ...d, required: !d.required } : d,
                            ),
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${doc.name}`}
                        className="text-slate-400 hover:text-rose-600"
                        onClick={() =>
                          setEditing({
                            ...editing,
                            documents: editing.documents.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Add a document to the checklist…"
                  value={newDoc}
                  onChange={(e) => setNewDoc(e.target.value)}
                  containerClassName="flex-1"
                />
                <Button
                  variant="secondary"
                  icon={<Plus className="size-4" />}
                  disabled={!newDoc.trim()}
                  onClick={() => {
                    setEditing({
                      ...editing,
                      documents: [...editing.documents, { name: newDoc.trim(), required: true }],
                    });
                    setNewDoc('');
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <SectionTitle>Eligibility</SectionTitle>
              <ul className="space-y-2">
                {editing.eligibility.map((rule, index) => (
                  <li
                    key={rule}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="min-w-0 text-[13px] text-slate-700">{rule}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove rule ${index + 1}`}
                      className="shrink-0 text-slate-400 hover:text-rose-600"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          eligibility: editing.eligibility.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Add an eligibility rule…"
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  containerClassName="flex-1"
                />
                <Button
                  variant="secondary"
                  icon={<Plus className="size-4" />}
                  disabled={!newRule.trim()}
                  onClick={() => {
                    setEditing({ ...editing, eligibility: [...editing.eligibility, newRule.trim()] });
                    setNewRule('');
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            <div>
              <SectionTitle>Lenders on this product</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2">
                {lenders.map((lender) => {
                  const on = editing.lenderIds.includes(lender.id);
                  return (
                    <div
                      key={lender.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <Checkbox
                        label={lender.name}
                        checked={on}
                        onChange={() =>
                          setEditing({
                            ...editing,
                            lenderIds: on
                              ? editing.lenderIds.filter((id) => id !== lender.id)
                              : [...editing.lenderIds, lender.id],
                          })
                        }
                      />
                      <span className="shrink-0 text-xs text-slate-400">{lender.type}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function Mini({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'money';
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className={`tnum mt-0.5 truncate text-[13px] font-medium ${
          tone === 'money' ? 'text-money-700' : 'text-slate-800'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
