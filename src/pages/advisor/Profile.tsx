import { useRef, useState } from 'react';
import { BadgeCheck, Camera, Landmark, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, DetailItem } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { Avatar, PageHeader, SectionTitle, Tabs } from '@/components/ui/Misc';
import { Chip } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/StatCard';
import { useToast } from '@/components/ui/Toast';
import { INDIAN_STATES } from '@/lib/constants';
import { advisorRollup } from '@/lib/metrics';
import { formatCompactCurrency, formatDate, maskId } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { AdvisorProfile } from '@/types';

export function Profile() {
  const toast = useToast();
  const { user } = useAuth();
  const { profile, updateProfile, applications, payouts, advisors } = useData();
  const photoInput = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState('details');
  const [draft, setDraft] = useState<AdvisorProfile>(profile);
  const [saving, setSaving] = useState(false);

  const advisor = advisors.find((a) => a.id === user!.id);
  const rollup = advisorRollup(user!.id, applications, payouts);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  const set = <K extends keyof AdvisorProfile>(key: K, value: AdvisorProfile[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    updateProfile(draft);
    setSaving(false);
    toast.success('Profile updated', 'Your details have been saved.');
  };

  const onPhoto = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Unsupported file', 'Please choose a JPG or PNG image.');
      return;
    }
    const url = URL.createObjectURL(file);
    set('photo', url);
    updateProfile({ photo: url });
    toast.success('Photo updated');
  };

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your advisor identity, agency details and payout bank account."
        actions={
          <Button
            icon={<Save className="size-4" />}
            disabled={!dirty}
            loading={saving}
            onClick={save}
          >
            Save changes
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[20rem_1fr]">
        {/* Identity card */}
        <div className="space-y-3">
          <Card>
            <CardBody className="text-center">
              <div className="relative mx-auto w-fit">
                <Avatar
                  name={profile.name}
                  src={profile.photo}
                  color={user!.avatarColor}
                  size="xl"
                />
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full bg-brand-900 text-white ring-2 ring-white transition-colors hover:bg-brand-800"
                  aria-label="Change profile photo"
                >
                  <Camera className="size-3.5" />
                </button>
              </div>

              <h2 className="mt-3 text-base font-semibold text-slate-900">{profile.name}</h2>
              <p className="text-[13px] text-slate-500">{profile.agency}</p>

              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <Chip tone="brand">
                  <BadgeCheck className="size-3.5" />
                  {profile.dsaId}
                </Chip>
                <Chip tone={profile.accountStatus === 'Active' ? 'money' : 'warn'}>
                  {profile.accountStatus}
                </Chip>
              </div>

              {profile.photo && (
                <button
                  type="button"
                  onClick={() => {
                    set('photo', null);
                    updateProfile({ photo: null });
                  }}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="size-3" />
                  Remove photo
                </button>
              )}

              <dl className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-left">
                <DetailItem label="Email" value={profile.email} />
                <DetailItem label="Mobile" value={profile.mobile} mono />
                <DetailItem label="PAN" value={maskId(profile.panNumber)} mono />
                <DetailItem
                  label="Empanelled since"
                  value={formatDate(advisor?.joinedOn ?? null)}
                />
              </dl>
            </CardBody>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Total leads"
              value={rollup.totalLeads}
              icon={<BadgeCheck className="size-4" />}
              tone="brand"
            />
            <StatCard
              label="Total payout"
              value={formatCompactCurrency(rollup.totalPayout)}
              icon={<Landmark className="size-4" />}
              tone="money"
            />
          </div>
        </div>

        {/* Editable panels */}
        <Card>
          <div className="px-4 pt-1 sm:px-5">
            <Tabs
              tabs={[
                { id: 'details', label: 'Advisor details' },
                { id: 'bank', label: 'Payout account' },
                { id: 'security', label: 'Security' },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>

          {tab === 'details' && (
            <CardBody className="space-y-6">
              <div>
                <SectionTitle>Personal</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Advisor name"
                    value={draft.name}
                    onChange={(e) => set('name', e.target.value)}
                  />
                  <Input
                    label="Email address"
                    type="email"
                    value={draft.email}
                    onChange={(e) => set('email', e.target.value)}
                  />
                  <Input
                    label="Mobile number"
                    value={draft.mobile}
                    onChange={(e) => set('mobile', e.target.value)}
                  />
                  <Input label="Advisor / DSA ID" value={draft.dsaId} disabled hint="Issued by Cibilon" />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <SectionTitle>Agency</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Company / agency name"
                    value={draft.agency}
                    onChange={(e) => set('agency', e.target.value)}
                  />
                  <Input
                    label="GSTIN"
                    className="uppercase"
                    value={draft.gstin}
                    onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                  />
                  <Input
                    label="PAN"
                    className="uppercase"
                    value={draft.panNumber}
                    onChange={(e) => set('panNumber', e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <SectionTitle>Address</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Address"
                    containerClassName="sm:col-span-2"
                    value={draft.address}
                    onChange={(e) => set('address', e.target.value)}
                  />
                  <Input
                    label="City"
                    value={draft.city}
                    onChange={(e) => set('city', e.target.value)}
                  />
                  <Select
                    label="State"
                    options={INDIAN_STATES}
                    value={draft.state}
                    onChange={(e) => set('state', e.target.value)}
                  />
                  <Input
                    label="Pincode"
                    inputMode="numeric"
                    maxLength={6}
                    value={draft.pincode}
                    onChange={(e) => set('pincode', e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>
            </CardBody>
          )}

          {tab === 'bank' && (
            <CardBody className="space-y-6">
              <div className="flex items-start gap-2.5 rounded-lg border border-brand-200 bg-brand-50/60 px-3.5 py-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
                <p className="text-[13px] leading-relaxed text-brand-900">
                  Payouts are credited to this account within 7 working days of the payout being
                  released. Changes are re-verified by the finance team before the next cycle.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Account holder name"
                  value={draft.accountHolder}
                  onChange={(e) => set('accountHolder', e.target.value)}
                />
                <Input
                  label="Bank name"
                  value={draft.bankName}
                  onChange={(e) => set('bankName', e.target.value)}
                />
                <Input
                  label="Account number"
                  inputMode="numeric"
                  value={draft.accountNumber}
                  onChange={(e) => set('accountNumber', e.target.value.replace(/\D/g, ''))}
                />
                <Input
                  label="IFSC code"
                  className="uppercase"
                  maxLength={11}
                  value={draft.ifsc}
                  onChange={(e) => set('ifsc', e.target.value.toUpperCase())}
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <SectionTitle>Payout summary</SectionTitle>
                <dl className="grid gap-4 sm:grid-cols-3">
                  <DetailItem
                    label="Total earned"
                    value={formatCompactCurrency(rollup.totalPayout)}
                  />
                  <DetailItem
                    label="Pending"
                    value={formatCompactCurrency(rollup.pendingPayout)}
                  />
                  <DetailItem label="Completed files" value={rollup.completed} />
                </dl>
              </div>
            </CardBody>
          )}

          {tab === 'security' && (
            <CardBody className="space-y-6">
              <div>
                <SectionTitle>Change password</SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Current password" type="password" placeholder="••••••••" />
                  <div className="hidden sm:block" />
                  <Input label="New password" type="password" placeholder="••••••••" />
                  <Input label="Confirm new password" type="password" placeholder="••••••••" />
                </div>
                <Button
                  className="mt-4"
                  onClick={() =>
                    toast.info('Not available in this build', 'Password changes need the backend.')
                  }
                >
                  Update password
                </Button>
              </div>

              <div className="border-t border-slate-100 pt-5">
                <SectionTitle>Account status</SectionTitle>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3.5">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">
                      Your DSA account is {profile.accountStatus.toLowerCase()}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Empanelled since {formatDate(advisor?.joinedOn ?? null)} · Code{' '}
                      {profile.dsaId}
                    </p>
                  </div>
                  <Chip tone={profile.accountStatus === 'Active' ? 'money' : 'warn'}>
                    {profile.accountStatus}
                  </Chip>
                </div>
              </div>
            </CardBody>
          )}

          {dirty && (
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3.5 sm:px-5">
              <Button variant="secondary" onClick={() => setDraft(profile)}>
                Discard
              </Button>
              <Button icon={<Save className="size-4" />} loading={saving} onClick={save}>
                Save changes
              </Button>
            </div>
          )}
        </Card>
      </div>

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onPhoto(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}
