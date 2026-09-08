import { useState } from 'react';
import { FileCheck2, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Checkbox, Input, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/Misc';
import { useToast } from '@/components/ui/Toast';
import { useData } from '@/store/DataContext';

type Draft = { index: number | null; name: string; required: boolean };

export function CatalogDocuments({ editable = false }: { editable?: boolean }) {
  const { products, updateProduct } = useData();
  const toast = useToast();
  const activeProducts = products.filter((product) => product.active);
  const [service, setService] = useState('');
  const product = activeProducts.find((item) => item.service === service) ?? activeProducts[0];
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = async () => {
    if (!product || !draft?.name.trim()) return;
    const duplicate = product.documents.some((item, index) => index !== draft.index && item.name.toLowerCase() === draft.name.trim().toLowerCase());
    if (duplicate) { toast.error('Duplicate document', 'Use a unique document name.'); return; }
    const documents = draft.index === null
      ? [...product.documents, { name: draft.name.trim(), required: draft.required }]
      : product.documents.map((item, index) => index === draft.index ? { name: draft.name.trim(), required: draft.required } : item);
    try { await updateProduct(product.service, { documents }); setDraft(null); toast.success('Checklist updated', 'New applications will use the updated product checklist.'); }
    catch (error) { toast.error('Could not update checklist', error instanceof Error ? error.message : 'Please try again.'); }
  };

  return <div className="space-y-5">
    <PageHeader title="Documentation required" description={editable ? 'Add, edit, and mark mandatory documents for each product.' : 'Use the current checklist published by the Cibilon operations team.'} actions={editable && product ? <Button icon={<Plus className="size-4" />} onClick={() => setDraft({ index: null, name: '', required: true })}>Add document</Button> : undefined} />
    <Card><CardBody><Select label="Product or service" value={product?.service ?? ''} onChange={(e) => setService(e.target.value)} options={activeProducts.map((item) => item.service)} /></CardBody></Card>
    <Card>
      <CardHeader title={product?.service ?? 'Required documents'} subtitle={product ? `${product.documents.filter((item) => item.required).length} mandatory · ${product.documents.length} total` : undefined} />
      <CardBody>
        {!product || product.documents.length === 0 ? <EmptyState icon={<FileCheck2 className="size-5" />} title="No documents configured" description={editable ? 'Add the first document for this product.' : 'No standard checklist is currently published.'} /> :
          <div className="space-y-2">{product.documents.map((document, index) => <div key={`${document.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
            <div><p className="text-sm font-medium text-slate-900">{document.name}</p><p className="mt-0.5 text-xs text-slate-500">{document.required ? 'Mandatory' : 'Optional'}</p></div>
            {editable && <Button variant="ghost" size="icon" aria-label={`Edit ${document.name}`} onClick={() => setDraft({ index, ...document })}><Pencil className="size-4" /></Button>}
          </div>)}</div>}
      </CardBody>
    </Card>
    <Modal open={Boolean(draft)} onClose={() => setDraft(null)} title={draft?.index == null ? 'Add document' : 'Edit document'} footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button disabled={!draft?.name.trim()} onClick={() => void save()}>Save document</Button></>}>
      {draft && <div className="space-y-4"><Input label="Document name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /><Checkbox label="Mandatory for submission" checked={draft.required} onChange={(e) => setDraft({ ...draft, required: e.target.checked })} /></div>}
    </Modal>
  </div>;
}
