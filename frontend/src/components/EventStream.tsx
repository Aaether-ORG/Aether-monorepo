import type { AetherEvent } from '@/lib/types';
import { EventCard } from './EventCard';

export function EventStream({
  events,
  emptyText = 'No events yet — run an agent to see activity flow here.',
}: {
  events: AetherEvent[];
  emptyText?: string;
}) {
  if (events.length === 0) {
    return (
      <div className="card text-center text-ink-400 py-12">
        <span className="text-4xl block mb-2">∅</span>
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((e, i) => (
        <EventCard key={`${e.type}-${i}-${e.ts}`} event={e} index={i} />
      ))}
    </div>
  );
}
