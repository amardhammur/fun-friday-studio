import { describe, expect, it } from 'vitest';
import { exportNames, parseCSV, parseNames } from '../../src/core/people/csv';
describe('name imports and filenames', () => {
  it('reads Unicode, BOM, CRLF, quoted commas and escaped quotes', () => {
    expect(parseNames('\uFEFFName,Fun fact\r\n"Dhammur, Amar","Says ""hello"""\r\nಮಾಯಾ,Artist\r\n')).toEqual([{ name: 'Dhammur, Amar', funFact: 'Says "hello"' }, { name: 'ಮಾಯಾ', funFact: 'Artist' }]);
  });
  it('reads headerless names and skips blank rows', () => { expect(parseNames(' Asha \n\nLeo\n  \n')).toEqual([{ name: 'Asha', funFact: '' }, { name: 'Leo', funFact: '' }]); });
  it('allows a quoted multiline field', () => { expect(parseCSV('Asha,"line one\nline two"')[0][1]).toBe('line one\nline two'); });
  it('reports malformed quotes', () => { expect(() => parseCSV('"unclosed')).toThrow(); expect(() => parseCSV('"closed"bad')).toThrow(); });
  it('avoids filename collisions and path characters', () => {
    expect(exportNames(['Asha', 'asha', 'Asha (2)', '../Dev', ''])).toEqual(['Asha', 'asha (2)', 'Asha (2) (2)', '..-Dev', 'Person 5']);
  });
  it('recognizes headers regardless of column order', () => { expect(parseNames('Fun fact,Name\nDancer,Asha')).toEqual([{ name: 'Asha', funFact: 'Dancer' }]); });
});
