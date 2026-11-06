import test from 'node:test';import assert from 'node:assert/strict';
import {parseCsv,parseListingsCsv,localImagePath} from '../src/lib/csv.ts';
const header='id,title,price,area,location,region,active,checkedAt,verificationSource,sourceUrl,images';
const row='1,"Квартира, 2 комнаты",100000,40,Инта,Республика Коми,true,2026-11-06,owner_confirmation,https://www.avito.ru/inta/test_123,/images/a.webp;/images/b.webp';
test('CSV quoted commas, newlines, BOM and semicolon delimiter',()=>{
 assert.deepEqual(parseCsv('\uFEFFa;b\r\n"one;two";"three\nline"'),[['a','b'],['one;two','three\nline']]);
 assert.deepEqual(parseCsv('a,b\n"""hello""",x')[1],['"hello"','x']);assert.throws(()=>parseCsv('a,b\n"oops'));
 assert.equal(parseListingsCsv(header+'\n'+row).listings[0].title,'Квартира, 2 комнаты');
});
test('CSV filters unconfirmed, inactive, other regions and duplicate IDs',()=>{
 const result=parseListingsCsv(header+'\n'+[row,row,row.replace(',true,',',false,'),row.replace('Республика Коми','Москва'),row.replace('owner_confirmation','unknown'),row.replace(';/images/b.webp','')].join('\n'));
 assert.equal(result.listings.length,1);assert.equal(result.skipped,5);assert.throws(()=>parseListingsCsv('id,title\n1,x'),/Не хватает/);
});
test('CSV blocks remote, executable and traversing image paths',()=>{
 for(const p of ['//evil.example/a.webp','https://evil.example/a.jpg','/images/../a.jpg','/images//a.jpg','/images/a.svg']) assert.throws(()=>localImagePath(p));
 assert.equal(localImagePath('images/a.webp'),'/images/a.webp');
 assert.equal(parseListingsCsv(header+'\n'+row.replace('https://www.avito.ru/inta/test_123','https://evil.example/a')).listings.length,0);
});
