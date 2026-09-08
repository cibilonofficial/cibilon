import { Building2, Landmark, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { Card, CardBody, CardHeader, DetailItem } from '@/components/ui/Card';
import { Avatar, PageHeader, SectionTitle } from '@/components/ui/Misc';
import { Chip } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/StatCard';
import { computeMetrics } from '@/lib/metrics';
import { formatCompactCurrency } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';

export function AdminProfile() {
  const { user } = useAuth();
  const { applications, documents, payouts, advisors } = useData();
  const metrics = computeMetrics(applications, documents, payouts);

  return (
    <>
      <PageHeader
        title="Organisation"
        description="Your operations profile and the network-level rollup for Cibilon."
      />

      <div className="grid gap-3 lg:grid-cols-[20rem_1fr]">
        <Card>
          <CardBody className="text-center">
            <Avatar name={user!.name} color={user!.avatarColor} size="xl" className="mx-auto" />
            <h2 className="mt-3 text-base font-semibold text-slate-900">{user!.name}</h2>
            <p className="text-[13px] text-slate-500">Super Admin · Operations</p>
            <div className="mt-3 flex justify-center gap-1.5">
              <Chip tone="brand">{user!.code}</Chip>
              <Chip tone="money">Active</Chip>
            </div>

            <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-left">
              <DetailItem
                label="Email"
                value={
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5 text-slate-400" />
                    {user!.email}
                  </span>
                }
              />
              <DetailItem
                label="Mobile"
                value={
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5 text-slate-400" />
                    {user!.mobile}
                  </span>
                }
              />
              <DetailItem label="Role" value="Super Admin — full access" />
            </dl>
          </CardBody>
        </Card>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Advisors"
              value={advisors.length}
              icon={<Building2 className="size-4" />}
              tone="brand"
            />
            <StatCard
              label="Applications"
              value={applications.length}
              icon={<Landmark className="size-4" />}
              tone="neutral"
            />
            <StatCard
              label="Disbursed volume"
              value={formatCompactCurrency(metrics.disbursedVolume)}
              icon={<Landmark className="size-4" />}
              tone="money"
            />
            <StatCard
              label="Payouts released"
              value={formatCompactCurrency(metrics.paidPayout)}
              icon={<Landmark className="size-4" />}
              tone="money"
            />
          </div>

          <Card>
            <CardHeader title="Company" subtitle="Registered entity details" />
            <CardBody className="space-y-6">
              <div>
                <SectionTitle>Entity</SectionTitle>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <DetailItem label="Business name" value="Cibilon" />
                  <DetailItem label="CIN" value="U65990MH2019PTC331204" mono />
                  <DetailItem label="GSTIN" value="27AAKCC7712R1ZQ" mono />
                  <DetailItem label="PAN" value="AAKCC7712R" mono />
                  <DetailItem label="RBI DSA registration" value="DSA/MH/2019/00841" mono />
                  <DetailItem label="Financial year" value="April – March" />
                </dl>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <SectionTitle>Registered office</SectionTitle>
                <p className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" />
                  1204, Peninsula Business Park, Lower Parel, Mumbai, Maharashtra 400013
                </p>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <SectionTitle>Compliance</SectionTitle>
                <div className="flex items-start gap-2.5 rounded-lg border border-brand-200 bg-brand-50/60 px-3.5 py-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
                  <p className="text-[13px] leading-relaxed text-brand-900">
                    Customer KYC records are retained for eight years as required under the PMLA
                    record-keeping rules. Advisor payouts are reported against Section 194H TDS.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
