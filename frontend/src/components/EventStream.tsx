import type { AetherEvent } from '@/lib/types';
import { EventCard } from './EventCard';

export function EventStream({
  events,
  emptyText = 'Awaiting carrier — initiate a run to begin recording.',
}: {
  events: AetherEvent[];
  emptyText?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="bracket-frame text-center py-14 select-none">
        <div className="font-mono text-[0.7rem] uppercase tracking-widest text-ferric/80 mb-3">
          ▌ NO&nbsp;SIGNAL
        </div>
        <div className="text-bone-dim text-sm max-w-md mx-auto">{emptyText}</div>
        <div className="mt-6 flex justify-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1 h-3 bg-rule-bright"
              style={{ animation: `pulse-soft 1.6s ease-in-out ${i * 0.12}s infinite` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bracket-frame-flush">
      <div className="border-b border-rule px-4 py-2 flex items-center justify-between">
        <span className="panel-heading">EVENT&nbsp;TAPE</span>
        <span className="font-mono text-[0.66rem] tracking-widest text-bone-dim/70 nums-tabular">
          REC&nbsp;·&nbsp;{String(events.length).padStart(3, '0')}&nbsp;FRAMES
        </span>
      </div>
      <div className="tape divide-y divide-rule">
        {events.map((e, i) => (
          <EventCard key={`${e.type}-${i}-${e.ts}`} event={e} index={i} />
        ))}
      </div>
    </div>
  );
}
