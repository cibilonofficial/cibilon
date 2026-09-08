import { CATEGORY_FIELDS, type ServiceCategory } from '../../../shared/service-categories';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { DetailItem } from '@/components/ui/Card';

export function CategoryFields({ category, values, errors, onChange }: {
  category: ServiceCategory; values: Record<string, string>; errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return <div className="grid gap-4 sm:grid-cols-2">{CATEGORY_FIELDS[category].map((field) => {
    const props = { label: field.label, required: field.required, value: values[field.key] ?? '', error: errors[field.key],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange(field.key, event.target.value) };
    return field.options ? <Select key={field.key} {...props} options={[...field.options]} />
      : field.type === 'textarea' ? <Textarea key={field.key} {...props} rows={3} />
      : <Input key={field.key} {...props} type={field.type ?? 'text'} min={field.min} max={field.max} />;
  })}</div>;
}

export function CategoryDetails({ category, values = {} }: { category: ServiceCategory; values?: Record<string, string> }) {
  return <>{CATEGORY_FIELDS[category].filter((field) => values[field.key]).map((field) =>
    <DetailItem key={field.key} label={field.label} value={values[field.key]} />)}</>;
}
