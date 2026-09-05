import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileStack } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Input } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Misc';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useData } from '@/store/DataContext';
import { formatCurrency, matchesQuery } from '@/lib/utils';

export function StaffApplications() {
  const { applications, loading } = useData();
  const [query, setQuery] = useState('');
  const rows = useMemo(() => applications.filter((app) =>
    matchesQuery(query, app.customer.fullName, app.customer.mobile, app.service, app.id)), [applications, query]);
  return <>
    <PageHeader title="Assigned applications" description="Open an application to review customer details, documents and processing progress." />
    <Card>
      <div className="p-4"><Input aria-label="Search assigned applications" placeholder="Search customer, mobile or service…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      {!loading && rows.length === 0 && <EmptyState icon={<FileStack className="size-5" />} title={query ? 'No matching applications' : 'No applications assigned yet'} description="Applications assigned to you by the super admin will appear here." />}
      <div className="divide-y divide-slate-100">
        {rows.map((app) => <Link key={app.id} to={`/staff/applications/${app.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50">
          <div><p className="font-semibold text-brand-800">{app.customer.fullName}</p><p className="mt-1 text-sm text-slate-500">{app.service} · {formatCurrency(app.loanAmount)} · {app.advisorName}</p></div>
          <StatusBadge status={app.status} />
        </Link>)}
      </div>
    </Card>
  </>;
}
