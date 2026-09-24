import type { Activity, EventSession } from './types';
import { activitySegment, applyActivitySegment, applyEventUpdate, createEvent, createSegment, eventDraft } from './event';

// Every activity prepares its sample in a fresh event, never in the host's library.
export async function createDemoEvent(activity: Activity): Promise<EventSession> {
  if (!activity.createDemo) throw new Error('This activity does not include a demo.');
  const event = createEvent();
  event.segments = [createSegment(activity)]; event.phase = 'segment'; event.isDemo = true;
  const prepared = await activity.createDemo(activitySegment(event, 0), eventDraft(event));
  prepared.segment.isDemo = true; prepared.event.isDemo = true;
  activity.startNewGame(prepared.segment, prepared.event);
  applyActivitySegment(event, 0, prepared.segment);
  applyEventUpdate(event, prepared.event);
  event.isDemo = true;
  return event;
}
