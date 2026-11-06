'use client';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { answerText, compactMoney, defaultGuess, evaluate, isPlayable, MAX_SCORE, money, pickRound, ROUND_SIZE, sliderBounds, summarize } from '@/lib/game';
import type { Answer, Listing } from '@/lib/game';
import { parseListingsCsv } from '@/lib/csv';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
const asset = (p: string) => p.startsWith('blob:') ? p : base + p;
type Modal = 'rules' | 'data' | 'import' | 'review' | null;
type Meta = { label: string; region: string; description: string; photoInfo: string; checkedAt?: string };
function Arrow({ back = false }: { back?: boolean }) { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={back ? { transform: 'rotate(180deg)' } : undefined}><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" /></svg>; }
function Mark() { return <svg viewBox="0 0 40 40" width="34" height="34" fill="none" aria-hidden="true"><path d="M5 5h30v30H5zM5 19h17V5m0 14h13M22 35V25M11 12h5M28 12h2M11 27h5" stroke="currentColor" strokeWidth="1.8" /></svg>; }
function Dialog({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; d?.showModal(); return () => d?.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={close} onClick={e => { if (e.target === e.currentTarget) close(); }} aria-labelledby="modal-title"><div className="modal-inner"><header><h2 id="modal-title">{title}</h2><button className="close" onClick={close} aria-label="Закрыть окно">×</button></header>{children}</div></dialog>;
}
function Gallery({ listing, image, setImage }: { listing: Listing; image: number; setImage: (n: number) => void }) {
  const [failed, setFailed] = useState(false); const touch = useRef<number | null>(null);
  useEffect(() => setFailed(false), [listing.id, image]);
  const change = (delta: number) => setImage((image + delta + listing.images.length) % listing.images.length);
  return <div className="gallery" onTouchStart={e => { touch.current = e.touches[0].clientX; }} onTouchEnd={e => { if (touch.current !== null) { const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 40) change(dx > 0 ? -1 : 1); } touch.current = null; }}>
    {failed ? <div className="photo-error">Фото не открылось<button onClick={() => setFailed(false)}>Повторить</button></div> : <img src={asset(listing.images[image])} alt={`${listing.title}. Фото ${image + 1}`} width="208" height="208" decoding="async" fetchPriority="high" onError={() => setFailed(true)} />}
    <span className="photo-tag">ФОТО ИЗ ОБЪЯВЛЕНИЯ</span><span className="photo-count">{image + 1} / {listing.images.length}</span>
    <button className="photo-prev" onClick={() => change(-1)} aria-label="Предыдущее фото"><Arrow back /></button><button className="photo-next" onClick={() => change(1)} aria-label="Следующее фото"><Arrow /></button>
    <div className="dots">{listing.images.map((_, i) => <button key={i} onClick={() => setImage(i)} aria-label={`Фото ${i + 1}`} aria-current={i === image ? 'true' : undefined}><span /></button>)}</div>
  </div>;
}
export default function Game({ initialListing, initialCount, catalogMeta }: { initialListing: Listing; initialCount: number; catalogMeta: Meta }) {
  const [pool, setPool] = useState<Listing[]>([]), [deck, setDeck] = useState<Listing[]>([]);
  const [phase, setPhase] = useState<'intro' | 'playing' | 'result'>('intro'), [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]), [guess, setGuess] = useState(500_000), [image, setImage] = useState(0);
  const [modal, setModal] = useState<Modal>(null), [error, setError] = useState(''), [custom, setCustom] = useState(false);
  const [importError, setImportError] = useState(''), [busy, setBusy] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null), photosRef = useRef<HTMLInputElement>(null), titleRef = useRef<HTMLHeadingElement>(null);
  const lock = useRef(false), animation = useRef(0), blobs = useRef<string[]>([]), bundled = useRef(new Set<string>());
  const listing = deck[index] || initialListing, answer = answers[index], total = summarize(answers);
  const bounds = pool.length ? sliderBounds(pool) : { min: 50_000, max: 2_100_000 };
  const ready = deck.length === ROUND_SIZE;
  useEffect(() => {
    const controller = new AbortController();
    fetch(asset('/data/listings.json'), { signal: controller.signal }).then(r => { if (!r.ok) throw new Error('Не удалось загрузить подборку.'); return r.json(); }).then((data: Listing[]) => {
      if (!Array.isArray(data)) throw new Error('Неверный формат подборки.');
      const eligible = data.filter(isPlayable); setDeck(pickRound(eligible)); setPool(eligible); setGuess(defaultGuess(eligible)); bundled.current = new Set(eligible.flatMap(x => x.images));
    }).catch(e => { if (e.name !== 'AbortError') setError(e.message || 'Обновите страницу, чтобы загрузить подборку.'); });
    return () => controller.abort();
  }, []);
  useEffect(() => { if (phase !== 'intro') titleRef.current?.focus({ preventScroll: true }); }, [phase, index]);
  useEffect(() => () => { cancelAnimationFrame(animation.current); blobs.current.forEach(URL.revokeObjectURL); }, []);
  function stopDemo() { cancelAnimationFrame(animation.current); }
  function demo() {
    let seen = false; try { seen = localStorage.getItem('kvartirnik-komi:slider-seen') === '1'; localStorage.setItem('kvartirnik-komi:slider-seen', '1'); } catch {}
    if (seen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const middle = defaultGuess(pool), start = performance.now();
    const tick = (now: number) => { const t = Math.min(1, (now - start) / 1150); setGuess(Math.round(Math.max(bounds.min, Math.min(bounds.max, middle + Math.sin(t * Math.PI * 2) * (bounds.max - bounds.min) * .17 * (1 - t))) / 1000) * 1000); if (t < 1) animation.current = requestAnimationFrame(tick); else setGuess(middle); };
    animation.current = requestAnimationFrame(tick);
  }
  function start() { if (!ready) return; setDeck(pickRound(pool)); setIndex(0); setImage(0); setAnswers([]); setGuess(defaultGuess(pool)); lock.current = false; setPhase('playing'); demo(); }
  function submit() { if (answer || lock.current || !ready) return; stopDemo(); lock.current = true; setAnswers(old => [...old, evaluate(listing, guess)]); }
  function next() { if (!answer) return; if (index === ROUND_SIZE - 1) setPhase('result'); else { setIndex(i => i + 1); setImage(0); setGuess(defaultGuess(pool)); lock.current = false; } }
  function restart() { stopDemo(); setDeck(pickRound(pool)); setIndex(0); setImage(0); setAnswers([]); setGuess(defaultGuess(pool)); lock.current = false; setPhase('playing'); }
  async function importTable() {
    setImportError(''); const file = csvRef.current?.files?.[0]; if (!file) { setImportError('Выберите CSV-файл.'); return; }
    if (file.size > 5_000_000) { setImportError('Таблица должна быть меньше 5 МБ.'); return; }
    setBusy(true); const created: string[] = [];
    try {
      const { listings, skipped } = parseListingsCsv(await file.text()); if (listings.length < ROUND_SIZE) throw new Error(`Подходят ${listings.length} из ${listings.length + skipped} строк. Нужно 10 активных квартир Коми с двумя фото и подтверждением актуальности.`);
      const files = [...(photosRef.current?.files || [])]; if (files.reduce((s, f) => s + f.size, 0) > 100_000_000) throw new Error('Фотографии должны занимать меньше 100 МБ.');
      const names = new Map<string, File>(); for (const f of files) { if (names.has(f.name)) throw new Error(`Повторяется имя фото: ${f.name}`); names.set(f.name, f); }
      const resolved = new Map<string, string>();
      for (const p of new Set(listings.flatMap(l => l.images))) {
        const photo = names.get(p.split('/').pop()!);
        if (photo) { if (!/^image\/(jpeg|png|webp|avif)$/.test(photo.type)) throw new Error(`Неподдерживаемое фото: ${photo.name}`); const url = URL.createObjectURL(photo); created.push(url); resolved.set(p, url); }
        else if (bundled.current.has(p)) resolved.set(p, p);
        else throw new Error(`Не выбрано фото: ${p.split('/').pop()}`);
      }
      const mapped = listings.map(l => ({ ...l, images: l.images.map(p => resolved.get(p)!) }));
      // Validate status before replacing image paths with local browser blob URLs.
      const selected = pickRound(mapped); stopDemo(); blobs.current.forEach(URL.revokeObjectURL); blobs.current = created;
      setPool(mapped); setDeck(selected); setGuess(defaultGuess(mapped)); setAnswers([]); setIndex(0); setImage(0); setCustom(true); setError(''); lock.current = false; setPhase('intro'); setModal(null);
    } catch (e) { created.forEach(URL.revokeObjectURL); setImportError(e instanceof Error ? e.message : 'Не удалось прочитать таблицу.'); } finally { setBusy(false); }
  }
  const progress = phase === 'result' ? 100 : (index + (answer ? 1 : 0)) / ROUND_SIZE * 100;
  return <div className={`app app-${phase}`}>
    <header className="site-header"><button className="brand" onClick={() => { stopDemo(); setPhase('intro'); }} aria-label="Квартирник Коми — на главную"><Mark /><span>КВАРТИРНИК<span>КОМИ</span></span></button><span className="header-note">ЧУВСТВО ЦЕНЫ</span></header>
    <main>
      {phase === 'intro' && <section className="home-card" aria-labelledby="intro-title"><div className="home-copy"><p className="eyebrow">{custom ? (pool[0]?.city || 'КВАРТИРЫ').toUpperCase() : 'ИНТА'} / РЕСПУБЛИКА КОМИ</p><h1 id="intro-title">Почём<br />свой угол?</h1><p className="intro-description">Узнайте, насколько точно вы чувствуете цены на квартиры в Коми.</p><p className="intro-rule">10 квартир. Двигайте бегунок, оценивайте и сравнивайте с ценой продавца.</p><button className="primary" onClick={start} disabled={!ready}>Запустить игру <Arrow /></button>{error ? <p role="alert" className="error">{error}</p> : <p className="home-meta">{ready ? pool.length : initialCount} квартир в подборке · до 1 000 баллов</p>}</div><div className="home-visual"><span className="visual-top">01 / ЗНАКОМИМСЯ С РЫНКОМ</span><img src={asset((custom ? pool[0] : initialListing).images[0])} width="208" height="208" alt="Интерьер квартиры из подборки Инты" /><div className="visual-bottom"><span>Настоящие квартиры.<br />Ваша интуиция.</span><span className="visual-number">10</span></div></div></section>}
      {phase === 'playing' && <section className={`play-card ${answer ? 'is-answered' : ''}`} aria-labelledby="lot-title"><div className="round-heading"><div><span className="eyebrow">КВАРТИРА</span><span className="round-number">{String(index + 1).padStart(2, '0')} <small>/ 10</small></span></div><span className="score-mini">{total.points} <small>баллов</small></span></div><div className="progress" role="progressbar" aria-label="Прогресс игры" aria-valuemin={0} aria-valuemax={10} aria-valuenow={index + (answer ? 1 : 0)}><span style={{ width: `${progress}%` }} /></div><div className="lot-body"><Gallery listing={listing} image={image} setImage={setImage} /><div className="lot-content"><div className="lot-info"><p className="eyebrow">ПРОДАЖА КВАРТИРЫ</p><h1 id="lot-title" ref={titleRef} tabIndex={-1}>{listing.title}</h1><p className="address">{listing.location}</p></div><div className="estimate"><label htmlFor="price-slider">{answer ? 'Ваша оценка' : 'Сколько стоит эта квартира?'}</label><output htmlFor="price-slider" className="price">{money(guess)}</output><input id="price-slider" type="range" min={bounds.min} max={bounds.max} step={1000} value={guess} disabled={!!answer} aria-valuetext={money(guess)} style={{ '--fill': `${(guess - bounds.min) / (bounds.max - bounds.min) * 100}%` } as CSSProperties} onPointerDown={stopDemo} onKeyDown={stopDemo} onChange={e => { stopDemo(); setGuess(Number(e.target.value)); }} /><div className="range-labels"><span>{compactMoney(bounds.min)}</span><span>{compactMoney(bounds.max)}</span></div></div>{answer ? <div className="feedback" aria-live="polite"><div className="real-price"><span>Цена продавца<strong>{money(answer.listing.price)}</strong></span><span className="points">+{answer.points}<small>баллов</small></span></div><p className="difference">{answerText(answer)}</p><div className="answer-actions"><a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer">Объявление <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.4" /></svg></a><button className="primary" onClick={next}>{index === 9 ? 'Итоги' : 'Дальше'} <Arrow /></button></div></div> : <button className="primary evaluate" onClick={submit}>Оценить <Arrow /></button>}</div></div></section>}
      {phase === 'result' && <section className="result-card" aria-labelledby="result-title"><div className="eyebrow result-kicker">10 ИЗ 10 / ИГРА ЗАВЕРШЕНА</div><div className="result-score">{total.points}<small> / {MAX_SCORE}</small></div><p className="result-label">ВАШЕ ЧУВСТВО ЦЕНЫ</p><h1 id="result-title" ref={titleRef} tabIndex={-1}>{total.profile}</h1><p className="result-description">{total.experienced ? 'Вы хорошо чувствуете рынок: в среднем не менее 85 баллов за квартиру.' : total.tied ? 'Оценок выше и ниже цены поровну. Ваш тип определила относительная величина отклонений.' : total.underCount > total.overCount ? `В ${total.underCount} из 10 случаев вы предложили меньше цены продавца. Умение торговаться — ваш талант.` : `В ${total.overCount} из 10 случаев вы предложили больше цены продавца. Квартиры вам явно приглянулись.`}</p><div className="totals"><div><span>Переплата</span><strong>{money(total.overpayment)}</strong></div><div><span>Недоплата</span><strong>{money(total.underpayment)}</strong></div><div className="net"><span>Общий баланс</span><strong>{total.net > 0 ? '+' : total.net < 0 ? '−' : ''}{money(Math.abs(total.net))}</strong></div></div><div className="result-actions"><button className="primary" onClick={restart}>Сыграть ещё <Arrow /></button><button className="text-button" onClick={() => setModal('review')}>Разбор ответов</button></div></section>}
    </main>
    <footer><span>КВАРТИРНИК КОМИ</span><nav aria-label="Информация"><button onClick={() => setModal('rules')}>Правила</button><button onClick={() => setModal('data')}>О данных</button><button onClick={() => { setImportError(''); setModal('import'); }}>Своя таблица</button></nav></footer>
    {modal && <Dialog title={{ rules: 'Как играть', data: 'О данных', import: 'Своя таблица', review: 'Ваши ответы' }[modal]} close={() => setModal(null)}>
      {modal === 'rules' && <div className="prose"><p>В игре 10 случайных квартир без повторов. Переместите бегунок и нажмите «Оценить». Сравните свою оценку с полной ценой продажи, затем переходите дальше.</p><h3>Баллы за точность</h3><p>100 × (1 − |оценка − цена| / цена), с округлением до целого. Минимум 0, максимум 100 за квартиру и 1 000 за игру. Ошибка 10% даёт 90 баллов; 25% — 75; 100% и больше — 0.</p><h3>Ваш результат</h3><p>От 850 баллов — «Адекватный квартирант». При меньшем счёте результат зависит от числа оценок: чаще ниже цены — «Жадный студент», чаще выше — «Транжира».</p><p>При равенстве числа завышений и занижений сравниваем сумму отклонений в процентах от цен. Если она равна нулю — знак самого большого относительного отклонения.</p><p>Переплата и недоплата считаются отдельно, без взаимного погашения. Общий баланс — их разность: плюс означает переплату.</p></div>}
      {modal === 'data' && <div className="prose"><p>{custom ? 'Вы играете на своей таблице. Статусы и даты актуальности берутся из её строк.' : catalogMeta.description}</p><p>{custom ? 'Фотографии из вашей таблицы загружаются из локальных файлов.' : catalogMeta.photoInfo}</p><p>Это цены продажи из объявлений, а не аренда за месяц и не цены состоявшихся сделок.</p><p>Публикация статическая: при запуске игры сайт фильтрует записи по сохранённым статусам. Доступность объявления в реальном времени не проверяется. Для обновления подборки замените CSV и фотографии.</p><p>Оформление вдохновлено типографикой и синим цветом сайта НИУ ВШЭ. Это самостоятельный учебный прототип.</p><a className="download" href={asset('/data/source.csv')} download>Скачать встроенную таблицу</a></div>}
      {modal === 'import' && <div className="prose"><p>Загрузите CSV и соответствующие фотографии. Данные останутся в этом браузере до перезагрузки страницы.</p><a className="download" href={asset('/data/template.csv')} download>Скачать шаблон CSV</a><p>Нужно минимум 10 квартир Республики Коми: active=true, apartment, sale, две фотографии, ссылка на объявление, checkedAt и verificationSource. Неподтверждённые и неактивные строки исключаются.</p><label className="file-label">Таблица CSV<input ref={csvRef} type="file" accept=".csv,text/csv" /></label><label className="file-label">Фотографии из столбца images<input ref={photosRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple /></label><p className="muted">Названия файлов должны совпадать с CSV. Несколько путей в images разделяются точкой с запятой. Все фото можно выбрать сразу.</p>{importError && <p className="error" role="alert">{importError}</p>}<button className="primary" disabled={busy} onClick={importTable}>{busy ? 'Проверяем…' : 'Использовать таблицу'} <Arrow /></button></div>}
      {modal === 'review' && <div className="review-list">{answers.map((a, i) => <article key={a.listing.id}><div><span className="eyebrow">КВАРТИРА {i + 1} · {a.points} БАЛЛОВ</span><h3>{a.listing.title}</h3><p>{a.listing.location}</p></div><p>Оценка: {money(a.guess)}<br />Цена: {money(a.listing.price)}</p><p>{answerText(a)}</p><a href={a.listing.sourceUrl} target="_blank" rel="noopener noreferrer">Объявление ↗</a></article>)}</div>}
    </Dialog>}
  </div>;
}
