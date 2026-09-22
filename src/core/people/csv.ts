// RFC 4180-style quoted fields, escaped quotes, CRLF, and UTF-8 BOM.
export function parseCSV(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '');
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '"' && field.length === 0 && !closed) quoted = true;
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field.trim()); field = ''; closed = false;
      if (c !== ',') { if (row.some(Boolean)) rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
    } else { if (closed && c.trim()) throw new Error('Unexpected characters after a quoted CSV field.'); field += c; }
  }
  if (quoted) throw new Error('A quoted CSV field is not closed.');
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseNames(text: string) {
  const rows = parseCSV(text);
  const header = rows[0]?.map(s => s.toLowerCase());
  const nameColumn = header?.indexOf('name') ?? -1;
  const factColumn = header?.findIndex(s => s === 'fun fact' || s === 'funfact') ?? -1;
  return (nameColumn >= 0 ? rows.slice(1) : rows).map(row => ({ name: row[nameColumn >= 0 ? nameColumn : 0]?.trim() ?? '', funFact: factColumn >= 0 ? row[factColumn] ?? '' : row[1] ?? '' }));
}
export function exportNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name, i) => {
    const safe = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\.+$/g, '').trim().slice(0, 100) || `Person ${i + 1}`;
    let unique = safe, suffix = 2;
    while (used.has(unique.toLowerCase())) unique = `${safe} (${suffix++})`;
    used.add(unique.toLowerCase()); return unique;
  });
}
