import fs from 'node:fs/promises';
import path from 'node:path';
import { parseListingsCsv } from '../src/lib/csv.ts';
const filename = process.argv[2];
if (!filename) { console.error('Usage: npm run import:csv -- /path/table.csv'); process.exit(1); }
const root = path.resolve(import.meta.dirname, '..');
const text = await fs.readFile(filename, 'utf8');
const { listings, skipped } = parseListingsCsv(text);
if (listings.length < 10) throw new Error('Нужно минимум 10 активных квартир Коми с двумя фотографиями и подтверждением актуальности.');
for (const item of listings) for (const image of item.images) await fs.access(path.join(root, 'public', image));
const dates = [...new Set(listings.map(l => l.checkedAt))].sort();
await fs.writeFile(path.join(root, 'public/data/listings.json'), JSON.stringify(listings));
await fs.writeFile(path.join(root, 'public/data/source.csv'), text);
await fs.writeFile(path.join(root, 'public/data/catalog-meta.json'), JSON.stringify({ label:'Квартиры Коми',region:'Республика Коми',description:`${listings.length} квартир из импортированной таблицы. Даты проверки в источнике: ${dates.join(', ')}. Способ проверки указан в verificationSource каждой строки.`,photoInfo:'Фотографии сохранены локально. Внешние фотосерверы не используются.' }, null, 2));
console.log(`Imported ${listings.length} listings; excluded ${skipped} unsuitable rows. Rebuild with npm run build.`);
