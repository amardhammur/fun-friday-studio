import type { EventUpdate, PreparedActivity } from '../../../src/core/types';
import type { AIOSegment, GameState, Settings } from '../types';
// Every other demo in this app has to generate images in a worker first. This one has nothing to
// prepare, which is the point: it proves createDemo is a contract and not a photo hook.
export async function loadDemo(segment: AIOSegment, event: EventUpdate): Promise<PreparedActivity<Settings, GameState>> {
  return { segment: { ...segment, isDemo: true }, event: { ...event, isDemo: true, title: 'Act It Out · demo' } };
}
