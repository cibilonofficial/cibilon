import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { DOCUMENT_CHECKLIST } from '@/lib/constants';
import { useData } from '@/store/DataContext';
import type { Application } from '@/types';

const OTHER = 'Other (type below)';

/**
 * Admin-side request for an extra document. The request lands in the advisor's
 * Documents page as a pending, mandatory slot along with a notification.
 */
export function RequestDocumentModal({
  application,
  onClose,
}: {
  application: Application | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const { requestDocument, documentsFor } = useData();
  const [choice, setChoice] = useState('');
  const [custom, setCustom] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    setChoice('');
    setCustom('');
    setRemarks('');
  }, [application?.id]);

  if (!application) return null;

  const existing = new Set(documentsFor(application.id).map((d) => d.name));
  const suggestions = (DOCUMENT_CHECKLIST[application.service] ?? [])
    .map((d) => d.name)
    .filter((name) => !existing.has(name));

  const name = choice === OTHER ? custom.trim() : choice;

  const submit = () => {
    if (!name) return;
    requestDocument(application.id, name, remarks.trim());
    toast.success('Document requested', `${name} has been requested from ${application.advisorName}.`);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Request a document — ${application.id}`}
      description={`${application.customer.fullName} · ${application.advisorName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name}>
            Send request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Document"
          required
          placeholder="Choose a document…"
          options={[...suggestions, OTHER]}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          hint={
            suggestions.length
              ? 'Checklist items not yet on this file are listed first.'
              : 'Every checklist item is already on this file — describe the extra document below.'
          }
        />

        {choice === OTHER && (
          <Input
            label="Document name"
            required
            placeholder="e.g. Employer verification letter"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}

        <Textarea
          label="Note for the advisor"
          rows={3}
          placeholder="Explain what is needed and why, so the advisor can brief the customer."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>
    </Modal>
  );
}
