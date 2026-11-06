export type Listing = {
  id: string; title: string; location: string; price: number; area: number;
  floor?: number; floors?: number; city: string; region: string;
  propertyType: 'apartment'; dealType: 'sale'; images: string[]; sourceUrl: string;
  active: boolean; checkedAt: string; verificationSource: 'owner_confirmation' | 'page_check';
};
export type Answer = { listing: Listing; guess: number; points: number; difference: number; error: number };
export const ROUND_SIZE = 10;
export const MAX_SCORE = ROUND_SIZE * 100;
export function safeSourceUrl(value: string): boolean {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && ['avito.ru', 'cian.ru', 'realty.yandex.ru'].some(h => u.hostname === h || u.hostname.endsWith('.' + h)); } catch { return false; }
}
export function isPlayable(item: Listing): boolean {
  return item.active === true && item.propertyType === 'apartment' && item.dealType === 'sale'
    && /^Республика Коми$/i.test(item.region) && ['owner_confirmation', 'page_check'].includes(item.verificationSource)
    && /^\d{4}-\d{2}-\d{2}$/.test(item.checkedAt) && Number.isFinite(Date.parse(item.checkedAt))
    && new Date(item.checkedAt).toISOString().slice(0, 10) === item.checkedAt
    && Number.isSafeInteger(item.price) && item.price > 0 && Array.isArray(item.images) && item.images.length >= 2 && safeSourceUrl(item.sourceUrl);
}
export function pickRound(pool: Listing[], random: () => number = Math.random): Listing[] {
  const unique = [...new Map(pool.filter(isPlayable).map(item => [item.id, item])).values()];
  if (unique.length < ROUND_SIZE) throw new Error('Нужно минимум 10 активных квартир в Республике Коми с двумя фотографиями.');
  for (let i = unique.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [unique[i], unique[j]] = [unique[j], unique[i]]; }
  return unique.slice(0, ROUND_SIZE);
}
export function evaluate(listing: Listing, guess: number): Answer {
  if (!Number.isSafeInteger(guess) || guess < 0 || !Number.isSafeInteger(listing.price) || listing.price <= 0) throw new Error('Укажите целую неотрицательную цену.');
  const difference = guess - listing.price, error = Math.abs(difference) / listing.price;
  return { listing, guess, difference, error, points: Math.round(100 * Math.max(0, 1 - error)) };
}
export function summarize(answers: Answer[]) {
  const points = answers.reduce((s, a) => s + a.points, 0);
  const overpayment = answers.reduce((s, a) => s + Math.max(0, a.difference), 0);
  const underpayment = answers.reduce((s, a) => s + Math.max(0, -a.difference), 0);
  const overCount = answers.filter(a => a.difference > 0).length, underCount = answers.filter(a => a.difference < 0).length;
  const averageError = answers.length ? answers.reduce((s, a) => s + a.error, 0) / answers.length : 0;
  const experienced = answers.length > 0 && points / answers.length >= 85;
  let direction = Math.sign(overCount - underCount);
  if (!direction) direction = Math.sign(answers.reduce((s, a) => s + a.difference / a.listing.price, 0));
  if (!direction) direction = Math.sign([...answers].sort((a, b) => b.error - a.error)[0]?.difference || 0);
  const profile = experienced ? 'Адекватный квартирант' : direction < 0 ? 'Жадный студент' : 'Транжира';
  return { points, overpayment, underpayment, net: overpayment - underpayment, overCount, underCount, averageError, profile, experienced, tied: overCount === underCount };
}
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
export function money(value: number) { return `${number.format(Math.round(value))} ₽`; }
export function compactMoney(value: number) {
  const amount = value >= 1_000_000 ? value / 1_000_000 : value / 1_000;
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(amount)} ${value >= 1_000_000 ? 'млн' : 'тыс.'} ₽`;
}
export function answerText(answer: Answer): string {
  return answer.difference === 0 ? 'Точное попадание в цену объявления.' : `Ваша оценка на ${money(Math.abs(answer.difference))} ${answer.difference > 0 ? 'больше' : 'меньше'} цены объявления.`;
}
export function sliderBounds(pool: Listing[]) {
  const prices = pool.map(x => x.price);
  return { min: Math.max(0, Math.floor(Math.min(...prices) / 2 / 10_000) * 10_000), max: Math.ceil(Math.max(...prices) * 1.2 / 100_000) * 100_000 };
}
export function defaultGuess(pool: Listing[]) {
  const sorted = pool.map(x => x.price).sort((a, b) => a - b);
  return Math.round(sorted[Math.floor(sorted.length / 2)] / 1000) * 1000;
}
