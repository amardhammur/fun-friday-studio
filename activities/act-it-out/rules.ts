import type { Settings } from './types';
// Every place that states the rule reads it from here, so setup and the projector never disagree.
export const rules: Record<Settings['rule'], { label: string; hint: string; setup: string; stage: string; card?: string }> = {
  act: {
    label: 'Act it', hint: 'Classic charades, no talking',
    setup: 'Everyone else can see the screen. No talking, no spelling, no pointing at the answer.',
    stage: 'Pick one teammate to sit with their back to the screen. Everyone else acts. No talking, no spelling, no pointing at the words.',
  },
  describe: {
    label: 'Describe it', hint: 'Talk around it, never say it',
    setup: 'Everyone else can see the screen and talks them to the answer. Say anything except the words on the card or any part of them. No spelling it out.',
    stage: 'Pick one teammate to sit with their back to the screen. Everyone else talks them to it. Say anything, act if you like, but never the words on the card.',
    card: 'Don’t say the words',
  },
};
