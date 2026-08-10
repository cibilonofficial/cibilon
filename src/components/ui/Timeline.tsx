import { Check, CircleDashed, TriangleAlert, X } from 'lucide-react';
import { PIPELINE, PIPELINE_LABELS, STATUS_PIPELINE_ANCHOR } from '@/lib/constants';
import { cn, formatDateTime } from '@/lib/utils';
import type { Application, ApplicationStatus, TimelineEvent } from '@/types';

type NodeState = 'done' | 'current' | 'blocked' | 'failed' | 'upcoming';

function nodeStates(status: ApplicationStatus): Record<string, NodeState> {
  const anchor = STATUS_PIPELINE_ANCHOR[status];
  const anchorIndex = PIPELINE.indexOf(anchor);
  const blocked =
    status === 'Documents Required' || status === 'Additional Information Required';
  const failed = status === 'Rejected';

  const states: Record<string, NodeState> = {};
  PIPELINE.forEach((stage, i) => {
    if (i < anchorIndex) states[stage] = 'done';
    else if (i === anchorIndex)
      states[stage] = failed ? 'failed' : blocked ? 'blocked' : 'current';
    else states[stage] = 'upcoming';
  });

  // A completed file has every node behind it.
  if (status === 'Completed') PIPELINE.forEach((stage) => (states[stage] = 'done'));
  return states;
}

const NODE_STYLES: Record<NodeState, { ring: string; dot: string; text: string }> = {
  done: { ring: 'bg-money-600 text-white', dot: '', text: 'text-slate-700' },
  current: {
    ring: 'bg-brand-700 text-white ring-4 ring-brand-100',
    dot: '',
    text: 'text-brand-900 font-semibold',
  },
  blocked: {
    ring: 'bg-amber-500 text-white ring-4 ring-amber-100',
    dot: '',
    text: 'text-amber-800 font-semibold',
  },
  failed: {
    ring: 'bg-rose-600 text-white ring-4 ring-rose-100',
    dot: '',
    text: 'text-rose-800 font-semibold',
  },
  upcoming: { ring: 'bg-white text-slate-300 ring-1 ring-slate-300', dot: '', text: 'text-slate-400' },
};

function NodeIcon({ state }: { state: NodeState }) {
  if (state === 'done') return <Check className="size-3.5" strokeWidth={3} />;
  if (state === 'failed') return <X className="size-3.5" strokeWidth={3} />;
  if (state === 'blocked') return <TriangleAlert className="size-3.5" strokeWidth={2.5} />;
  if (state === 'current') return <span className="size-2 rounded-full bg-white" />;
  return <CircleDashed className="size-3.5" />;
}

/** Vertical pipeline with the current stage highlighted. */
export function ApplicationTimeline({ application }: { application: Application }) {
  const states = nodeStates(application.status);
  const eventsByStage = new Map<string, TimelineEvent>();
  application.timeline.forEach((e) => {
    if (!eventsByStage.has(e.stage)) eventsByStage.set(e.stage, e);
  });

  const exceptionEvent = application.timeline.find(
    (e) =>
      e.stage === 'Documents Required' ||
      e.stage === 'Additional Information Required' ||
      e.stage === 'Rejected',
  );

  return (
    <ol className="relative">
      {PIPELINE.map((stage, i) => {
        const state = states[stage];
        const event = eventsByStage.get(stage);
        const style = NODE_STYLES[state];
        const isLast = i === PIPELINE.length - 1;
        const showException =
          exceptionEvent && STATUS_PIPELINE_ANCHOR[application.status] === stage;

        return (
          <li key={stage} className="relative flex gap-3.5 pb-6 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 rounded',
                  state === 'done' ? 'bg-money-500/50' : 'bg-slate-200',
                )}
              />
            )}

            <span
              className={cn(
                'z-10 flex size-7 shrink-0 items-center justify-center rounded-full',
                style.ring,
              )}
            >
              <NodeIcon state={state} />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cn('text-sm', style.text)}>{PIPELINE_LABELS[stage] ?? stage}</p>
              {event ? (
                <>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateTime(event.at)} · {event.actor}
                  </p>
                  {event.note && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{event.note}</p>
                  )}
                </>
              ) : (
                <p className="mt-0.5 text-xs text-slate-400">Pending</p>
              )}

              {showException && exceptionEvent && (
                <div
                  className={cn(
                    'mt-2.5 rounded-lg border px-3 py-2.5',
                    exceptionEvent.stage === 'Rejected'
                      ? 'border-rose-200 bg-rose-50'
                      : 'border-amber-200 bg-amber-50',
                  )}
                >
                  <p
                    className={cn(
                      'text-[13px] font-semibold',
                      exceptionEvent.stage === 'Rejected' ? 'text-rose-800' : 'text-amber-800',
                    )}
                  >
                    {exceptionEvent.label}
                  </p>
                  {exceptionEvent.note && (
                    <p
                      className={cn(
                        'mt-1 text-[13px] leading-relaxed',
                        exceptionEvent.stage === 'Rejected' ? 'text-rose-700' : 'text-amber-700',
                      )}
                    >
                      {exceptionEvent.note}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(exceptionEvent.at)} · {exceptionEvent.actor}
                  </p>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Chronological audit log — every event, newest first. */
export function ActivityLog({ events }: { events: TimelineEvent[] }) {
  if (!events.length) {
    return <p className="text-sm text-slate-500">No activity recorded yet.</p>;
  }
  return (
    <ol className="space-y-4">
      {[...events].reverse().map((event) => (
        <li key={event.id} className="flex gap-3">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-slate-800">{event.label}</p>
            {event.note && <p className="mt-0.5 text-[13px] text-slate-600">{event.note}</p>}
            <p className="mt-0.5 text-xs text-slate-400">
              {formatDateTime(event.at)} · {event.actor}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Compact horizontal stepper used by the multi-step lead form. */
export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: string[];
  current: number;
  onSelect?: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto scrollbar-none">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onSelect?.(i)}
              disabled={!onSelect || i > current}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors',
                onSelect && i <= current && 'hover:bg-slate-100',
                (!onSelect || i > current) && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  done && 'bg-money-600 text-white',
                  active && 'bg-brand-900 text-white',
                  !done && !active && 'bg-slate-200 text-slate-500',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[13px]',
                  active ? 'font-semibold text-slate-900' : 'text-slate-500',
                )}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn('mx-1 h-px w-5 shrink-0', done ? 'bg-money-500' : 'bg-slate-200')}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
