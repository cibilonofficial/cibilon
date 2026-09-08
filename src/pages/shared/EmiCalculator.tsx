import { useMemo, useState } from 'react';
import { Calculator, IndianRupee, Percent } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/Misc';
import { StatCard } from '@/components/ui/StatCard';
import { calculateEmi } from '@/lib/finance';
import { formatCurrency } from '@/lib/utils';

export function EmiCalculator() {
  const [amount, setAmount] = useState('1000000');
  const [rate, setRate] = useState('9');
  const [tenure, setTenure] = useState('240');
  const result = useMemo(() => calculateEmi(Number(amount), Number(rate), Number(tenure)), [amount, rate, tenure]);

  return <div className="space-y-5">
    <PageHeader title="EMI calculator" description="Calculate the indicative monthly instalment, total interest, and repayment for a loan." />
    <Card>
      <CardHeader title="Loan details" subtitle="Enter the annual reducing-balance interest rate and tenure." />
      <CardBody>
        <div className="grid gap-4 md:grid-cols-3">
          <Input label="Loan amount (₹)" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Interest rate (% p.a.)" type="number" min="0" max="100" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
          <Select label="Tenure" value={tenure} onChange={(e) => setTenure(e.target.value)} options={[
            { label: '6 months', value: '6' }, { label: '1 year', value: '12' }, { label: '2 years', value: '24' },
            { label: '3 years', value: '36' }, { label: '5 years', value: '60' }, { label: '10 years', value: '120' },
            { label: '15 years', value: '180' }, { label: '20 years', value: '240' }, { label: '25 years', value: '300' }, { label: '30 years', value: '360' },
          ]} />
        </div>
      </CardBody>
    </Card>
    <div className="grid gap-3 md:grid-cols-3">
      <StatCard label="Monthly EMI" value={result ? formatCurrency(Math.round(result.emi)) : '—'} icon={<Calculator className="size-4" />} tone="brand" />
      <StatCard label="Total interest" value={result ? formatCurrency(Math.round(result.interest)) : '—'} icon={<Percent className="size-4" />} tone="warn" />
      <StatCard label="Total repayment" value={result ? formatCurrency(Math.round(result.total)) : '—'} icon={<IndianRupee className="size-4" />} tone="money" />
    </div>
    <p className="text-xs text-slate-500">This is an indicative reducing-balance calculation. The lender’s EMI may differ because of fees, rounding, rate changes, or payment dates.</p>
  </div>;
}
