import { z } from 'zod';
import data from './inventions.json';
import { cardSchema } from './types';
export const inventions = z.array(cardSchema).min(15).parse(data);
if (new Set(inventions.map(c => c.id)).size !== inventions.length) throw new Error('Invention IDs must be unique.');
export const availableRounds = Math.min(inventions.filter(c => c.kind === 'fiction').length, Math.floor(inventions.filter(c => c.kind === 'real').length / 2));
