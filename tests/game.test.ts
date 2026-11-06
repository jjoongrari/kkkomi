import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, summarize, pickRound, isPlayable, answerText, safeSourceUrl, sliderBounds, defaultGuess, type Listing } from '../src/lib/game.ts';
const lot = (id='1', price=100000): Listing => ({id,title:'Квартира',location:'Инта',city:'Инта',region:'Республика Коми',area:40,price,images:['/images/a.webp','/images/b.webp'],sourceUrl:'https://www.avito.ru/inta/kvartiry/test_123',active:true,checkedAt:'2026-11-06',verificationSource:'owner_confirmation',propertyType:'apartment',dealType:'sale'});
test('accuracy score, lower bound, rounding and correct difference signs',()=>{
  for(const [guess,points] of [[100000,100],[90000,90],[125000,75],[200000,0],[400000,0],[100500,100]]) assert.equal(evaluate(lot(),guess).points,points);
  assert.match(answerText(evaluate(lot(),90000)),/10 000 ₽ меньше/); assert.match(answerText(evaluate(lot(),110000)),/10 000 ₽ больше/); assert.match(answerText(evaluate(lot(),100000)),/Точное/);
  assert.throws(()=>evaluate(lot(),-1)); assert.throws(()=>evaluate(lot(),NaN)); assert.throws(()=>evaluate(lot(),2.5));
});
test('gross overpayment and underpayment never cancel, net is signed',()=>{
 const a=[evaluate(lot('1'),150000),evaluate(lot('2'),70000),evaluate(lot('3'),100000)];const s=summarize(a);
 assert.equal(s.overpayment,50000);assert.equal(s.underpayment,30000);assert.equal(s.net,20000);assert.equal(s.points,220);
});
test('850 threshold, majority of responses rather than expensive outlier',()=>{
 assert.equal(summarize(Array.from({length:10},()=>evaluate(lot(),85000))).profile,'Адекватный квартирант');
 assert.equal(summarize(Array.from({length:10},()=>evaluate(lot(),84000))).profile,'Жадный студент');
 const answers=[...Array.from({length:6},()=>evaluate(lot(),60000)),...Array.from({length:4},()=>evaluate(lot('2',1000000),1500000))];
 assert.equal(summarize(answers).profile,'Жадный студент');assert.ok(summarize(answers).net>0);
 assert.equal(summarize(Array.from({length:10},()=>evaluate(lot(),150000))).profile,'Транжира');
});
test('tied direction uses relative error, stable largest error tie break',()=>{
 assert.equal(summarize([evaluate(lot(),50000),evaluate(lot(),130000)]).profile,'Жадный студент');
 assert.equal(summarize([evaluate(lot(),150000),evaluate(lot(),50000)]).profile,'Транжира');
});
test('activity, geography, property, verification and photos are required',()=>{
 assert.ok(isPlayable(lot()));
 for(const patch of [{active:false},{active:undefined},{region:'Москва'},{propertyType:'house'},{dealType:'rent'},{verificationSource:'unknown'},{checkedAt:''},{checkedAt:'2026-02-31'},{images:['/images/a.webp']}]) assert.equal(isPlayable({...lot(),...patch} as Listing),false);
 assert.equal(safeSourceUrl('https://avito.ru.evil.example/test'),false);assert.equal(safeSourceUrl('javascript:alert(1)'),false);assert.equal(safeSourceUrl('https://user:pass@avito.ru/test'),false);
});
test('ten unique eligible lots, excludes inactive and duplicate IDs',()=>{
 const pool=Array.from({length:20},(_,i)=>lot(String(i)));const result=pickRound([...pool,lot('1'),{...lot('inactive'),active:false}],()=>0.1);
 assert.equal(result.length,10);assert.equal(new Set(result.map(x=>x.id)).size,10);assert.ok(result.every(isPlayable));assert.throws(()=>pickRound(pool.slice(0,9)));
 const {min,max}=sliderBounds(pool);assert.ok(min<100000&&max>100000);assert.equal(defaultGuess(pool),100000);
});
