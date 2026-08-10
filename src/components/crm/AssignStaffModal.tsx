import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Misc';
import { Chip } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import { useData } from '@/store/DataContext';
import type { Application } from '@/types';

/** Assigns an application to a member of the internal processing team. */
export function AssignStaffModal({
  application,
  onClose,
}: {
  application: Application | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const { staff, assignApplication, addLeadActivity } = useData();
  const [staffId, setStaffId] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    setStaffId(application?.assignedStaffId ?? '');
    setNote('');
  }, [application?.id, application?.assignedStaffId]);

  if (!application) return null;

  const active = staff.filter((s) => s.status === 'Active');
  const selected = staff.find((s) => s.id === staffId);

  const save = () => {
    assignApplication(application.id, staffId || null);
    if (note.trim()) addLeadActivity(application.id, 'Assignment', note.trim());
    toast.success(
      selected ? 'Application assigned' : 'Assignment cleared',
      selected ? `${application.id} is now with ${selected.name}.` : `${application.id} is unassigned.`,
    );
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign ${application.id}`}
      description={`${application.customer.fullName} · ${application.service}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save assignment</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
          <span className="text-xs text-slate-500">Currently assigned</span>
          <Chip tone={application.assignedStaffId ? 'brand' : 'neutral'}>
            {application.assignedTo}
          </Chip>
        </div>

        <Select
          label="Assign to"
          placeholder="Unassigned"
          options={active.map((s) => ({ value: s.id, label: `${s.name} — ${s.role}` }))}
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
        />

        {selected && (
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3">
            <Avatar name={selected.name} color={selected.avatarColor} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{selected.name}</p>
              <p className="truncate text-xs text-slate-500">
                {selected.role} · {selected.department} · {selected.code}
              </p>
            </div>
            <span className={cn('ml-auto shrink-0')}>
              <Chip tone="money">Active</Chip>
            </span>
          </div>
        )}

        <Textarea
          label="Handover note (optional)"
          rows={3}
          placeholder="Anything the assignee should know before picking this file up…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </Modal>
  );
}
