import data from './puzzles.json';
import { z } from 'zod';
import { puzzleSchema } from './types';
export const puzzles = z.array(puzzleSchema).min(15).parse(data);
if (new Set(puzzles.map(p => p.id)).size !== puzzles.length) throw new Error('Wait, Why? puzzle IDs must be unique.');
