/* Рыночный король в Горбушке — игра поверх 3D-модели (подключается после novaya-gorbushka-3d.html). */
(() => {
'use strict';
const GAME = window.GAME = { lock: false, camHook: null };
/* =====================================================================
   «Рыночный король» в Горбушке.
   Сюжет, персонажи, покупатели, торг и экономика взяты из игры «Рыночный король» (index_game.html)
   и перенесены в 3D-модель: твой павильон — G2-103, герои стоят в своих местах ТЦ.
   Этот файл: данные (тексты оригинала сохранены).
   ===================================================================== */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const rndi = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const lerp = (a, b, t) => a + (b - a) * t;
function wpick(items, wf) {
  let t = 0; const ws = items.map((i) => { const w = Math.max(0, wf(i)); t += w; return w; });
  if (t <= 0) return null;
  let r = Math.random() * t;
  for (let i = 0; i < items.length; i++) { if ((r -= ws[i]) < 0) return items[i]; }
  return items[items.length - 1];
}
const fmt = (n) => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('ru-RU').replace(/\s/g, ' ');
const rub = (n) => fmt(n) + ' ₽';
function krub(n) { const a = Math.abs(n), s = n < 0 ? '−' : ''; if (a >= 1e6) return s + (a / 1e6).toFixed(2).replace('.', ',') + ' млн'; if (a >= 1e5) return s + Math.round(a / 1000) + ' тыс'; return s + fmt(a); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function nice(v) {
  if (v < 300) return Math.max(50, Math.round(v / 10) * 10);
  if (v < 3000) return Math.round(v / 50) * 50 - 10 * (v > 900 ? 1 : 0);
  if (v < 20000) return Math.round(v / 100) * 100 - 10 * (v > 9000 ? 1 : 0);
  return Math.round(v / 500) * 500;
}
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => (o[k] !== undefined ? o[k] : m));
const WEEK = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000 * (window.__waitK || 1)));   // __waitK — только для автотестов

/* ---------- товары ---------- */
const PRODUCTS = [
  { id: 'case', name: 'Чехол', acc: 'чехол', g: 'm', cost: 250, price: 700, lv: 1, size: 's', tags: ['student', 'office', 'granny', 'tourist'], cross: [], rep: false },
  { id: 'charger', name: 'Зарядка', acc: 'зарядку', g: 'f', cost: 450, price: 1200, lv: 1, size: 's', tags: ['student', 'office', 'tourist', 'granny'], cross: [], rep: false },
  { id: 'powerbank', name: 'Пауэрбанк', acc: 'пауэрбанк', g: 'm', cost: 1100, price: 2400, lv: 1, size: 's', tags: ['student', 'blogger', 'tourist'], cross: ['charger'], rep: false },
  { id: 'buds', name: 'Наушники', acc: 'наушники', g: 'p', cost: 1800, price: 3900, lv: 1, size: 's', tags: ['student', 'gamer', 'office'], cross: ['case'], rep: true, sz: 's' },
  { id: 'phone', name: 'Смартфон', acc: 'смартфон', g: 'm', cost: 14000, price: 24000, lv: 1, size: 'm', tags: ['student', 'office', 'granny', 'blogger'], cross: ['case', 'charger', 'buds', 'powerbank'], rep: true, sz: 's' },
  { id: 'band', name: 'Фитнес-браслет', acc: 'фитнес-браслет', g: 'm', cost: 1500, price: 3300, lv: 2, size: 's', tags: ['office', 'granny', 'student'], cross: ['charger'], rep: true, sz: 's' },
  { id: 'mouse', name: 'Игровая мышь', acc: 'игровую мышь', g: 'f', cost: 1300, price: 2900, lv: 2, size: 's', tags: ['gamer', 'office'], cross: [], rep: true, sz: 's' },
  { id: 'speaker', name: 'Колонка', acc: 'колонку', g: 'f', cost: 2200, price: 4700, lv: 2, size: 'm', tags: ['student', 'tourist', 'gamer'], cross: ['powerbank'], rep: true, sz: 's' },
  { id: 'watch', name: 'Смарт-часы', acc: 'смарт-часы', g: 'p', cost: 5200, price: 10500, lv: 3, size: 's', tags: ['office', 'blogger'], cross: ['charger'], rep: true, sz: 's' },
  { id: 'tablet', name: 'Планшет', acc: 'планшет', g: 'm', cost: 17000, price: 29000, lv: 3, size: 'm', tags: ['granny', 'student', 'office'], cross: ['case', 'charger'], rep: true, sz: 'l' },
  { id: 'actioncam', name: 'Экшн-камера', acc: 'экшн-камеру', g: 'f', cost: 9000, price: 16500, lv: 4, size: 's', tags: ['blogger', 'tourist'], cross: ['powerbank'], rep: true, sz: 's' },
  { id: 'laptop', name: 'Ноутбук', acc: 'ноутбук', g: 'm', cost: 42000, price: 68000, lv: 4, size: 'l', tags: ['office', 'student'], cross: ['mouse', 'charger'], rep: true, sz: 'l' },
  { id: 'console', name: 'Приставка', acc: 'приставку', g: 'f', cost: 26000, price: 42000, lv: 5, size: 'l', tags: ['gamer'], cross: ['speaker', 'buds'], rep: true, sz: 'l' },
  { id: 'vr', name: 'VR-шлем', acc: 'VR-шлем', g: 'm', cost: 22000, price: 37000, lv: 6, size: 'm', tags: ['gamer', 'blogger'], cross: ['powerbank'], rep: true, sz: 'l' },
  { id: 'drone', name: 'Дрон', acc: 'дрон', g: 'm', cost: 30000, price: 50000, lv: 7, size: 'l', tags: ['blogger', 'tourist'], cross: ['powerbank'], rep: true, sz: 'l' },
];
const PM = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const COND = {
  new: { name: 'Новый', k: 1 }, A: { name: 'Как новый', k: 0.82 }, R: { name: 'Восстановлен', k: 0.78 },
  B: { name: 'Б/у', k: 0.6 }, C: { name: 'Неисправен', k: 0.22 },
};
const FAULTS = {
  screen: { name: 'Экран', sym: ['полосы на экране', 'экран не реагирует на касания', 'трещина и чёрное пятно на экране', 'экран мигает'] },
  battery: { name: 'Батарея', sym: ['садится за час', 'выключается на 30%', 'батарея вздулась, корпус поднимает', 'держит заряд полдня'] },
  port: { name: 'Разъём', sym: ['не заряжается', 'заряжается, только если держать провод', 'шатается гнездо зарядки'] },
  speaker: { name: 'Динамик', sym: ['хрипит на громкости', 'пропал звук', 'звук тихий и с треском'] },
  button: { name: 'Кнопка', sym: ['кнопка не нажимается', 'кнопка залипла', 'кнопка срабатывает через раз'] },
  fan: { name: 'Кулер', sym: ['шумит как пылесос и сильно греется', 'выключается от перегрева'] },
  keyboard: { name: 'Клавиатура', sym: ['не работает половина клавиш', 'залили клавиатуру чаем'] },
  drive: { name: 'Привод', sym: ['не читает диски', 'диск не выезжает и трещит'] },
  motor: { name: 'Мотор', sym: ['один винт не крутится', 'заваливается набок при взлёте'] },
  lens: { name: 'Оптика', sym: ['картинка мутная', 'трещина на объективе'] },
  board: { name: 'Плата', sym: ['уронили в воду, не включается', 'сам перезагружается'] },
};
const PART_PRICE = {
  s: { screen: 1900, battery: 900, port: 450, speaker: 600, button: 300, fan: 800, keyboard: 1500, drive: 2500, motor: 1200, lens: 1400, board: 0 },
  l: { screen: 5600, battery: 2600, port: 1200, speaker: 1500, button: 600, fan: 1400, keyboard: 3200, drive: 4200, motor: 2400, lens: 3000, board: 0 },
};
const DEVREP = {
  phone: { f: ['screen', 'battery', 'port', 'speaker', 'button'] },
  buds: { f: ['battery', 'speaker', 'port'], sym: { speaker: ['один наушник не играет', 'левый наушник хрипит'], battery: ['кейс садится за день'] } },
  band: { f: ['screen', 'battery', 'port'], sym: { port: ['не заряжается от магнита', 'окислились контакты зарядки'], screen: ['экран не загорается', 'трещина на экранчике'] } },
  mouse: { f: ['button', 'port'], sym: { button: ['сама делает двойной клик', 'левая кнопка не нажимается'], port: ['отключается, если пошевелить провод'] } },
  speaker: { f: ['speaker', 'battery', 'port'], sym: { battery: ['играет 15 минут и садится', 'выключается на громкости'], speaker: ['хрипит на басах', 'пропал звук, а огонёк горит'] } },
  watch: { f: ['screen', 'battery', 'button'], sym: { screen: ['экран не горит, но вибрирует', 'стекло в трещинах'], button: ['колёсико не крутится', 'кнопка сбоку залипла'] } },
  tablet: { f: ['screen', 'battery', 'port', 'speaker'] },
  actioncam: { f: ['lens', 'battery', 'port', 'screen'], sym: { lens: ['видео мутное', 'трещина на объективе'] } },
  laptop: { f: ['screen', 'battery', 'keyboard', 'fan', 'port'], sym: { screen: ['матрица мигает', 'экран тёмный, а звук есть'], port: ['не заряжается от сети'] } },
  console: { f: ['drive', 'fan', 'port'], sym: { port: ['нет картинки на телевизоре', 'шатается HDMI'] } },
  vr: { f: ['lens', 'battery', 'port'], sym: { lens: ['в шлеме всё двоится', 'царапина на линзе'] } },
  drone: { f: ['motor', 'battery', 'lens'], sym: { lens: ['камера снимает мутно'], battery: ['летает две минуты', 'батарея вздулась'] } },
};
const devFaults = (pid) => (DEVREP[pid] || DEVREP.phone).f;
function devSym(pid, f) { const o = DEVREP[pid] && DEVREP[pid].sym && DEVREP[pid].sym[f]; return pick(o || FAULTS[f].sym); }
const szOf = (pid) => PM[pid].sz || 's';

/* ---------- редкости и коллекции ---------- */
const RARES = [
  { id: 'r_pager', name: 'Пейджер', year: 1996, val: 9000, col: 'svyaz', stars: 1, lore: 'Сообщения через оператора: «Перезвони маме». Сейчас таких почти не осталось.' },
  { id: 'r_flip', name: 'Раскладушка', year: 2004, val: 8000, col: 'svyaz', stars: 1, lore: 'Щелчок крышкой — лучший способ закончить разговор.' },
  { id: 'r_brick', name: 'Телефон-кирпич', year: 1993, val: 30000, col: 'svyaz', stars: 3, lore: 'Весит как гантель, звонит как танк. Мечта любого музея.' },
  { id: 'r_tamagotchi', name: 'Электропитомец', year: 1997, val: 7000, col: 'games', stars: 1, lore: 'Его надо кормить, гладить и не забывать. Этот, кажется, ещё жив.' },
  { id: 'r_handheld', name: 'Карманная консоль', year: 1990, val: 18000, col: 'games', stars: 2, lore: 'Четыре оттенка зелёного и сто часов тетриса.' },
  { id: 'r_retro', name: 'Ретро-приставка', year: 1993, val: 22000, col: 'games', stars: 2, lore: 'Подуй в картридж — и всё заработает.' },
  { id: 'r_cassette', name: 'Кассетный плеер', year: 1989, val: 12000, col: 'analog', stars: 1, lore: 'Карандаш в комплекте не прилагается, но очень нужен.' },
  { id: 'r_polaroid', name: 'Моменталка', year: 1985, val: 15000, col: 'analog', stars: 2, lore: 'Фото проявляется прямо в руке. Трясти не обязательно.' },
  { id: 'r_vinyl', name: 'Проигрыватель', year: 1978, val: 26000, col: 'analog', stars: 3, lore: 'Тёплый звук, лёгкий треск и коробка пластинок впридачу.' },
  { id: 'r_calcwatch', name: 'Часы-калькулятор', year: 1984, val: 6000, col: 'analog', stars: 1, lore: 'Можно посчитать сдачу, не доставая телефон. Гениально.' },
];
const RM = Object.fromEntries(RARES.map((r) => [r.id, r]));
const COLLECTIONS = [
  { id: 'svyaz', name: 'Связь из 90-х', items: ['r_pager', 'r_flip', 'r_brick'], bonus: '+1 покупатель каждый день', reward: 30000 },
  { id: 'games', name: 'Игры детства', items: ['r_tamagotchi', 'r_handheld', 'r_retro'], bonus: 'Покупатели готовы платить на 5% больше', reward: 40000 },
  { id: 'analog', name: 'Тёплый аналог', items: ['r_cassette', 'r_polaroid', 'r_vinyl', 'r_calcwatch'], bonus: '+1 раунд торга с каждым покупателем', reward: 50000 },
];

/* ---------- люди ---------- */
const SKINS = ['#FFDCC2', '#F2C4A0', '#E0A47C', '#B87A55', '#8A5A3E'];
const HAIRC = ['#3B2516', '#5A3A22', '#1E1B2E', '#B5712F', '#E8B45A', '#A0522D', '#C0392B'];
const TOPS = ['#2F8CFF', '#FF5A5F', '#2BC46A', '#FFB020', '#8A5CFF', '#20C5B5', '#FF8A1A', '#FF4F9A', '#3D63D8', '#16B98E', '#FFD34D', '#7A5CFF', '#E84A5F', '#00A6A6'];
const DARKS = ['#2B2142', '#26375F', '#1E2A44', '#3A3A44', '#2E3A2E'];
const PANTSC = ['#2C3E73', '#1F4AA8', '#3B2F6E', '#7A4A2A', '#2E6B5E', '#5B3A8C', '#26375F'];
const ACCC = ['#FF6A3D', '#2F8CFF', '#2BC46A', '#FFC93C', '#FF4F9A', '#8A5CFF', '#20C5B5'];
const BRIGHT = ['#FF5A36', '#22C55E', '#3B82F6', '#FFC23A', '#8A5CFF', '#FF4F9A', '#20C5B5'];
// wtp — сколько готовы платить от рыночной цены, hag — склонность торговаться, pat — терпение, card — доля оплаты картой, used — согласны ли на б/у
const TYPES = {
  student: { name: 'Студент', fem: 'Студентка', wtp: [0.82, 1.02], hag: 0.85, pat: 4, card: 0.55, used: 0.7, w: 1.2,
    look: () => ({ hair: pick(['short', 'curly', 'bob', 'long', 'mohawk', 'ponytail']), top: pick(['hoodie', 'hoodie', 'none']), opts: [pick(['backpack', 'backpack', 'headphones', '']), chance(0.3) ? 'beanie' : ''], age: 0 }) },
  office: { name: 'Офисный', fem: 'Офисная', wtp: [0.95, 1.18], hag: 0.35, pat: 3, card: 0.9, used: 0.25, w: 1,
    look: () => ({ hair: pick(['short', 'bob', 'bun']), top: pick(['shirt', 'jacket']), opts: [chance(0.5) ? 'tie' : '', chance(0.35) ? 'glasses' : '', chance(0.3) ? 'bag' : ''], age: 1 }) },
  gamer: { name: 'Геймер', fem: 'Геймерша', wtp: [0.95, 1.22], hag: 0.55, pat: 4, card: 0.7, used: 0.5, w: 0.8,
    look: () => ({ hair: pick(['curly', 'short', 'mohawk', 'long']), top: 'hoodie', opts: ['headphones', chance(0.4) ? 'glasses' : '', chance(0.4) ? 'cap' : ''], age: 0 }) },
  granny: { name: 'Пенсионерка', wtp: [0.88, 1.08], hag: 0.6, pat: 6, card: 0.25, used: 0.5, w: 0.8, slow: true,
    look: () => ({ body: 'f', hair: pick(['gray', 'bun']), top: pick(['jacket', 'none']), skirt: true, opts: ['glasses', chance(0.6) ? 'scarf' : '', 'bag'], hairC: pick(['#EDEAF5', '#D9D4E6', '#F3ECFF']), age: 2 }) },
  grandpa: { name: 'Пенсионер', wtp: [0.85, 1.05], hag: 0.75, pat: 5, card: 0.2, used: 0.6, w: 0.6, slow: true,
    look: () => ({ body: 'm', hair: 'gray', top: 'jacket', opts: [pick(['mustache', 'beard']), chance(0.5) ? 'cap' : 'glasses'], hairC: pick(['#EDEAF5', '#D9D4E6']), age: 2 }) },
  blogger: { name: 'Блогер', fem: 'Блогерша', wtp: [1.0, 1.3], hag: 0.3, pat: 3, card: 0.95, used: 0.15, w: 0.6,
    look: () => ({ hair: pick(['long', 'bob', 'ponytail', 'mohawk']), top: pick(['jacket', 'none']), opts: ['sunglasses', chance(0.5) ? 'earrings' : '', chance(0.4) ? 'cap' : ''], age: 0, bright: true }) },
  tourist: { name: 'Турист', fem: 'Туристка', wtp: [1.1, 1.42], hag: 0.12, pat: 3, card: 0.85, used: 0.2, w: 0.45,
    look: () => ({ hair: pick(['short', 'long', 'curly', 'ponytail']), top: 'none', shorts: chance(0.5), opts: ['backpack', 'cap', chance(0.5) ? 'sunglasses' : ''], age: 1, bright: true }) },
  reseller: { name: 'Перекупщик', fem: 'Перекупщица', wtp: [0.7, 0.9], hag: 1, pat: 5, card: 0.15, used: 1, w: 0.5,
    look: () => ({ body: 'm', hair: 'short', top: 'jacket', opts: ['cap', chance(0.6) ? 'bag' : '', chance(0.4) ? 'sunglasses' : ''], age: 1, dark: true }) },
  fraud: { name: 'Подозрительный', wtp: [0.95, 1.15], hag: 0.25, pat: 3, card: 0, used: 0.4, w: 0,
    look: () => ({ body: 'm', hair: 'short', top: 'jacket', opts: ['sunglasses', 'cap', chance(0.5) ? 'mustache' : ''], age: 1, dark: true }) },
  thief: { name: 'Тип в капюшоне', w: 0,
    look: () => ({ body: 'm', hair: 'short', top: 'hoodie', opts: ['hood_up', 'mask', 'sunglasses'], age: 0, dark: true }) },
  courier: { name: 'Курьер', wtp: [0.88, 1.08], hag: 0.35, pat: 2, card: 0.8, used: 0.4, w: 0.7,
    look: () => { const f = chance(0.35); return { body: f ? 'f' : 'm', hair: f ? pick(['ponytail', 'braids']) : pick(['buzz', 'short']), top: 'uniform', topC: pick(['#FFC23A', '#22C55E', '#FF7A1A']), opts: [chance(0.6) ? 'cap' : '', 'backpack'], age: 0 }; } },
  schoolkid: { name: 'Школьник', fem: 'Школьница', wtp: [0.7, 0.95], hag: 0.7, pat: 4, card: 0.3, used: 0.6, w: 0.7, kid: true,
    look: () => { const f = chance(0.45); return { body: f ? 'f' : 'm', hair: f ? pick(['pigtails', 'braids', 'bob']) : pick(['spiky', 'short', 'buzz']), top: pick(['hoodie', 'none', 'sweater']), opts: ['backpack', chance(0.3) ? 'cap' : ''], age: 0, kid: true }; } },
  athlete: { name: 'Спортсмен', fem: 'Спортсменка', wtp: [0.95, 1.2], hag: 0.4, pat: 3, card: 0.85, used: 0.3, w: 0.6,
    look: () => { const f = chance(0.45); return { body: f ? 'f' : 'm', hair: f ? pick(['ponytail', 'braids']) : pick(['buzz', 'short', 'bald']), top: 'tracksuit', topC: pick(['#3B82F6', '#2B2142', '#FF5A36', '#22C55E']), opts: [chance(0.6) ? 'headband' : ''], age: 1 }; } },
  builder: { name: 'Строитель', wtp: [0.85, 1.05], hag: 0.7, pat: 4, card: 0.4, used: 0.7, w: 0.5,
    look: () => ({ body: 'm', hair: pick(['buzz', 'short', 'bald']), top: pick(['polo', 'none']), topC: pick(['#3B5BDB', '#5A6E8A', '#FF7A1A']), opts: ['vest', chance(0.6) ? 'hardhat' : '', pick(['mustache', ''])], age: 1 }) },
  hipster: { name: 'Хипстер', fem: 'Хипстерша', wtp: [1.0, 1.25], hag: 0.5, pat: 4, card: 0.9, used: 0.6, w: 0.5,
    look: () => { const f = chance(0.45); return { body: f ? 'f' : 'm', hair: f ? pick(['side', 'bob', 'bun']) : pick(['bun', 'side', 'short']), top: pick(['sweater', 'coat', 'shirt']), opts: [f ? (chance(0.5) ? 'beret' : '') : pick(['beard', 'goatee', 'beard']), 'glasses', !f && chance(0.3) ? 'beanie' : ''], hairC: pick(['#3B2516', '#8A4A2A', '#E8C07A', '#2A2A35']), age: 1 }; } },
  bizlady: { name: 'Бизнес-леди', wtp: [1.05, 1.35], hag: 0.25, pat: 2, card: 1, used: 0.1, w: 0.5,
    look: () => ({ body: 'f', hair: pick(['bun', 'bob', 'side', 'long']), top: 'coat', topC: pick(['#2B2142', '#8A5A3A', '#C9A27A', '#5A2A4A']), opts: ['earrings', chance(0.5) ? 'glasses' : 'sunglasses', chance(0.4) ? 'bag' : ''], age: 1 }) },
  taxi: { name: 'Таксист', fem: 'Таксистка', wtp: [0.85, 1.05], hag: 0.8, pat: 4, card: 0.5, used: 0.6, w: 0.5,
    look: () => ({ body: 'm', hair: pick(['bald', 'short', 'buzz']), top: pick(['polo', 'jacket']), opts: [pick(['mustache', 'beard', 'mustache']), chance(0.5) ? 'cap' : '', chance(0.3) ? 'sunglasses' : ''], age: 2 }) },
  rapper: { name: 'Рэпер', fem: 'Рэперша', wtp: [1.0, 1.3], hag: 0.45, pat: 3, card: 0.85, used: 0.3, w: 0.4,
    look: () => { const f = chance(0.3); return { body: f ? 'f' : 'm', hair: f ? pick(['braids', 'afro']) : pick(['afro', 'buzz', 'braids']), top: pick(['hoodie', 'tracksuit']), topC: pick(BRIGHT), opts: ['chain', chance(0.5) ? 'bucket' : '', chance(0.6) ? 'sunglasses' : ''], age: 0, bright: true }; } },
  mom: { name: 'Молодая мама', wtp: [0.9, 1.15], hag: 0.55, pat: 3, card: 0.7, used: 0.45, w: 0.6,
    look: () => ({ body: 'f', hair: pick(['ponytail', 'bob', 'braids', 'long']), top: pick(['sweater', 'coat', 'none', 'dress']), opts: ['bag', chance(0.5) ? 'earrings' : ''], age: 1 }) },
};
// персонажи сюжета
const CHARS = {
  misha: { name: 'Дядя Миша', role: 'Наставник', look: { body: 'm', hair: 'gray', hairC: '#E9E5F2', skin: '#F2C4A0', top: 'shirt', topC: '#2E9E6B', pants: '#3B2F6E', opts: ['glasses', 'mustache', 'apron'], apronC: '#FF8A1A', age: 2 } },
  zoya: { name: 'Зоя Павловна', role: 'Хозяйка рынка', look: { body: 'f', hair: 'bun', hairC: '#B5712F', skin: '#FFDCC2', top: 'jacket', topC: '#8A5CFF', pants: '#3B2F6E', skirt: true, opts: ['glasses', 'earrings', 'scarf'], accC: '#FF4F9A', age: 2 } },
  artur: { name: 'Артур', role: 'Сосед-конкурент', look: { body: 'm', hair: 'mohawk', hairC: '#1E1B2E', skin: '#E0A47C', top: 'jacket', topC: '#1E2A44', pants: '#1E2A44', opts: ['sunglasses', 'earrings'], accC: '#FFC93C', age: 1 } },
  liza: { name: 'Лиза', role: 'Студентка, постоянная покупательница', look: { body: 'f', hair: 'bob', hairC: '#C0392B', skin: '#FFDCC2', top: 'hoodie', topC: '#FF6FB1', pants: '#1F4AA8', opts: ['headphones', 'backpack'], accC: '#20C5B5', age: 0 } },
  gosha: { name: 'Гоша', role: 'Коллекционер', look: { body: 'm', hair: 'short', hairC: '#5A3A22', skin: '#F2C4A0', top: 'jacket', topC: '#C98A55', pants: '#2E6B5E', opts: ['beanie', 'beard', 'scarf', 'glasses'], accC: '#FFC93C', hatC: '#2BC46A', age: 1 } },
  valera: { name: 'Валера', role: 'Охранник рынка', look: { body: 'm', hair: 'short', hairC: '#1E1B2E', skin: '#B87A55', top: 'none', topC: '#26375F', pants: '#1E2A44', opts: ['cap', 'vest', 'badge'], hatC: '#26375F', vestC: '#1E2A44', age: 1 } },
  kim: { name: 'Ким', role: 'Оптовик', look: { body: 'm', hair: 'short', hairC: '#1E1B2E', skin: '#FFDCC2', top: 'shirt', topC: '#FFFFFF', pants: '#26375F', opts: ['glasses', 'tie'], accC: '#FF5A36', age: 1 } },
  somov: { name: 'Лейтенант Сомов', role: 'Участковый', look: { body: 'm', hair: 'short', hairC: '#3B2516', skin: '#F2C4A0', top: 'jacket', topC: '#26375F', pants: '#26375F', opts: ['cap', 'badge', 'mustache'], hatC: '#26375F', age: 1 } },
  ashot: { name: 'Ашот', role: 'Запчасти, конец ряда', look: { body: 'm', hair: 'curly', hairC: '#1E1B2E', skin: '#D9A07A', top: 'shirt', topC: '#20C5B5', pants: '#26375F', opts: ['beard'], age: 1 } },
};

/* ---------- реплики ---------- */
const L = {
  hello: ['Здравствуйте!', 'Добрый день!', 'Привет!', 'Здрасьте.', 'Доброго!', 'Приветствую.', 'Ой, здравствуйте!', 'Хай!'],
  browse: ['Я просто посмотрю…', 'Хочу себе что-нибудь интересное. Что посоветуете?', 'Подарок ищу, а что — сам не знаю.', 'Есть что-нибудь новенькое?', 'Удивите меня!'],
  hint: {
    student: ['Учусь, много сижу в телефоне.', 'Хочется чего-то полезного на каждый день.'], office: ['На работе вечно что-то разряжается.', 'Много звонков, встреч и таблиц.'],
    gamer: ['Я в игры по ночам рублюсь.', 'Хочу апгрейд для игр.'], granny: ['Внукам звонить хочу, видеть их.', 'Дома скучно, хочется новое что-нибудь.'],
    grandpa: ['Внуки далеко, а я тут.', 'Чтоб новости смотреть.'], blogger: ['Снимаю контент, путешествую.', 'Нужно что-то для съёмок.'],
    tourist: ['Я в отпуске, всё снимаю.', 'Сувенир бы, но полезный.'], courier: ['Весь день в разъездах, телефон — моё всё.'], schoolkid: ['В классе у всех что-то крутое, а у меня нет.'],
    athlete: ['Бегаю, плаваю, считаю пульс.'], builder: ['Работаю на объекте, там пыль и грязь.'], hipster: ['Люблю всё необычное и винтажное.'],
    bizlady: ['Встречи, презентации, перелёты.'], taxi: ['Сутками в машине.'], rapper: ['Пишу биты по ночам.'], mom: ['Ребёнок мультики смотрит, а я на связи.'],
  },
  shownOk: ['О, то что надо!', 'Давайте посмотрим… Неплохо.', 'Ага, вот это похоже.', 'Ммм, красивый.', 'Да-да, такое и искал(а).'],
  shownWrong: ['Не, мне не это.', 'Это не то, я другое просил(а).', 'Хм, мимо.', 'Нет-нет, другое.'],
  shownUsedNo: ['А новый есть? Б/у не хочу.', 'Ой, он не новый? Не, спасибо.', 'Мне бы новенький.'],
  browseHit: ['О! А вот это интересно!', 'Хм, а это идея!', 'Ого, давайте посмотрим!'],
  browseMiss: ['Не, это не моё.', 'Хм, не-а.', 'Скучновато.', 'Не, такое уже есть.'],
  noStock: ['Жаль. Пойду дальше поищу.', 'Эх, ладно. В другой раз.', 'Тогда в соседний павильон загляну.', 'Ну вот… А мне говорили, у вас всё есть.'],
  askPrice: ['Сколько?', 'И почём?', 'Что по цене?', 'Сколько хотите?', 'Цена какая?'],
  acceptHappy: ['Беру! Отличная цена!', 'О, дёшево! Заверните!', 'По рукам!', 'Даже торговаться не буду. Беру!', 'Супер, договорились!'],
  acceptOk: ['Ну… ладно, беру.', 'Хорошо, договорились.', 'Ладно, уговорили.', 'Ок, пойдёт.', 'Годится.'],
  counter: ['Дороговато. Давайте подешевле?', 'Не-не, давайте дешевле.', 'Скиньте немного — и по рукам.', 'Много. Уступите чуть-чуть?'],
  counterUp: ['Ладно, накину. Это последнее слово.', 'Ну хорошо, моя цена последняя.', 'Добавлю, но больше не могу.'],
  counterTail: ['Давайте подешевле?', 'Давайте за меньшие.', 'Скиньте немного — и по рукам.', 'Уступите чуть-чуть?'],
  askDisc: ['А скидочку можно?', 'Скинете немного?', 'Заберу прямо сейчас, если подешевле.', 'Уступите — и по рукам?'],
  tooPricey: ['Ого, дорого!', 'Не, за такие деньги ещё подумаю.', 'Многовато.', 'Это грабёж!'],
  offended: ['Сколько?! Вы серьёзно?', 'Ого. Это грабёж!', 'Вы меня с олигархом перепутали.', 'Ну и цены у вас…'],
  leaveAngry: ['Всё, ухожу. До свидания!', 'Нет уж, спасибо. Пойду к соседям.', 'Да ну вас! Ещё и отзыв напишу.', 'Пф. Поищу в интернете.'],
  thanks: ['Спасибо! Приду ещё!', 'Спасибо большое!', 'Класс, спасибо!', 'Всего доброго!', 'Обязательно расскажу друзьям!', 'Пока-пока!'],
  thanksMeh: ['Ну, спасибо.', 'До свидания.', 'Угу.'],
  crossYes: ['А давайте! Пригодится.', 'Ой, точно, его тоже!', 'Уговорили, кидайте в пакет.'],
  crossNo: ['Не, хватит на сегодня.', 'Спасибо, это лишнее.', 'Нет, у меня уже есть.'],
  cardNoTerminal: ['Как карту не принимаете?! Ну ладно, сбегаю к банкомату…', 'Только наличные? Эх… Ладно, вот.'],
  cardNoTerminalLeave: ['Без карты? Нет уж, пойду туда, где принимают.'],
  fakeCaught: ['Ой… Это не моя… Вот, возьмите другую.', 'Как фальшивая?! Мне сдачу такой дали!'],
  fakeRun: ['Ой, мне пора!', 'Э-э… я передумал!'],
  realRefused: ['Да нормальная же купюра! Всё, обиделся.', 'Вы меня в чём-то подозреваете?! Ухожу.'],
  sell: {
    granny: ['Сынок, внук сказал выкинуть, а мне жалко. Может, возьмёте?', 'Нашла в серванте. Сколько дадите?'],
    grandpa: ['Вот, лежал на даче. Почём возьмёшь?', 'Слушай, мне без надобности. Купишь?'],
    student: ['Возьмёте? Деньги срочно нужны.', 'Продаю, почти новый, честно!'],
    office: ['Обновился, хочу сдать старый.', 'Купите? Работает отлично.'],
    reseller: ['Есть свежак. Почём возьмёшь?', 'Брат, нужен? Отдам недорого. Документов нет, но он чистый.', 'Слышь, возьмёшь? Как новый.'],
    gamer: ['Продаю, перешёл на новый.', 'Возьмёте мой? Бережно пользовался.'],
  },
  sellClaim: { new: 'Почти новый, честно!', A: 'Как новый, ни царапинки.', B: 'Ну, пользованный немного.', C: 'Он… немного не работает.' },
  sellAccept: ['Договорились!', 'Ладно, по рукам.', 'Эх, забирайте.', 'Хорошо, давайте.'],
  sellCounter: ['Мало! Добавьте немного.', 'Маловато. Давайте ещё чуть-чуть.', 'Ну хотя бы немного побольше!'],
  sellInsult: ['Сколько?! Да он втрое дороже!', 'Это вы смеётесь так?', 'Ну вы и жук!'],
  sellLeave: ['Нет, так не пойдёт. Найду, кто купит.', 'Ладно, на сайт выложу.'],
  repairAccept: ['Договорились! Когда забрать?', 'Хорошо, оставляю.', 'Ладно, только аккуратно.'],
  repairTooMuch: ['Дорого. Новый дешевле купить!', 'Не, за такие деньги — нет.'],
  repairTail: ['Что-то не так, сам(а) не разберусь.', 'Очень надо, выручайте!', 'Спасёте?'],
  pickupOk: ['Ура, работает! Спасибо, мастер!', 'Как новенький! Вот деньги.', 'Вы волшебник!'],
  pickupLate: ['Как не готово?! Вы же обещали!', 'Ну вот… Завтра зайду, но это последний раз.'],
  returnStart: ['Я у вас это покупал(а).', 'Вот, брал(а) у вас.', 'Купил(а) у вас, и вот.'],
  returnProblems: ['Сломался через день!', 'Не включается!', 'Греется как утюг!', 'Не заряжается!', 'Глючит!'],
  returnEnd: ['Верните деньги!', 'Что делать будем?', 'Разберитесь, пожалуйста.'],
  returnOk: ['Спасибо, что по-честному.', 'Вот это сервис! Уважаю.'],
  returnRefused: ['Ну и ладно! Всем расскажу, какие вы!', 'Безобразие! Отзыв будет соответствующий.'],
};
const NEED = { m: 'нужен', f: 'нужна', p: 'нужны', n: 'нужно' };
const POSS = { m: 'мой', f: 'мою', p: 'мои', n: 'моё' };
function REQ(p) { const n = p.name[0].toLowerCase() + p.name.slice(1); return [`Есть ${n}?`, `Мне ${NEED[p.g] || 'нужен'} ${n}.`, `Ищу ${p.acc}.`]; }
function REPQ(p) { return [`Почините ${POSS[p.g] || 'мой'} ${p.acc}?`, `Посмотрите ${POSS[p.g] || 'мой'} ${p.acc}?`]; }
const TAILS = {
  student: ['Только чтоб недорого.', 'Стипендия вчера пришла.', 'Старый умер окончательно.'], office: ['Быстро, у меня обед.', 'Если всё работает — возьму.', 'Нужно для работы.'],
  gamer: ['Что-то нормальное, не игрушку.', 'Турнир в субботу!', 'Только без «дешёвых аналогов».'], granny: ['Для внучки.', 'Только простой, деточка.', 'Сосед сказал, у вас хорошие.'],
  grandpa: ['Чтоб надёжный, как трактор.', 'Только без этих ваших подписок.', 'Для внука.'], blogger: ['Срочно, для съёмок!', 'Сниму вас в сторис, если что.', 'Контент сам себя не снимет!'],
  tourist: ['Я тут проездом.', 'Пожалуйста, побыстрее.', 'О, какой рынок!'], reseller: ['Почём отдашь? Только честно.', 'Оптом можно и дешевле, да?', 'Не дороже, чем у всех.'],
  fraud: ['Быстренько, я наличкой.', 'Беру сразу, не торгуясь.', 'Плачу кэшем.'], courier: ['У меня заказ горит.', 'Телефон садится посреди смены!', 'Только живо, я на скутере.'],
  schoolkid: ['Я на карманные…', 'Мама разрешила!', 'Как у всех в классе!'], athlete: ['Для тренировок.', 'Чтобы бегать без проводов.', 'Марафон через неделю.'],
  builder: ['Чтоб с лесов уронить — и ничего.', 'Покрепче, на стройке всё бьётся.', 'Только без понтов.'], hipster: ['Желательно с характером.', 'Массмаркет не предлагать.', 'Хочу что-то с душой.'],
  bizlady: ['Лучшее, что есть. У меня пять минут.', 'Для переговоров.', 'Счёт на компанию выставите?'], taxi: ['В машине всё сдохло.', 'Весь день за рулём.', 'Клиенты ждут, навигатор садится.'],
  rapper: ['Чтоб качало!', 'Для студии, звук решает.', 'Надо, чтоб было стильно.'], mom: ['Ребёнок всё время просит.', 'Только чтоб не сломал за день.', 'Муж сказал — тут честно.'],
};
// кому что интересно у новых типов
{ const TAGADD = { courier: ['powerbank', 'charger', 'case', 'band'], schoolkid: ['case', 'buds', 'charger', 'mouse', 'console'], athlete: ['band', 'buds', 'watch', 'actioncam'], builder: ['powerbank', 'phone', 'speaker', 'charger'], hipster: ['actioncam', 'speaker', 'vr', 'tablet'], bizlady: ['laptop', 'tablet', 'watch', 'phone'], taxi: ['charger', 'phone', 'powerbank', 'case'], rapper: ['speaker', 'buds', 'vr', 'phone'], mom: ['tablet', 'buds', 'band', 'watch', 'case'] };
  Object.entries(TAGADD).forEach(([t, ids]) => ids.forEach((id) => { if (!PM[id].tags.includes(t)) PM[id].tags.push(t); })); }

/* ---------- торг 2.0: характеры и тактики ---------- */
const TRAITS = {
  eco: { name: 'Экономный', hint: 'любит подарки и выгоду' }, impulse: { name: 'Импульсивный', hint: 'ведётся на ажиотаж и похвалу' },
  expert: { name: 'Знаток', hint: 'ценит факты, впаривание злит' }, doubt: { name: 'Сомневается', hint: 'нужна гарантия и уверенность' },
  rush: { name: 'Спешит', hint: 'долгие разговоры раздражают' }, chat: { name: 'Болтун', hint: 'любит шутки и разговоры' },
};
const TYPE_TRAITS = { student: ['eco', 'impulse', 'chat'], office: ['rush', 'expert', 'doubt'], gamer: ['expert', 'impulse', 'chat'], granny: ['doubt', 'chat', 'eco'], grandpa: ['eco', 'doubt', 'chat'], blogger: ['impulse', 'chat', 'rush'], tourist: ['impulse', 'rush', 'chat'], reseller: ['eco', 'expert'], fraud: ['rush', 'chat'],
  courier: ['rush', 'eco'], schoolkid: ['impulse', 'eco', 'chat'], athlete: ['expert', 'rush'], builder: ['eco', 'doubt'], hipster: ['expert', 'chat'], bizlady: ['rush', 'expert'], taxi: ['chat', 'eco'], rapper: ['impulse', 'chat'], mom: ['doubt', 'eco', 'chat'] };
const TACTICS = [
  { id: 'praise', name: 'Расхвалить', d: 'эмоции', lv: 1, base: 8, fx: { impulse: 20, chat: 14, eco: 4, doubt: 6, rush: 3, expert: -11 },
    say: ['Это просто бомба, все берут!', 'Лучший выбор, честно — сам бы взял!', 'Посмотрите, какой красавец!', 'Вещь — огонь, не пожалеете!'] },
  { id: 'specs', name: 'Факты', d: 'цифры, проверка', lv: 1, base: 6, fx: { expert: 24, doubt: 12, eco: 7, impulse: -4, rush: -9, chat: 2 },
    say: ['Смотрите: проверен по всем пунктам, всё работает идеально.', 'Батарея держит день, экран без засветов.', 'Память с запасом, корпус без царапин — вот, сами гляньте.'] },
  { id: 'hurry', name: 'Последний!', d: 'ажиотаж', lv: 2, base: 4, fx: { impulse: 22, rush: 15, eco: 3, chat: 4, expert: -16, doubt: -12 },
    say: ['Последний остался, вчера три таких ушло!', 'Завтра уже подорожает — поставщик поднял цены.', 'Его уже спрашивали утром, долго не пролежит.'] },
  { id: 'joke', name: 'Пошутить', d: 'разрядить', lv: 2, base: 6, rnd: 8, fx: { chat: 22, impulse: 10, eco: 6, doubt: 6, expert: -2, rush: -12 },
    say: ['Он такой надёжный — переживёт и меня, и мой кредит!', 'Берите, пока я добрый. Я редко добрый!', 'Батарея держит дольше, чем мои обещания жене!'] },
  { id: 'warranty', name: 'Гарантия', d: '30 дней · −3%', lv: 3, base: 8, cost: 0.03, fx: { doubt: 26, expert: 10, eco: 9, impulse: 4, rush: 6, chat: 6 },
    say: ['Даю месяц гарантии от лавки — если что, обменяю.', 'Гарантия тридцать дней, чек сохраню.'] },
  { id: 'gift', name: 'Подарок', d: 'кабель · −300 ₽', lv: 3, base: 12, gift: 300, fx: { eco: 28, chat: 14, impulse: 14, doubt: 12, rush: 10, expert: 8 },
    say: ['А кабель дарю в придачу!', 'Сверху — кабель в подарок, от души.'] },
];
const L2 = {
  tacGreat: ['О, вот это мне нравится!', 'Убедили, честно!', 'Да вы мастер продаж!', 'Звучит отлично!', 'Вот это разговор!'],
  tacOk: ['Хм, ну ладно…', 'Интересно, продолжайте.', 'Ну допустим.', 'Ага, понятно.'],
  tacBad: ['Не надо мне впаривать.', 'Это всё слова…', 'Меня таким не возьмёшь.', 'Давайте без этого.', 'Я не первый день на рынке.'],
  tagWin: ['Ладно, уговорили — беру по ценнику!', 'Всё, беру! По ценнику.', 'Эх, была не была — беру!', 'Убедили. Заворачивайте!'],
};

/* ---------- поставщики, улучшения, реклама ---------- */
const SUP_K = { kim: 1, grey: 0.74 };
const UPGRADES = [
  { id: 'terminal', name: 'Терминал для карт', price: 15000, lv: 1, desc: 'Можно платить картой. Без него каждый третий «картёжник» уходит.' },
  { id: 'uv', name: 'УФ-детектор купюр', price: 12000, lv: 2, desc: 'Сразу подсвечивает фальшивку при проверке.' },
  { id: 'camera', name: 'Камера над прилавком', price: 28000, lv: 3, desc: 'Воры приходят реже, а на поимку больше времени.' },
  { id: 'toolkit', name: 'Набор мастера', price: 26000, lv: 3, desc: 'Тестер сразу показывает, что сломано.' },
  { id: 'scanner', name: 'Проверка IMEI', price: 20000, lv: 3, desc: 'Проверка на кражу без потери терпения продавца.' },
  { id: 'led', name: 'LED-подсветка', price: 38000, lv: 4, desc: 'Товар сияет — покупатели готовы платить на 4% больше.' },
  { id: 'coffee', name: 'Кофемашина', price: 32000, lv: 5, desc: 'Кофе за счёт заведения: +1 раунд терпения у всех.' },
  { id: 'guard', name: 'Охранник Валера', price: 45000, lv: 5, desc: 'Ловит каждого второго вора сам.' },
  { id: 'neon', name: 'Неоновая вывеска', price: 90000, lv: 6, desc: '+2 покупателя каждый день. Видно с другого конца рынка.' },
];
const ADS = [
  { id: 'flyers', name: 'Листовки у входа', price: 3000, add: 2, desc: '+2 покупателя завтра.' },
  { id: 'radio', name: 'Радио рынка', price: 6500, add: 3, desc: '+3 покупателя, чаще пенсионеры. Объявят на весь рынок!', mix: { granny: 2, grandpa: 1.5 } },
  { id: 'target', name: 'Таргет в соцсетях', price: 11000, add: 4, desc: '+4 покупателя, чаще студенты и геймеры.', mix: { student: 1.6, gamer: 1.8 }, lv: 2 },
];

/* ---------- сюжет: Акт I «Прилавок» ---------- */
const CHAPTERS = [
  { id: 1, title: 'Наследство', sub: 'Дядя Миша уходит на пенсию и оставляет тебе свой павильон.', who: 'misha',
    goals: [{ k: 'sold', n: 6, t: 'Продай 6 товаров' }, { k: 'profit', n: 15000, t: 'Заработай 15 000 ₽ прибыли', money: true }, { k: 'happy', n: 4, t: 'Порадуй 4 покупателей' }], reward: 15000 },
  { id: 2, title: 'Золотые руки', sub: 'Миша учит главному: купить дёшево сломанное, починить и продать.', who: 'misha',
    goals: [{ k: 'buyins', n: 1, t: 'Купи устройство у покупателя' }, { k: 'repairs', n: 2, t: 'Почини 2 устройства' }, { k: 'refurbSold', n: 1, t: 'Продай восстановленное' }], reward: 25000 },
  { id: 3, title: 'Сосед Артур', sub: 'Напротив открылся Артур и демпингует. Покажи, кто тут главный.', who: 'artur',
    goals: [{ k: 'repAbs', n: 60, t: 'Репутация 3★' }, { k: 'caught', n: 2, t: 'Поймай 2 воров' }, { k: 'profit', n: 120000, t: 'Прибыль 120 000 ₽ за главу', money: true }], reward: 40000 },
  { id: 4, title: 'Охота за стариной', sub: 'Коллекционер Гоша ищет вещи из прошлого и платит щедро.', who: 'gosha',
    goals: [{ k: 'raresFound', n: 3, t: 'Найди 3 редкости' }, { k: 'colsDone', n: 1, t: 'Собери коллекцию' }, { k: 'jobs', n: 3, t: 'Выполни 3 заказа на ремонт' }], reward: 60000 },
  { id: 5, title: 'Павильон года', sub: 'Зоя Павловна объявила конкурс на лучший павильон рынка.', who: 'zoya',
    goals: [{ k: 'repAbs', n: 90, t: 'Репутация 5★' }, { k: 'worthAbs', n: 1000000, t: 'Капитал 1 000 000 ₽', money: true }, { k: 'neon', n: 1, t: 'Повесь неоновую вывеску' }], reward: 150000 },
];
// сцены: [кто, текст] или {choice:[...]}
const SCENES = {
  intro: [
    ['misha', 'О, явился! Ну здравствуй, наследник. Сорок лет я за этим прилавком простоял — теперь твоя очередь.'],
    ['misha', 'Правило первое: покупатель всегда торгуется. Назовёшь дорого — уйдёт. Дёшево — сам без штанов останешься.'],
    ['misha', 'Смотри на лицо. Улыбается — можно чуть поднажать. Хмурится — сбавь, пока не поздно.'],
    ['misha', 'Полки я тебе оставил с чехлами и зарядками, а на витрине — пара телефонов. Открывайся, я рядом буду, у себя.'],
  ],
  ch1done: [
    ['misha', 'А ты ничего! Руки на месте, язык подвешен. Пора научить тебя настоящему ремеслу.'],
    ['misha', 'Люди приносят сломанное — за копейки. Чинишь — продаёшь втрое дороже. Вот это и есть маржа, дружок.'],
    ['misha', 'Только проверяй, что берёшь! Экран, батарею, разъём. И главное — не краденое ли. Мне тут участковый не нужен.'],
  ],
  ch2start: [
    ['misha', 'Вечером, как закроешься, загляни в «Мастерскую». Открутил винты, снял крышку, поменял деталь. Ничего сложного.'],
    ['misha', 'Запчасти бери у Ашота — он в конце ряда. А устройства тебе сами понесут, вот увидишь.'],
  ],
  ch2done: [
    ['misha', 'Ну всё, мастер! Я спокоен. Еду на дачу — помидоры сами себя не подвяжут.'],
    ['zoya', 'Так-так. Значит, вы теперь хозяин павильона Михаила? Аренда — каждое воскресенье. Не опаздывайте, я не люблю.'],
    ['artur', 'Привет, сосед! Я Артур, напротив теперь торгую. Цены у меня, сразу скажу, пониже. Без обид, это рынок!'],
  ],
  ch3done: [
    ['artur', 'Ладно, признаю — ты красавчик. Люди к тебе ходят, ко мне — только погреться.'],
    ['artur', 'Я тут подумал… может, будем дружить? Буду к тебе клиентов на ремонт отправлять.'],
    ['gosha', 'Добрый день. Меня зовут Гоша, я собираю вещи из прошлого. Говорят, к вам несут всякое старьё?'],
    ['gosha', 'Пейджеры, кассетники, раскладушки… Если найдёте — я заплачу. А соберёте коллекцию сами — будет чем гордиться.'],
  ],
  ch4done: [
    ['gosha', 'Невероятно! Целая коллекция! Вы настоящий археолог электроники.'],
    ['zoya', 'Внимание! Объявляю конкурс «Павильон года». Победителю — моя личная благодарность и скидка на аренду. Навсегда.'],
  ],
  ch5done: [
    ['zoya', 'Ну что ж… Павильон года — ваш! Скидка на аренду, как обещала. Михаил бы гордился.'],
    ['misha', 'Я и горжусь! С дачи приехал посмотреть. Красота какая! Неон, очередь… Ну ты даёшь!'],
    ['misha', 'Только не расслабляйся. Ким звонил — говорит, ты дорос до настоящего опта. А опт, наследник, — это другая игра.'],
  ],
  rent: [['zoya', 'Добрый вечер! Воскресенье — день аренды. С вас {rent}.']],
  rentDebt: [['zoya', 'Денег нет? Безобразие! Запишу в долг, но с процентами. Завтра чтоб торговали как следует!']],
  police: [['somov', 'Добрый день. Лейтенант Сомов. У вас тут {item} числится в краже. Изымаю. И штраф {fine} — за скупку без проверки.']],
  policeOk: [['somov', 'Добрый день, плановая проверка. Документы в порядке, краденого нет. Хорошего дня!']],
  arturDeal: [
    ['artur', 'Слушай, сосед. Давай договоримся: оба поднимем цены на 10%. Людям деваться некуда — заработаем оба.'],
    { choice: [{ t: 'Договорились', fx: 'cartel' }, { t: 'Нет, я честно торгую', fx: 'honest' }] },
  ],
  arturCartel: [['artur', 'Вот это я понимаю! Партнёр!'], ['zoya', '(шёпотом соседке) Слыхала? Цены задрали, жулики…']],
  arturHonest: [['artur', 'Ну как знаешь. Тогда я снижаю свои!']],
  lizaFirst: [['liza', 'Привет! Я Лиза, учусь тут рядом. Говорят, у вас честные цены? Буду к вам ходить, если не обманете!']],
  lizaLaptop: [['liza', 'Помните меня? Я коплю на ноутбук для диплома. Если будет недорогой восстановленный — отложите для меня, ладно?']],
  valera: [['valera', 'Здравия желаю! Валера. Теперь за вашим павильоном присматриваю. Воры — мимо!']],
  kimHello: [
    ['kim', 'Здравствуйте. Ким, оптовые поставки. Новые товары, честные цены, без брака.'],
    ['kim', 'Заходите, когда нужен товар. А если запомните номер — можно и позвонить, привезу сам. За доставку возьму немного сверху.'],
  ],
  ashotHello: [['ashot', 'Э, друг, заходи! Экраны, батареи, разъёмы — у Ашота всё есть. Для ремонта — лучшее место на рынке!']],
  goshaHello: [['gosha', 'Принесёте мне вещь из прошлого — заплачу щедро. А соберёте целую коллекцию — тут уж я вам завидовать буду.']],
  end1: [
    ['misha', 'Ну что, наследник, первый год за прилавком позади. Дальше — опт, аукционы Палыча и большие деньги.'],
    ['misha', 'Только помни: рынок — это люди. А люди тебя тут уже знают.'],
  ],
};
// побочные истории между днями
const SIDE = [
  { id: 'lostPhone', c: (s) => s.day >= 3, lines: [['zoya', 'Тут бабушка у вашего прилавка телефон забыла, старенький. Что делать будем?'], { choice: [{ t: 'Найти хозяйку и вернуть', fx: 'repUp' }, { t: 'Оставить себе', fx: 'keepPhone' }] }] },
  { id: 'kidThief', c: (s) => s.day >= 4, lines: [['valera', 'Поймал мальчишку — чехол ваш в рукав сунул. Лет двенадцать. Сомова звать?'], { choice: [{ t: 'Отпустить с нравоучением', fx: 'repUp' }, { t: 'Позвать Сомова', fx: 'kidPolice' }] }] },
  { id: 'arturParty', c: (s) => s.chapter >= 4 && !s.flags.artur, lines: [['artur', 'Сосед, у меня в субботу день рождения! Приходи, посидим по-людски.'], { choice: [{ t: 'Прийти с подарком (−4 000 ₽)', fx: 'arturGift' }, { t: 'Вежливо отказаться', fx: '' }] }] },
  { id: 'goshaTip', c: (s) => s.chapter >= 4, lines: [['gosha', 'По секрету: завтра бабушки понесут вещи «той самой» эпохи. Редкости будут попадаться чаще.'], { choice: [{ t: 'Спасибо, Гоша!', fx: 'rareTip' }] }] },
  { id: 'studentDay', c: (s) => s.day >= 6, lines: [['liza', 'Завтра День студента! Если повесите «студентам скидка», весь наш поток придёт к вам.'], { choice: [{ t: 'Повесить объявление', fx: 'students' }, { t: 'Обойдутся', fx: '' }] }] },
  { id: 'ashotSale', c: (s) => s.chapter >= 2 && s.scenes.ashotHello, lines: [['ashot', 'Друг, распродажа запчастей! Набор — экран, батарея, разъём — за 4 000 ₽.'], { choice: [{ t: 'Беру набор (−4 000 ₽)', fx: 'partsKit' }, { t: 'Не надо', fx: '' }] }] },
];
const STAT_KEYS = ['sold', 'profit', 'revenue', 'happy', 'angry', 'buyins', 'repairs', 'refurbSold', 'caught', 'thefts', 'raresFound', 'colsDone', 'jobs', 'overMarket', 'cross', 'uvChecks', 'fakesCaught', 'browseHit', 'refunds', 'days', 'pitchWin', 'tacticHit', 'customers'];
/* =====================================================================
   ДВИЖОК: люди в 3D, их путь по залу, интерфейс поверх сцены
   ===================================================================== */
const el = (id) => document.getElementById(id);

/* ---------- люди: тот же скелет, что у героя, детали одного сустава — один меш с цветами вершин ---------- */
const PMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, envMapIntensity: 0.45 });
const _col = new THREE.Color();
function tint(g, hex) {
  _col.set(hex).convertSRGBToLinear();
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _col.r; a[i * 3 + 1] = _col.g; a[i * 3 + 2] = _col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
function put(list, geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z); list.push(tint(geo, hex));
}
const gbox = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const gsph = (r, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 12, 9); g.scale(sx, sy, sz); return g; };
const gpart = (r, phiS, phiL, thS, thL, sx = 1, sy = 1, sz = 1) => { const g = new THREE.SphereGeometry(r, 14, 8, phiS, phiL, thS, thL); g.scale(sx, sy, sz); return g; };
const glimb = (r0, r1, len) => { const g = new THREE.CylinderGeometry(r0, r1, len, 10); g.translate(0, -len / 2, 0); return g; };
const gtorus = (r, t) => new THREE.TorusGeometry(r, t, 6, 16);
function finish(group, list) {
  if (!list.length) return;
  const g = THREE.BufferGeometryUtils.mergeBufferGeometries(list, false);
  list.forEach((x) => x.dispose());
  const m = new THREE.Mesh(g, PMAT); group.add(m);
}
const FEM_HAIR = ['bob', 'long', 'ponytail', 'pigtails', 'braids'];
// внешность из описания оригинала → полный набор цветов
function rollLook(type) {
  const T = TYPES[type] || TYPES.office; const lk = T.look();
  return completeLook(lk);
}
function completeLook(lk) {
  lk = Object.assign({}, lk); lk.opts = (lk.opts || []).filter(Boolean);
  if (!lk.body) lk.body = lk.skirt || FEM_HAIR.includes(lk.hair) || (lk.hair === 'bun' && chance(0.7)) ? 'f' : 'm';
  lk.fem = lk.body === 'f';
  lk.skin = lk.skin || pick(SKINS);
  lk.hairC = lk.hairC || (lk.hair === 'gray' ? '#E3E0EA' : pick(HAIRC));
  lk.topC = lk.topC || (lk.dark ? pick(DARKS) : lk.bright ? pick(BRIGHT) : pick(TOPS));
  lk.pants = lk.pants || pick(PANTSC);
  lk.accC = lk.accC || pick(ACCC);
  lk.hatC = lk.hatC || (lk.dark ? '#22232a' : pick(ACCC));
  lk.skirtC = lk.skirtC || pick(['#3B2F6E', '#5A2A4A', '#2B2142', '#7A4A2A']);
  lk.shoe = lk.shoe || (lk.age === 2 ? '#3a2c24' : pick(['#F0F0EE', '#F0F0EE', '#2a2a2e', '#d9d4c7']));
  return lk;
}
function makePerson(lkIn) {
  const lk = completeLook(lkIn);
  const P = { g: new THREE.Group(), J: {}, lk, st: { phase: Math.random() * 6, speed: 0, t: Math.random() * 10, gest: null, gT: 0, headY: 0, headX: 0, lookY: 0, hunch: lk.age === 2 ? 0.12 : 0 }, nav: null, yaw: 0 };
  const J = P.J, fem = lk.fem, top = lk.topC, skin = lk.skin, hairC = lk.hairC;
  const joint = (parent, x, y, z) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  const skirted = lk.skirt || lk.top === 'dress';
  // таз и ноги
  const pelvis = J.pelvis = joint(P.g, 0, 0.953, 0);
  let L = [];
  put(L, gsph(0.165, fem ? 1.1 : 1.05, 0.62, 0.78), skirted ? (lk.top === 'dress' ? top : lk.skirtC) : lk.pants, 0, -0.02, 0);
  if (skirted) { const sk = new THREE.CylinderGeometry(0.17, 0.27, 0.5, 14, 1, true); sk.scale(1.05, 1, 0.85); put(L, sk, lk.top === 'dress' ? top : lk.skirtC, 0, -0.22, 0); }
  if (lk.top === 'coat') { const ck = new THREE.CylinderGeometry(0.185, 0.235, 0.44, 14, 1, true); ck.scale(1.12, 1, 0.82); put(L, ck, top, 0, -0.17, 0); }
  finish(pelvis, L);
  const legC = skirted ? '#4a3f52' : lk.pants, shinC = lk.shorts ? skin : legC;
  for (const [k, sx] of [['L', -1], ['R', 1]]) {
    const hip = J['hip' + k] = joint(pelvis, sx * 0.092, -0.03, 0);
    L = []; put(L, glimb(0.083, 0.064, 0.43), lk.shorts ? lk.pants : legC); finish(hip, L);
    const knee = J['knee' + k] = joint(hip, 0, -0.43, 0);
    L = []; put(L, gsph(0.064), shinC); put(L, glimb(0.062, 0.05, 0.41), shinC); finish(knee, L);
    const ankle = J['ankle' + k] = joint(knee, 0, -0.41, 0);
    L = []; put(L, gbox(0.105, 0.075, 0.26), lk.shoe, 0, -0.035, -0.055); put(L, gbox(0.112, 0.022, 0.27), '#2a2a2a', 0, -0.072, -0.055); finish(ankle, L);
  }
  // корпус
  const spine = J.spine = joint(pelvis, 0, 0.05, 0);
  L = [];
  const torso = new THREE.LatheGeometry([[0, 0], [0.15, 0], [0.163, 0.08], [0.168, 0.2], [fem ? 0.172 : 0.18, 0.33], [fem ? 0.18 : 0.19, 0.41], [0.172, 0.47], [0.11, 0.52], [0.05, 0.535], [0, 0.535]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 16);
  torso.scale(fem ? 1.04 : 1.12, 1, 0.72); put(L, torso, top);
  const ring = (r, t, c, y) => put(L, gtorus(r, t), c, 0, y, 0, Math.PI / 2);
  if (lk.top === 'shirt') { ring(0.066, 0.02, '#ffffff', 0.525); }
  if (lk.top === 'polo') { ring(0.066, 0.02, top, 0.525); }
  if (lk.top === 'jacket') { put(L, gbox(0.1, 0.24, 0.012), '#f2f2ee', 0, 0.37, -0.128); put(L, gbox(0.012, 0.44, 0.012), '#1d1d22', 0, 0.26, -0.13); }
  if (lk.top === 'hoodie') { put(L, gtorus(0.09, 0.045), top, 0, 0.5, 0.075, 1.25); put(L, gbox(0.2, 0.1, 0.02), top, 0, 0.13, -0.122); }
  if (lk.top === 'sweater' || lk.top === 'coat') ring(0.068, 0.024, top, 0.52);
  if (lk.top === 'tracksuit') { put(L, gbox(0.012, 0.44, 0.012), '#ffffff', 0, 0.26, -0.13); ring(0.066, 0.02, top, 0.525); }
  if (lk.top === 'uniform') { const b = new THREE.CylinderGeometry(0.19, 0.19, 0.04, 16, 1, true); b.scale(1.12, 1, 0.74); put(L, b, '#e6eef2', 0, 0.3, 0); }
  const o = (k) => lk.opts.includes(k);
  if (o('tie')) put(L, gbox(0.036, 0.3, 0.012), lk.accC, 0, 0.3, -0.13);
  if (o('scarf')) put(L, gtorus(0.075, 0.032), lk.accC, 0, 0.51, 0, Math.PI / 2);
  if (o('apron')) { put(L, gbox(0.3, 0.48, 0.02), lk.apronC || '#FF8A1A', 0, 0.16, -0.132); }
  if (o('vest')) { const vc = lk.vestC || '#FF7A1A'; put(L, gbox(0.34, 0.4, 0.02), vc, 0, 0.28, -0.13); put(L, gbox(0.34, 0.4, 0.02), vc, 0, 0.28, 0.13); }
  if (o('badge')) put(L, gbox(0.05, 0.035, 0.01), '#e0b44c', -0.085, 0.38, -0.14);
  if (o('chain')) put(L, gtorus(0.1, 0.008), '#e0b44c', 0, 0.44, -0.03, 1.3);
  if (o('backpack')) { put(L, gbox(0.28, 0.36, 0.14), lk.accC, 0, 0.3, 0.19); put(L, gbox(0.26, 0.1, 0.02), '#222', 0, 0.38, 0.265); }
  if (o('bag')) { put(L, gbox(0.2, 0.15, 0.07), lk.accC, 0.2, -0.02, 0.02); put(L, gbox(0.02, 0.62, 0.012), '#3a2c24', 0.02, 0.22, -0.125, 0, 0, 0.62); }
  finish(spine, L);
  // голова
  const neck = J.neck = joint(spine, 0, 0.53, 0);
  L = []; put(L, glimb(0.05, 0.056, 0.09), skin, 0, 0.09, 0); finish(neck, L);
  const head = J.head = joint(neck, 0, 0.08, 0);
  L = [];
  put(L, gsph(0.112, 0.92, 1.08, 1.0), skin, 0, 0.1, 0);
  for (const sx of [-1, 1]) {
    put(L, gsph(0.026, 0.55, 1, 0.9), skin, sx * 0.104, 0.1, 0.012);
    put(L, gsph(0.015), '#1a1a1a', sx * 0.04, 0.122, -0.098);
    put(L, gbox(0.042, 0.009, 0.01), hairC, sx * 0.041, 0.152, -0.102);
    if (o('earrings')) put(L, gsph(0.011), '#e0b44c', sx * 0.105, 0.06, 0.0);
  }
  put(L, gsph(0.018, 1, 1.15, 1.4), skin, 0, 0.093, -0.112);
  put(L, gbox(0.042, 0.007, 0.008), '#a5524a', 0, 0.052, -0.103);
  const H = lk.hair, hc = hairC;
  const crown = (r, sy, c) => put(L, gpart(r, 0, Math.PI * 2, 0, Math.PI * 0.5, 0.97, sy, 1.0), c, 0, 0.115, 0.006);
  const back = (r, th, c) => put(L, gpart(r, 0, Math.PI, 0, Math.PI * th, 0.98, 1.0, 1.0), c, 0, 0.1, 0.008);
  if (H !== 'bald' && !o('hood_up')) {
    if (H === 'buzz') { crown(0.116, 0.78, hc); back(0.115, 0.62, hc); }
    else if (H === 'curly' || H === 'afro') { const R = H === 'afro' ? 0.15 : 0.125; crown(R, 0.82, hc); back(R - 0.01, 0.62, hc); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(L, gsph(0.045), hc, Math.cos(a) * 0.09, 0.2, Math.sin(a) * 0.07 + 0.01); } }
    else {
      crown(0.121, 0.8, hc); back(0.12, H === 'long' || H === 'bob' ? 0.78 : 0.64, hc);
      if (H === 'long') put(L, gbox(0.2, 0.3, 0.045), hc, 0, -0.07, 0.085);
      if (H === 'bob') { put(L, gbox(0.05, 0.13, 0.12), hc, -0.105, 0.05, 0.01); put(L, gbox(0.05, 0.13, 0.12), hc, 0.105, 0.05, 0.01); }
      if (H === 'ponytail') put(L, glimb(0.035, 0.02, 0.22), hc, 0, 0.13, 0.12, 0.6);
      if (H === 'bun') put(L, gsph(0.055), hc, 0, 0.21, 0.07);
      if (H === 'pigtails' || H === 'braids') { put(L, glimb(0.03, 0.02, 0.22), hc, -0.1, 0.06, 0.06, 0.2); put(L, glimb(0.03, 0.02, 0.22), hc, 0.1, 0.06, 0.06, 0.2); }
      if (H === 'mohawk') put(L, gbox(0.03, 0.06, 0.2), hc, 0, 0.23, 0.01);
      if (H === 'spiky') for (let i = 0; i < 5; i++) put(L, new THREE.ConeGeometry(0.025, 0.06, 5), hc, (i - 2) * 0.035, 0.235, 0.0);
    }
  }
  const hatC = lk.hatC;
  if (o('cap')) { put(L, gpart(0.124, 0, Math.PI * 2, 0, Math.PI / 2, 0.96, 0.72, 1.0), hatC, 0, 0.148, 0.004); put(L, gbox(0.17, 0.012, 0.11), hatC, 0, 0.152, -0.155, 0.14); }
  if (o('beanie')) { put(L, gpart(0.126, 0, Math.PI * 2, 0, Math.PI / 2, 0.97, 0.95, 1.0), hatC, 0, 0.13, 0.004); put(L, gtorus(0.118, 0.016), hatC, 0, 0.13, 0.004, Math.PI / 2); }
  if (o('hardhat')) { put(L, gpart(0.13, 0, Math.PI * 2, 0, Math.PI / 2, 1, 0.85, 1.05), '#FFD43A', 0, 0.15, 0); put(L, new THREE.CylinderGeometry(0.16, 0.16, 0.012, 16), '#FFD43A', 0, 0.15, -0.01); }
  if (o('bucket')) put(L, new THREE.CylinderGeometry(0.1, 0.15, 0.1, 14), hatC, 0, 0.21, 0);
  if (o('beret')) put(L, gsph(0.13, 1.05, 0.35, 1.0), hatC, 0.02, 0.215, 0.0);
  if (o('headband')) put(L, gtorus(0.112, 0.014), '#ffffff', 0, 0.16, 0, Math.PI / 2);
  if (o('headphones')) { put(L, new THREE.TorusGeometry(0.125, 0.012, 6, 16, Math.PI), '#222', 0, 0.115, 0); put(L, gsph(0.04, 0.6, 1, 1), '#222', -0.115, 0.1, 0); put(L, gsph(0.04, 0.6, 1, 1), '#222', 0.115, 0.1, 0); }
  if (o('hood_up')) put(L, gpart(0.14, 0, Math.PI * 2, 0, Math.PI * 0.62, 1, 1.05, 1.08), lk.topC, 0, 0.1, 0.03);
  if (o('mask')) put(L, gbox(0.17, 0.08, 0.03), '#1d1d22', 0, 0.055, -0.1);
  if (o('glasses')) { for (const sx of [-1, 1]) put(L, gtorus(0.024, 0.005), '#222', sx * 0.042, 0.122, -0.112); put(L, gbox(0.03, 0.005, 0.005), '#222', 0, 0.124, -0.114); }
  if (o('sunglasses')) put(L, gbox(0.13, 0.036, 0.012), '#111', 0, 0.122, -0.11);
  if (o('beard')) put(L, gsph(0.085, 1.05, 0.75, 0.75), hc, 0, 0.035, -0.045);
  if (o('goatee')) put(L, gsph(0.025, 1, 1.4, 1), hc, 0, 0.02, -0.098);
  if (o('mustache')) put(L, gbox(0.065, 0.016, 0.015), hc, 0, 0.068, -0.108);
  finish(head, L);
  // руки
  const shortSleeve = lk.top === 'none' || lk.top === 'polo' || lk.top === 'uniform';
  for (const [k, sx] of [['L', -1], ['R', 1]]) {
    const sh = J['sh' + k] = joint(spine, sx * (fem ? 0.19 : 0.205), 0.43, 0);
    L = []; put(L, gsph(0.066), top); put(L, glimb(0.06, 0.05, 0.29), top);
    if (lk.top === 'tracksuit') put(L, gbox(0.014, 0.28, 0.014), '#ffffff', sx * 0.058, -0.14, 0);
    finish(sh, L);
    const el2 = J['el' + k] = joint(sh, 0, -0.29, 0);
    L = []; const fc = shortSleeve ? skin : top; put(L, gsph(0.05), fc); put(L, glimb(0.048, 0.042, 0.25), fc);
    if (lk.top === 'tracksuit') put(L, gbox(0.014, 0.24, 0.014), '#ffffff', sx * 0.048, -0.12, 0);
    finish(el2, L);
    const wr = J['wr' + k] = joint(el2, 0, -0.25, 0);
    L = []; put(L, gsph(0.044, 0.8, 1.2, 0.55), skin, 0, -0.048, 0); put(L, gsph(0.016, 1, 1.7, 1), skin, -sx * 0.034, -0.04, -0.012); finish(wr, L);
  }
  if (lk.kid) P.g.scale.setScalar(0.8);
  P.g.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  return P;
}
// жесты: поза поверх ходьбы; f(T) — по времени от начала
const GEST = {
  nod: { d: 0.8, f: (T) => ({ hdX: 0.22 * Math.sin(T * 12) }) },
  shake: { d: 0.9, f: (T) => ({ hdY: 0.42 * Math.sin(T * 11) }) },
  cross: { d: 1.8, f: () => ({ shLx: 0.8, shRx: 0.8, shLz: 0.55, shRz: -0.55, elL: 1.9, elR: 1.9 }) },
  shrug: { d: 1.0, f: () => ({ shLz: -0.45, shRz: 0.45, elL: 1.35, elR: 1.35, hdX: 0.08 }) },
  inspect: { d: 1.6, f: () => ({ shLx: 0.8, shRx: 0.8, shLz: 0.28, shRz: -0.28, elL: 1.15, elR: 1.15, hdX: -0.3 }) },
  pay: { d: 1.1, f: () => ({ shRx: 1.2, shRz: -0.1, elR: 0.45 }) },
  wave: { d: 1.6, f: (T) => ({ shRz: 2.6, shRx: 0.2, elR: 0.25, elRz: 0.55 + 0.5 * Math.sin(T * 11) }) },
  point: { d: 1.2, f: () => ({ shRx: 1.5, shRz: -0.04, elR: 0.05 }) },
  happy: { d: 1.0, f: (T) => ({ shLz: -2.2, shRz: 2.2, elL: 0.3, elR: 0.3, hdX: 0.15 + 0.05 * Math.sin(T * 14) }) },
  angry: { d: 1.2, f: () => ({ shLz: -0.25, shRz: 0.25, elL: 1.0, elR: 1.0, spX: 0.08, hdX: -0.12 }) },
  talk: { d: 2.0, f: (T) => ({ shRx: 0.35 + 0.25 * Math.sin(T * 5), elR: 0.9 + 0.3 * Math.sin(T * 7), shLx: 0.2 + 0.15 * Math.sin(T * 4 + 1), elL: 0.6 }) },
  grab: { d: 0.6, f: () => ({ shRx: 1.35, shRz: -0.1, elR: 0.2, spX: -0.25 }) },
  think: { d: 1.6, f: () => ({ shRx: 0.95, shRz: -0.35, elR: 2.1, hdX: 0.1, hdY: 0.15 }) },
};
function gest(P, name) { if (!P || !GEST[name]) return; P.st.gest = name; P.st.gT = 0; }
function animPerson(P, dt) {
  const st = P.st, J = P.J; st.t += dt;
  const v = st.speed;
  st.phase += v * dt / (1.05 + 0.3 * v) * Math.PI * 2;
  const walkW = clamp(v / 1.3, 0, 1), runW = clamp((v - 2.2) / 2.8, 0, 1), idle = 1 - walkW;
  const s = Math.sin(st.phase), c = Math.cos(st.phase), br = Math.sin(st.t * 1.8);
  const A = (0.45 + 0.4 * runW) * walkW, K = (0.65 + 0.6 * runW) * walkW, B = (0.38 + 0.5 * runW) * walkW;
  const p = {
    thL: A * s, thR: -A * s, knL: -(0.05 + K * Math.max(0, c)), knR: -(0.05 + K * Math.max(0, -c)),
    shLx: -B * s, shRx: B * s, shLz: -0.1 - 0.015 * br * idle, shRz: 0.1 + 0.015 * br * idle,
    elL: 0.15 + (0.2 + 1.1 * runW) * walkW, elR: 0.15 + (0.2 + 1.1 * runW) * walkW, elLz: 0, elRz: 0,
    spX: -(0.03 * walkW + 0.2 * runW) + st.hunch + 0.01 * br * idle, spY: 0.08 * walkW * s, spZ: 0, hdX: st.lookX || 0, hdY: st.lookY || 0,
  };
  if (st.gest) {
    const G = GEST[st.gest], T = st.gT += dt;
    if (T >= G.d) st.gest = null;
    else { const w = Math.min(1, T / 0.2, (G.d - T) / 0.25), e = w * w * (3 - 2 * w), q = G.f(T); for (const k in q) p[k] += (q[k] - p[k]) * e; }
  }
  J.pelvis.position.y = Math.max(legDrop(p.thL, p.knL), legDrop(p.thR, p.knR)) + 0.03 * runW * Math.abs(c);
  J.hipL.rotation.x = p.thL; J.kneeL.rotation.x = p.knL; J.ankleL.rotation.x = -(p.thL + p.knL) * 0.85;
  J.hipR.rotation.x = p.thR; J.kneeR.rotation.x = p.knR; J.ankleR.rotation.x = -(p.thR + p.knR) * 0.85;
  J.spine.rotation.set(p.spX, p.spY, p.spZ);
  st.headY += (p.hdY - p.spY - st.headY) * Math.min(1, dt * 8); st.headX += (p.hdX - st.headX) * Math.min(1, dt * 8);
  J.head.rotation.set(st.headX, st.headY, 0);
  J.shL.rotation.set(p.shLx, 0, p.shLz); J.elL.rotation.set(p.elL, 0, p.elLz);
  J.shR.rotation.set(p.shRx, 0, p.shRz); J.elR.rotation.set(p.elR, 0, p.elRz);
}
// пузырёк эмоции над головой: ♥ дёшево, ✓ нормально, ? на грани, ! дорого
const BUB = {};
function bubbleTex(sym, color) {
  const key = sym + color; if (BUB[key]) return BUB[key];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = color; x.beginPath(); x.arc(64, 58, 50, 0, 7); x.fill(); x.beginPath(); x.moveTo(50, 100); x.lineTo(64, 124); x.lineTo(78, 100); x.fill();
  x.fillStyle = '#ffffff'; x.font = '800 62px "Golos Text", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sym, 64, 62);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (BUB[key] = t);
}
const BCOL = { pink: '#FF4F9A', green: '#1f9d55', mustard: '#E0A21A', red: '#D63E1E', blue: '#2F6FE0', gold: '#C9971A', grey: '#5b616b' };
function bubble(P, sym, col) {
  if (!P.bub) { P.bub = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, toneMapped: false })); P.bub.scale.set(0.42, 0.42, 1); P.bub.renderOrder = 15; P.bub.position.set(0, 2.18, 0); P.g.add(P.bub); }
  if (!sym) { P.bub.visible = false; return; }
  P.bub.material.map = bubbleTex(sym, BCOL[col] || col); P.bub.material.needsUpdate = true; P.bub.visible = true;
}
// подпись над персонажем сюжета
function nameTag(P, name, role) {
  const s = spriteSign([name, role], 'rgba(16,18,22,0.86)', '#ffffff', 0.34, { round: true, fg2: '#ffd34d' });
  s.position.set(0, 2.25, 0); s.material.depthTest = true; P.g.add(s); P.tag = s;
}

/* ---------- путь по второму этажу: поле расстояний на сетке 0,8 м, люди идут «под горку» ---------- */
const NAV = { ok: false, fields: {} };
function navBuild() {
  if (NAV.ok) return;
  const b = bboxOf(mainPoly), cs = 0.8;
  Object.assign(NAV, { cs, x0: b.x0, z0: b.z0, nx: Math.ceil((b.x1 - b.x0) / cs), nz: Math.ceil((b.z1 - b.z0) / cs) });
  NAV.walk = new Uint8Array(NAV.nx * NAV.nz);
  for (let j = 0; j < NAV.nz; j++) for (let i = 0; i < NAV.nx; i++) {
    const x = NAV.x0 + (i + 0.5) * cs, z = NAV.z0 + (j + 0.5) * cs;
    NAV.walk[j * NAV.nx + i] = onSlab(x, z) && !blocked(x, z, H2) ? 1 : 0;
  }
  NAV.ok = true;
}
const cellOf = (x, z) => { const i = Math.floor((x - NAV.x0) / NAV.cs), j = Math.floor((z - NAV.z0) / NAV.cs); return i < 0 || j < 0 || i >= NAV.nx || j >= NAV.nz ? -1 : j * NAV.nx + i; };
const cellXZ = (k) => [NAV.x0 + (k % NAV.nx + 0.5) * NAV.cs, NAV.z0 + (Math.floor(k / NAV.nx) + 0.5) * NAV.cs];
function nearestWalk(x, z) {
  const k0 = cellOf(x, z); if (k0 >= 0 && NAV.walk[k0]) return k0;
  let best = -1, bd = 1e9;
  for (let r = 1; r <= 8 && best < 0; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const k = cellOf(x + di * NAV.cs, z + dj * NAV.cs); if (k < 0 || !NAV.walk[k]) continue;
    const [cx, cz] = cellXZ(k), d = Math.hypot(cx - x, cz - z); if (d < bd) { bd = d; best = k; }
  }
  return best;
}
const NB8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function fieldTo(key, pts) {
  if (NAV.fields[key]) return NAV.fields[key];
  const n = NAV.nx * NAV.nz, f = new Float32Array(n).fill(1e9), q = new Int32Array(n * 2); let h = 0, t = 0;
  pts.forEach(([x, z]) => { const k = nearestWalk(x, z); if (k >= 0 && f[k] > 0) { f[k] = 0; q[t++] = k; } });
  while (h < t) { // волна по 8 соседям; по диагонали — только если не срезаем угол
    const k = q[h++], i = k % NAV.nx, j = (k - i) / NAV.nx;
    for (const [di, dj] of NB8) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NAV.nx || jj >= NAV.nz) continue;
      const kk = jj * NAV.nx + ii; if (!NAV.walk[kk]) continue;
      if (di && dj && (!NAV.walk[j * NAV.nx + ii] || !NAV.walk[jj * NAV.nx + i])) continue;
      const nd = f[k] + (di && dj ? 1.414 : 1); if (nd < f[kk] - 0.01) { f[kk] = nd; if (t < q.length) q[t++] = kk; }
    }
  }
  return (NAV.fields[key] = f);
}
function fieldAt(f, x, z) { const k = nearestWalk(x, z); return k < 0 ? 1e9 : f[k]; }
function nextOnField(f, x, z) {
  let k = cellOf(x, z); if (k < 0 || !NAV.walk[k] || f[k] >= 1e9) k = nearestWalk(x, z);
  if (k < 0 || f[k] >= 1e9) return null;
  let cur = k;
  for (let s = 0; s < 3; s++) {
    const i = cur % NAV.nx, j = (cur - i) / NAV.nx; let best = cur;
    for (const [di, dj] of NB8) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NAV.nx || jj >= NAV.nz) continue;
      const kk = jj * NAV.nx + ii; if (!NAV.walk[kk]) continue;
      if (di && dj && (!NAV.walk[j * NAV.nx + ii] || !NAV.walk[jj * NAV.nx + i])) continue;
      if (f[kk] < f[best]) best = kk;
    }
    if (best === cur) break; cur = best;
  }
  return cur === k ? null : cellXZ(cur);
}
// движение: по полю к цели, прямо к точке, вверх или вниз по лестнице
function go(P, nav) {   // a new goal replaces the old one; the old promise still resolves
  if (P.nav && P.nav.done) { const d = P.nav.done; P.nav = null; d(); }
  return new Promise((res) => { P.nav = Object.assign({ speed: 1.45 }, nav, { done: res }); });
}
function moveNPC(P, dt) {
  const n = P.nav; if (!n) { P.st.speed = 0; return; }
  const pos = P.g.position;
  const end = () => { P.nav = null; P.st.speed = 0; n.done && n.done(); };
  if (n.kind === 'stairs') {
    const Ln = n.L; n.t = clamp((n.t === undefined ? (n.up ? 0 : 1) : n.t) + (n.up ? 1 : -1) * n.speed * dt / Ln.len, 0, 1);
    pos.set(Ln.a[0] + Ln.dx * Ln.len * n.t, n.t * H2, Ln.a[1] + Ln.dz * Ln.len * n.t);
    P.yaw = Math.atan2(-(n.up ? Ln.dx : -Ln.dx), -(n.up ? Ln.dz : -Ln.dz));
    P.st.speed = Ln.kind === 'escalator' ? 0 : n.speed;
    if ((n.up && n.t >= 1) || (!n.up && n.t <= 0)) end();
  } else {
    const [gx, gz] = n.goal; let tx = gx, tz = gz;
    const dg = Math.hypot(gx - pos.x, gz - pos.z);
    if (n.kind === 'field' && dg > 2.5) { const nx = nextOnField(n.f, pos.x, pos.z); if (nx) { tx = nx[0]; tz = nx[1]; } }
    const dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz);
    if (dg < 0.12) { pos.x = gx; pos.z = gz; end(); }
    else {
      const sp = n.speed * (n.k ? n.k() : 1), stp = Math.min(d, sp * dt);
      pos.x += dx / (d || 1) * stp; pos.z += dz / (d || 1) * stp; P.st.speed = sp;
      const want = Math.atan2(-dx, -dz); P.yaw += clamp(Math.atan2(Math.sin(want - P.yaw), Math.cos(want - P.yaw)), -9 * dt, 9 * dt);
    }
    if (n.y !== undefined) pos.y = n.y;
  }
  P.g.rotation.y = P.yaw;
}
function faceTo(P, x, z) { P.yaw = Math.atan2(-(x - P.g.position.x), -(z - P.g.position.z)); P.g.rotation.y = P.yaw; }

/* ---------- товары в 3D: на витрине и в руках ---------- */
function itemGeo(pid) {
  const L = [], rc = pick(['#FF5A36', '#3B82F6', '#22C55E', '#FF4F9A', '#FFC23A', '#8A5CFF']);
  switch (pid) {
    case 'case': put(L, gbox(0.08, 0.155, 0.014), rc); break;
    case 'charger': put(L, gbox(0.045, 0.045, 0.045), '#f4f4f2'); put(L, gbox(0.012, 0.012, 0.09), '#f4f4f2', 0, -0.01, 0.06); break;
    case 'powerbank': put(L, gbox(0.07, 0.13, 0.018), '#3a3e46'); put(L, gbox(0.02, 0.005, 0.019), '#4ade80', 0, 0.05, 0); break;
    case 'buds': put(L, gsph(0.05, 1, 0.7, 0.6), '#f4f4f2'); break;
    case 'phone': put(L, gbox(0.075, 0.155, 0.009), '#18191d'); put(L, gbox(0.068, 0.145, 0.002), '#2f6fe0', 0, 0, -0.005); break;
    case 'band': put(L, gtorus(0.035, 0.008), '#18191d'); put(L, gbox(0.02, 0.035, 0.008), '#2f6fe0', 0, 0.035, 0); break;
    case 'mouse': put(L, gsph(0.04, 0.8, 0.45, 1.2), '#22232a', 0, 0.01, 0); break;
    case 'speaker': put(L, new THREE.CylinderGeometry(0.04, 0.04, 0.13, 14), '#22232a'); put(L, gtorus(0.032, 0.006), rc, 0, 0.066, 0, Math.PI / 2); break;
    case 'watch': put(L, gbox(0.04, 0.046, 0.012), '#18191d'); put(L, gbox(0.022, 0.12, 0.006), '#3a3e46', 0, 0, 0.004); break;
    case 'tablet': put(L, gbox(0.17, 0.24, 0.008), '#d6d8dc'); put(L, gbox(0.155, 0.225, 0.002), '#24324a', 0, 0, -0.005); break;
    case 'actioncam': put(L, gbox(0.06, 0.045, 0.035), '#18191d'); put(L, new THREE.CylinderGeometry(0.014, 0.014, 0.012, 12), '#3a5f8a', 0, 0, -0.022, Math.PI / 2); break;
    case 'laptop': put(L, gbox(0.32, 0.016, 0.22), '#b9bec4'); put(L, gbox(0.32, 0.21, 0.01), '#b9bec4', 0, 0.105, 0.11, -0.25); break;
    case 'console': put(L, gbox(0.27, 0.06, 0.2), '#f2f2f0'); put(L, gbox(0.27, 0.012, 0.2), '#18191d', 0, 0.036, 0); break;
    case 'vr': put(L, gbox(0.18, 0.1, 0.1), '#f2f2f0'); put(L, gbox(0.16, 0.06, 0.01), '#18191d', 0, 0, -0.051); break;
    case 'drone': put(L, gbox(0.08, 0.03, 0.08), '#e6e8ea'); for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) put(L, new THREE.CylinderGeometry(0.035, 0.035, 0.006, 12), '#3a3e46', a * 0.09, 0.02, b * 0.09); break;
    default: put(L, gbox(0.1, 0.07, 0.05), RM[pid] ? '#8A5A3E' : rc);
  }
  return L;
}
function itemMesh(pid) { const g = new THREE.Group(); finish(g, itemGeo(pid)); return g; }

/* ---------- интерфейс ---------- */
const CSS = `
#gHud { display: grid; gap: 6px; justify-items: start; }
#gHud .chip { gap: 10px; }
#gHud .cash { color: #ffd34d; font-variant-numeric: tabular-nums; }
#gHud .stars { color: #ffd34d; letter-spacing: -1px; }
#gGoal { pointer-events: auto; cursor: pointer; max-width: min(340px, 44vw); font-size: 12.5px; font-weight: 600; color: #e9edf2; }
#gGoal small { color: var(--muted); font-weight: 500; }
.gpanel { position: absolute; z-index: 9; right: calc(10px + env(safe-area-inset-right, 0px)); top: calc(62px + env(safe-area-inset-top, 0px)); bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  width: min(400px, 46vw); background: rgba(16,18,22,0.94); border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; backdrop-filter: blur(6px); }
.gpanel h3 { margin: 0; font-size: 16px; } .gpanel p { margin: 0; color: #d7dce3; font-size: 13.5px; line-height: 1.4; }
.gpanel .muted { color: var(--muted); font-size: 12px; }
.gwho { display: flex; align-items: center; gap: 8px; } .gwho b { font-size: 15px; } .gwho .tr { font-size: 11px; padding: 2px 7px; border-radius: 6px; background: #2b2f38; color: #ffd34d; }
.gpat { margin-left: auto; display: flex; gap: 3px; } .gpat i { width: 9px; height: 9px; border-radius: 50%; background: #ffd34d; } .gpat i.off { background: #3a3e46; }
.gsay { background: #f6f2e8; color: #1d1f22; border-radius: 12px 12px 12px 4px; padding: 8px 11px; font-size: 14px; font-weight: 600; line-height: 1.35; }
.gsay.me { background: #2f6fe0; color: #fff; border-radius: 12px 12px 4px 12px; align-self: flex-end; }
.gb { font: 600 14px var(--font); color: #fff; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.14); border-radius: 10px; padding: 9px 12px; cursor: pointer; text-align: left; }
.gb:disabled { opacity: 0.4; cursor: default; } .gb small { display: block; color: var(--muted); font-weight: 500; font-size: 11.5px; }
.gb.go { background: #1f9d55; border-color: #1f9d55; text-align: center; } .gb.red { background: #c8161d; border-color: #c8161d; text-align: center; }
.gb.gold { background: #ffc23a; border-color: #ffc23a; color: #1d1f22; text-align: center; } .gb.blue { background: #2f6fe0; border-color: #2f6fe0; text-align: center; }
.grow { display: flex; gap: 6px; } .grow > * { flex: 1; } .ggrid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.gitem { display: flex; align-items: center; gap: 8px; } .gitem .q { margin-left: auto; color: var(--muted); font-size: 12px; } .gitem .p { color: #ffd34d; font-weight: 700; font-variant-numeric: tabular-nums; }
.gtag { background: #ffd34d; color: #1d1f22; border-radius: 10px; padding: 6px 10px; display: flex; align-items: baseline; gap: 8px; }
.gtag b { font-size: 22px; font-variant-numeric: tabular-nums; } .gtag .pr { margin-left: auto; font-weight: 700; font-size: 13px; } .gtag .pr.r { color: #b3261e; } .gtag .pr.g { color: #146c3a; }
.gslide { display: flex; gap: 6px; align-items: center; } .gslide input { flex: 1; accent-color: #ffc23a; height: 30px; }
.gslide .gb { width: 42px; text-align: center; padding: 8px 0; font-size: 18px; }
.gmarks { position: relative; height: 14px; margin: -4px 48px 0; font-size: 10px; color: var(--muted); } .gmarks i { position: absolute; transform: translateX(-50%); font-style: normal; white-space: nowrap; }
.gheat { height: 10px; border-radius: 6px; background: #2b2f38; position: relative; overflow: visible; } .gheat > i { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: linear-gradient(90deg, #2f6fe0, #ff5a36); }
.gheat > b { position: absolute; top: -4px; bottom: -4px; width: 3px; background: #ffd34d; border-radius: 2px; }
.gbill { display: inline-block; padding: 6px 8px; border-radius: 6px; background: #8fb39a; color: #12301d; font-weight: 800; margin: 2px; font-size: 13px; } .gbill.uv { background: #7b5cff; color: #fff; } .gbill.fake.uv { background: #d63e1e; }
.gdlg { position: absolute; z-index: 11; left: 50%; transform: translateX(-50%); bottom: calc(10px + env(safe-area-inset-bottom, 0px)); width: min(660px, 92vw);
  background: rgba(16,18,22,0.95); border: 1px solid var(--line); border-radius: 14px; padding: 10px 14px; display: grid; gap: 8px; cursor: pointer; }
.gdlg .nm { display: flex; align-items: center; gap: 8px; } .gdlg .nm b { font-size: 15px; } .gdlg .nm span { color: var(--muted); font-size: 12px; }
.gdlg .nm i { width: 12px; height: 12px; border-radius: 50%; } .gdlg p { margin: 0; font-size: 15px; line-height: 1.4; } .gdlg .nx { justify-self: end; color: var(--muted); font-size: 12px; }
#gPrompt { position: absolute; z-index: 6; left: 50%; transform: translateX(-50%); bottom: calc(86px + env(safe-area-inset-bottom, 0px)); pointer-events: auto; cursor: pointer;
  background: #ffc23a; color: #1d1f22; font-weight: 700; font-size: 14px; border-radius: 12px; padding: 8px 14px; box-shadow: 0 6px 18px rgba(0,0,0,0.35); }
#gBanner { position: absolute; z-index: 12; left: 50%; top: 26%; transform: translate(-50%, -50%) scale(1); pointer-events: none; font: 900 34px var(--font); color: #ffd34d;
  text-shadow: 0 3px 0 #7a1116, 0 6px 18px rgba(0,0,0,0.5); transition: opacity 0.5s, transform 0.5s; white-space: nowrap; }
#gNotes { position: absolute; z-index: 12; left: 50%; transform: translateX(-50%); top: calc(10px + env(safe-area-inset-top, 0px)); display: grid; gap: 6px; justify-items: center; pointer-events: none; }
#gNotes div { background: rgba(16,18,22,0.92); border: 1px solid var(--line); border-radius: 10px; padding: 6px 12px; font-size: 13px; font-weight: 600; max-width: 70vw; text-align: center; }
#gNotes div.good { border-color: #1f9d55; } #gNotes div.bad { border-color: #c8161d; } #gNotes div.gold { border-color: #ffc23a; color: #ffd34d; }
.gbusy #toast, .gbusy #joyWrap, .gbusy #runWrap, .gbusy #minimap, .gbusy #zones, .gbusy #hint, .gbusy #gPrompt { display: none !important; }
.gtalk #joyWrap, .gtalk #runWrap, .gtalk #toast, .gtalk #gPrompt, .gtalk #hint { display: none !important; }
@media (max-height: 430px) { .gpanel { top: calc(56px + env(safe-area-inset-top, 0px)); } .gsay { font-size: 13px; } .gb { padding: 7px 10px; font-size: 13px; } .gtag b { font-size: 19px; } #gBanner { font-size: 28px; } }
`;
let panelEl, dlgEl, promptEl, bannerEl, notesEl, hudEl, goalEl;
let pend = null, onInput = null;
function uiInit() {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const g = el('game');
  panelEl = document.createElement('div'); panelEl.className = 'gpanel'; panelEl.hidden = true; g.appendChild(panelEl);
  dlgEl = document.createElement('div'); dlgEl.className = 'gdlg'; dlgEl.hidden = true; g.appendChild(dlgEl);
  promptEl = document.createElement('div'); promptEl.id = 'gPrompt'; promptEl.hidden = true; g.appendChild(promptEl);
  promptEl.addEventListener('click', () => onAction());
  bannerEl = document.createElement('div'); bannerEl.id = 'gBanner'; bannerEl.style.opacity = 0; g.appendChild(bannerEl);
  notesEl = document.createElement('div'); notesEl.id = 'gNotes'; g.appendChild(notesEl);
  hudEl = document.createElement('div'); hudEl.id = 'gHud'; hudEl.hidden = true;
  hudEl.innerHTML = '<div class="chip" id="gMoney"></div><div class="chip small" id="gGoal"></div>';
  document.querySelector('.hud.tl').appendChild(hudEl); goalEl = el('gGoal');
  const click = (e) => { const b = e.target.closest('[data-a]'); if (!b || b.disabled || !pend) return; const r = pend; pend = null; r({ a: b.dataset.a, v: b.dataset.v }); };
  panelEl.addEventListener('click', click); dlgEl.addEventListener('click', click);
  panelEl.addEventListener('input', (e) => { if (onInput) onInput(e); });
}
function ask(html, where) { const box = where === 'dlg' ? dlgEl : panelEl; box.innerHTML = html; box.hidden = false; if (box === panelEl) panelEl.scrollTop = 0; return new Promise((r) => { pend = r; }); }
function closePanel() { panelEl.hidden = true; panelEl.innerHTML = ''; pend = null; onInput = null; }
function note(text, kind) {
  const d = document.createElement('div'); d.className = kind || ''; d.textContent = text; notesEl.appendChild(d);
  while (notesEl.children.length > 3) notesEl.firstChild.remove();
  setTimeout(() => d.remove(), 3200);
}
let bannerT = 0;
function banner(text, color) {
  bannerEl.textContent = text; bannerEl.style.color = color || '#ffd34d'; bannerEl.style.opacity = 1; bannerEl.style.transform = 'translate(-50%, -50%) scale(1.08)';
  clearTimeout(bannerT); bannerT = setTimeout(() => { bannerEl.style.opacity = 0; bannerEl.style.transform = 'translate(-50%, -50%) scale(1)'; }, 1100);
}
function busy(on) { el('game').classList.toggle('gbusy', !!on); }
function talking(on) { el('game').classList.toggle('gtalk', !!on); }
/* =====================================================================
   СОСТОЯНИЕ, ЭКОНОМИКА, СЮЖЕТНЫЕ ЦЕЛИ
   ===================================================================== */
const SAVE_KEY = 'gorbushka-king-1';
let S = null;
let UID = 1;
function freshState() {
  const s = { v: 1, day: 1, cash: 40000, xp: 0, level: 1, rep: 30, debt: 0, phase: 'morning', chapter: 1, chSnap: {}, chReady: false, scenes: {}, flags: {}, sideSeen: {},
    stats: {}, stock: [], parts: {}, jobs: [], rares: {}, cols: {}, up: {}, ads: {}, adsNext: {}, mk: {}, news: null, returnsDue: [], stolenDue: [], cartel: 0, uidN: 100, chDay: 1 };
  STAT_KEYS.forEach((k) => { s.stats[k] = 0; });
  PRODUCTS.forEach((p) => { s.mk[p.id] = 1; });
  return s;
}
const newUid = () => (S.uidN = (S.uidN || 100) + 1);
function addStock(pid, cond, q, cost, extra) {
  const same = !extra && S.stock.find((l) => l.pid === pid && l.cond === cond && Math.abs(l.cost - cost) < 1 && !l.def && !l.stolen && !l.fault);
  if (same) same.q += q; else S.stock.push(Object.assign({ uid: newUid(), pid, cond, q, cost }, extra || {}));
}
function startStock() { // наследство дяди Миши
  addStock('phone', 'new', 1, 14000); addStock('phone', 'A', 1, 9000); addStock('buds', 'new', 3, 1800);
  addStock('case', 'new', 13, 250); addStock('charger', 'new', 10, 450); addStock('powerbank', 'new', 2, 1100);
}
const stockUnits = () => S.stock.reduce((a, l) => a + l.q, 0);
const STOCK_CAP = 70;
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* без сохранения в приватном окне */ } }
function load() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === 1 ? s : null; } catch (e) { return null; } }
function snapStats() { const o = {}; STAT_KEYS.forEach((k) => { o[k] = S.stats[k] || 0; }); return o; }
function stat(k, n) { S.stats[k] = (S.stats[k] || 0) + (n === undefined ? 1 : n); }
const marketPrice = (pid) => nice(PM[pid].price * S.mk[pid]);
const tagPrice = (pid, cond) => nice(marketPrice(pid) * COND[cond || 'new'].k * (S.cartel ? 1.1 : 1));
const avail = () => PRODUCTS.filter((p) => p.lv <= S.level);
const stars = (rep) => clamp(Math.round(rep / 20 * 2) / 2, 0, 5);
function starsTxt(rep) { const s = stars(rep); let h = ''; for (let i = 1; i <= 5; i++) h += s >= i ? '★' : s >= i - 0.5 ? '⯪' : '☆'; return h; }
function addRep(d) { S.rep = clamp(S.rep + d, 0, 100); if (TODAY) TODAY.repD += d; }
const xpNeed = (l) => Math.round(60 * Math.pow(l, 1.35));
function addXP(n) {
  S.xp += n;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level); S.level++;
    const now = PRODUCTS.filter((p) => p.lv === S.level).map((p) => p.name.toLowerCase());
    const tac = TACTICS.filter((t) => t.lv === S.level).map((t) => '«' + t.name + '»');
    note(`Уровень ${S.level}!${now.length ? ' Новый товар: ' + now.join(', ') + '.' : ''}${tac.length ? ' Тактики: ' + tac.join(', ') + '.' : ''}`, 'gold');
  }
}
function worth() {
  let w = S.cash - S.debt;
  S.stock.forEach((l) => { w += l.q * l.cost; });
  Object.entries(S.rares).forEach(([id, n]) => { w += n * RM[id].val * 0.6; });
  Object.entries(S.parts).forEach(([k, n]) => { const [sz, f] = k.split('_'); w += n * (PART_PRICE[sz][f] || 0) * 0.8; });
  return Math.round(w);
}
function rollMarket(first) {
  PRODUCTS.forEach((p) => { S.mk[p.id] = clamp(lerp(S.mk[p.id], 1, 0.25) * rnd(0.95, 1.05), 0.85, 1.2); });
  S.news = null;
  if (!first && chance(0.6)) {
    const av = PRODUCTS.filter((p) => p.lv <= S.level + 1);
    const hot = pick(av), cold = pick(av.filter((p) => p !== hot));
    S.mk[hot.id] = clamp(S.mk[hot.id] * 1.12, 0.85, 1.28); S.mk[cold.id] = clamp(S.mk[cold.id] * 0.9, 0.8, 1.2);
    S.news = { hot: hot.id, cold: cold.id, t: pick([`Хайп: все хотят ${hot.acc}! Спрос и цены выросли.`, `Блогеры обозревают ${hot.acc} — спрос вырос.`, `${hot.name}: в соседнем городе дефицит, люди едут к нам.`]),
      t2: pick([`${cold.name} подешевел у оптовиков.`, `На ${cold.acc} сезон затишья.`]) };
  }
}
function goalVal(g) {
  if (g.k === 'repAbs') return S.rep;
  if (g.k === 'worthAbs') return worth();
  if (g.k === 'neon') return S.up.neon ? 1 : 0;
  if (g.k === 'colsDone') return Object.keys(S.cols).length;
  return (S.stats[g.k] || 0) - (S.chSnap[g.k] || 0);
}
function chapterInfo() {
  const ch = CHAPTERS[S.chapter - 1]; if (!ch) return null;
  const goals = ch.goals.map((g) => ({ t: g.t, n: g.n, v: Math.min(g.n, Math.max(0, goalVal(g))), money: g.money }));
  return { ch, goals, done: goals.every((g) => g.v >= g.n) };
}
function checkChapter() {
  const ci = chapterInfo();
  if (ci && ci.done && !S.chReady) { S.chReady = true; note(`Глава «${ci.ch.title}» выполнена! Вечером узнаешь, что дальше`, 'gold'); }
  hud();
}
function rentNow() { return Math.round(9000 * (S.scenes.ch5done ? 0.8 : 1) / 100) * 100; }
function traffic() {
  let n = 4 + Math.floor(S.rep / 20);
  Object.keys(S.ads).forEach((id) => { const a = ADS.find((x) => x.id === id); if (a) n += a.add; });
  if (S.cols.svyaz) n += 1; if (S.up.neon) n += 2; if (S.day % 7 === 6 || S.day % 7 === 0) n += 1; if (S.flags.artur === 'left') n += 2;
  if (S.flags.students === S.day) n += 3;
  return clamp(n, 4, 14);
}
function wtpOf(c, pid, cond) {
  let k = c.wtpK * COND[cond].k;
  k *= 1 + (S.rep - 50) / 450;
  if (S.up.led) k *= 1.04; if (S.cols.games) k *= 1.05;
  if (S.news && S.news.hot === pid) k *= 1.07;
  if (S.cartel) k *= 1.06;
  if (S.chapter === 3 && !S.scenes.ch3done && !S.cartel) k *= 0.97; // Артур демпингует
  if (c.type === 'reseller' && cond === 'C') k = c.wtpK * 0.3;
  return marketPrice(pid) * k;
}
const stepFor = (v) => (v < 1500 ? 50 : v < 6000 ? 100 : v < 20000 ? 500 : 1000);

/* ---------- HUD ---------- */
function hud() {
  if (!S) { hudEl.hidden = true; return; }
  hudEl.hidden = false;
  el('gMoney').innerHTML = `<span class="cash">${rub(S.cash)}</span><span>День ${S.day} · ${WEEK[(S.day - 1) % 7]}${DAY.on ? ' · ' + clockTxt() : S.phase === 'evening' ? ' · вечер' : ' · утро'}</span><span class="stars" title="Репутация">${starsTxt(S.rep)}</span>`;
  const ci = chapterInfo();
  if (!S.scenes.intro) goalEl.innerHTML = 'Дядя Миша ждёт у павильона G2-103 <small>· ★ — дорога туда</small>';
  else if (!ci) goalEl.innerHTML = 'Акт I пройден! <small>· дальше — свободная торговля</small>';
  else { const g = ci.goals.find((x) => x.v < x.n) || ci.goals[0]; goalEl.innerHTML = `Гл. ${ci.ch.id} «${ci.ch.title}»: ${esc(g.t)} <small>${g.money ? krub(g.v) + ' / ' + krub(g.n) : g.v + ' / ' + g.n}${ci.done ? ' · готово!' : ''}</small>`; }
}
const clockTxt = () => { const m = 600 + Math.round(DAY.clock); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
let TODAY = null;
const newToday = () => ({ revenue: 0, cogs: 0, sold: 0, happy: 0, angry: 0, lost: 0, thefts: 0, caught: 0, fakeLoss: 0, refunds: 0, buyinSpent: 0, jobsPaid: 0, repD: 0, best: null });
const DAY = { on: false, clock: 0, q: [] };
/* =====================================================================
   МИР: твой павильон, места героев сюжета, разговоры, камеры, кадр
   ===================================================================== */
const SHOP = {};
const PEOPLE = new Set();          // все, кто двигается и дышит
const NPC = {};                    // герои сюжета на своих местах
let tradeOn = false, talkWith = null;
function freeSpot(x, z, y) {       // ближайшая точка, где можно стоять
  if (!blocked(x, z, y)) return [x, z];
  for (let r = 0.4; r < 6; r += 0.4) for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (!blocked(px, pz, y) && (y < 1 || onSlab(px, pz))) return [px, pz];
  }
  return [x, z];
}
function shopInit() {
  const f = frontOf(mine); const [x1, z1, x2, z2, nx, nz] = f;
  const L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  Object.assign(SHOP, { f, L, n: [nx, nz], u: [ux, uz], mid: [mx, mz], a: [x1, z1] });
  SHOP.cust = [mx + nx * 0.8, mz + nz * 0.8];
  SHOP.hero = [mx - nx * 1.15, mz - nz * 1.15];
  SHOP.front = freeSpot(mx + nx * 2.0, mz + nz * 2.0, H2);
  SHOP.yawOut = Math.atan2(-nx, -nz); SHOP.yawIn = Math.atan2(nx, nz);
  const cand = [];
  for (const [d, s] of [[2.0, 0], [3.2, 0], [1.6, 1.4], [1.6, -1.4], [2.8, 1.3], [2.8, -1.3], [4.4, 0]]) {
    const x = mx + nx * d + ux * s, z = mz + nz * d + uz * s;
    if (onSlab(x, z) && !blocked(x, z, H2)) cand.push([x, z]);
  }
  SHOP.queue = cand.slice(0, 3);
  // витрина на прилавке: товары по одному каждого вида
  SHOP.disp = new THREE.Group(); scene.add(SHOP.disp);
}
function refreshDisplay() {
  if (!SHOP.disp) return;
  while (SHOP.disp.children.length) SHOP.disp.remove(SHOP.disp.children[0]);
  const kinds = []; S.stock.forEach((l) => { if (l.q > 0 && l.cond !== 'C' && !kinds.includes(l.pid)) kinds.push(l.pid); });
  const [nx, nz] = SHOP.n, [ux, uz] = SHOP.u, [ax, az] = SHOP.a, t0 = 0.75, t1 = SHOP.L - 1.35;
  kinds.slice(0, 9).forEach((pid, i, arr) => {
    const t = arr.length === 1 ? (t0 + t1) / 2 : t0 + (t1 - t0) * i / (arr.length - 1);
    const m = itemMesh(pid); const big = PM[pid].size === 'l';
    m.position.set(ax + ux * t - nx * 0.45, H2 + 1.0 + (big ? 0.01 : 0.085), az + uz * t - nz * 0.45);
    m.rotation.y = SHOP.yawIn + Math.PI; if (!big) m.rotation.x = -0.35;
    SHOP.disp.add(m);
  });
}
// герои сюжета на своих местах в ТЦ
function frontSpot(r, out) { const f = frontOf(r); if (!f) return null; const [x1, z1, x2, z2, nx, nz] = f; return [(x1 + x2) / 2 + nx * out, (z1 + z2) / 2 + nz * out, Math.atan2(nx, nz)]; }
function nearestRoom(rooms, test) { let best = null, bd = 1e9; rooms.forEach((r) => { if (r === mine || !test(r) || !frontOf(r)) return; const d = Math.hypot(r.box.cx - mine.box.cx, r.box.cz - mine.box.cz); if (d < bd) { bd = d; best = r; } }); return best; }
function placeNPCs() {
  const [mx, mz] = SHOP.mid, [nx, nz] = SHOP.n, [ux, uz] = SHOP.u;
  const spots = {};
  { const [x, z] = freeSpot(mx + nx * 1.4 + ux * (SHOP.L / 2 + 1.0), mz + nz * 1.4 + uz * (SHOP.L / 2 + 1.0), H2); spots.misha = [x, z, H2, SHOP.yawIn + 0.6]; }
  { let d = 2; while (d < 14 && !blocked(mx + nx * d, mz + nz * d, H2)) d += 0.25; const [x, z] = freeSpot(mx + nx * Math.max(2.5, d - 0.8), mz + nz * Math.max(2.5, d - 0.8), H2); spots.artur = [x, z, H2, SHOP.yawOut]; }
  const r2 = M.floor2.rooms;
  { const r = nearestRoom(r2, (x) => x.sector === 'D' && x.kind !== 'tech' && !x.brand); const s = r && frontSpot(r, 0.75); if (s) { const [x, z] = freeSpot(s[0], s[1], H2); spots.ashot = [x, z, H2, s[2] + Math.PI]; spots.ashot.room = r; } }
  { const r = nearestRoom(r2, (x) => x.sector === 'C' && x.kind !== 'tech' && !x.brand); const s = r && frontSpot(r, 0.75); if (s) { const [x, z] = freeSpot(s[0], s[1], H2); spots.gosha = [x, z, H2, s[2] + Math.PI]; spots.gosha.room = r; } }
  { const d = M.doors.find((q) => q.kind === 'service') || M.doors[0]; const [x, z] = freeSpot(d.pos[0] + 2, d.pos[1], 0); spots.kim = [x, z, 0, Math.PI / 2]; }
  { const ic = M.icons.find((q) => q.type === 'info'); const [x, z] = freeSpot(ic ? ic.pos[0] : 0, ic ? ic.pos[1] : 0, 0); spots.zoya = [x, z, 0, 0]; }
  { const d = pickMainDoor(); const [x, z] = freeSpot(d.pos[0] + d.dir[0] * 3.2 + d.dir[1] * 2, d.pos[1] + d.dir[1] * 3.2 - d.dir[0] * 2, 0); spots.valera = [x, z, 0, Math.atan2(d.dir[0], d.dir[1]) + Math.PI]; }
  const SIGNS = { kim: 'Ким Опт · склад', ashot: 'Запчасти у Ашота', gosha: 'Гоша · винтаж' };
  Object.entries(spots).forEach(([who, s]) => {
    const P = makePerson(CHARS[who].look); P.who = who; P.home = s;
    P.g.position.set(s[0], s[2], s[1]); P.yaw = s[3]; P.g.rotation.y = s[3];
    nameTag(P, CHARS[who].name, SIGNS[who] || CHARS[who].role);
    const mk = spriteSign(['!'], '#ffc23a', '#1d1f22', 0.5, { round: true }); mk.material.depthTest = false; mk.renderOrder = 21; mk.position.set(0, 2.75, 0); mk.visible = false; P.g.add(mk); P.mark = mk;
    scene.add(P.g); NPC[who] = P; PEOPLE.add(P);
  });
}
// кто сейчас на месте
function present(who) {
  if (!S) return false;
  switch (who) {
    case 'misha': return !S.scenes.ch2done || !!S.scenes.ch5done;
    case 'artur': return !!S.scenes.ch2done && S.flags.artur !== 'left';
    case 'ashot': return S.chapter >= 2;
    case 'gosha': return !!S.scenes.ch3done;
    default: return true;
  }
}
function pending(who) {   // есть, что сказать или предложить впервые
  if (!S) return false;
  switch (who) {
    case 'misha': return !S.scenes.intro;
    case 'kim': return !!S.scenes.intro && !S.scenes.kimHello;
    case 'ashot': return !S.scenes.ashotHello;
    case 'gosha': return !S.scenes.goshaHello;
    case 'artur': return S.chapter === 3 && !S.scenes.arturDeal && S.day > (S.chDay || 0);
    default: return false;
  }
}

/* ---------- разговоры ---------- */
const temps = [];
function heroPos() { return [player.x, player.z]; }
async function castChar(who) {
  const P0 = NPC[who];
  if (P0 && P0.g.visible && present(who) && Math.hypot(P0.g.position.x - player.x, P0.g.position.z - player.z) < 9 && Math.abs(P0.g.position.y - player.y) < 1) return P0;
  const cq = DAY.q.find((q) => q.story === who && q.P); if (cq) return cq.P;
  const old = temps.find((t) => t.who === who); if (old) return old;
  const P = makePerson(CHARS[who].look); P.who = who; P.temp = true;
  let x, z;
  if (tradeOn) { const used = temps.length + (DAY.q[0] && DAY.q[0].P ? 1 : 0); const s = used ? (SHOP.queue[used - 1] || SHOP.queue[0]) : SHOP.cust; [x, z] = s; }
  else {
    const fx = -Math.sin(AV.yaw), fz = -Math.cos(AV.yaw); [x, z] = [player.x + fx * 1.7, player.z + fz * 1.7];
    if (blocked(x, z, player.y)) { for (let k = 1; k < 8; k++) { const a = AV.yaw + k * Math.PI / 4; const px = player.x - Math.sin(a) * 1.7, pz = player.z - Math.cos(a) * 1.7; if (!blocked(px, pz, player.y)) { x = px; z = pz; break; } } }
  }
  P.g.position.set(x, player.y, z); faceTo(P, player.x, player.z);
  nameTag(P, CHARS[who].name, CHARS[who].role);
  scene.add(P.g); PEOPLE.add(P); temps.push(P);
  return P;
}
function dropTemps() { temps.splice(0).forEach((P) => { scene.remove(P.g); PEOPLE.delete(P); }); }
function talkCam(cam) {
  const P = talkWith; if (!P) return false;
  const ax = player.x, az = player.z, bx = P.g.position.x, bz = P.g.position.z, y = player.y;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2, dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz) || 1, px = -dz / d, pz = dx / d;
  let sx = px, sz = pz;
  if (blocked(mx + px * 2.2, mz + pz * 2.2, y) || hitsAt(mx + px * 1.2, mz + pz * 1.2, y)) { sx = -px; sz = -pz; }
  cam.position.set(mx + sx * 2.6 - dx / d * 0.9, y + 1.75, mz + sz * 2.6 - dz / d * 0.9);
  cam.lookAt(mx + dx / d * 0.3, y + 1.35, mz + dz / d * 0.3);
  return true;
}
// реплики: [кто, текст] и выбор {choice}; возвращает fx выбранного варианта
async function playScene(lines, vars) {
  talking(true); let fx = '';
  const camBefore = GAME.camHook;
  for (const ln of lines) {
    if (ln.choice) {
      const r = await ask(`<div class="nm"><b>Твой выбор</b></div>${ln.choice.map((c, i) => `<button class="gb ${i ? '' : 'go'}" data-a="ch" data-v="${i}">${esc(c.t)}</button>`).join('')}`, 'dlg');
      fx = ln.choice[+r.v].fx; continue;
    }
    const [who, text0] = ln, text = vars ? fill(text0, vars) : text0;
    const P = await castChar(who); talkWith = P;
    if (!tradeOn) { GAME.camHook = talkCam; faceTo(P, player.x, player.z); AV.yaw = Math.atan2(-(P.g.position.x - player.x), -(P.g.position.z - player.z)); }
    gest(P, 'talk');
    const C = CHARS[who];
    await ask(`<div data-a="next"><div class="nm"><i style="background:${C.look.topC}"></i><b>${esc(C.name)}</b><span>${esc(C.role)}</span></div><p>${esc(text)}</p><div class="nx">дальше ▸</div></div>`, 'dlg');
  }
  dlgEl.hidden = true; talkWith = null; GAME.camHook = camBefore; talking(false);
  dropTemps();
  return fx;
}
async function sceneOnce(key, vars) { if (S.scenes[key]) return ''; S.scenes[key] = 1; const fx = await playScene(SCENES[key], vars); save(); return fx; }

/* ---------- эффекты выборов ---------- */
async function applyFx(fx) {
  switch (fx) {
    case 'cartel': S.cartel = 1; S.flags.artur = 'cartel'; await playScene(SCENES.arturCartel); break;
    case 'honest': S.flags.artur = 'honest'; await playScene(SCENES.arturHonest); break;
    case 'repUp': addRep(4); note('Репутация растёт: люди такое запоминают', 'good'); break;
    case 'keepPhone': addStock('phone', 'B', 1, 0); addRep(-3); note('Телефон на складе. Совесть — не очень'); break;
    case 'kidPolice': addRep(-2); note('Сомов увёл мальчишку. На рынке шепчутся'); break;
    case 'arturGift': S.cash -= 4000; S.flags.artur = 'friend'; addRep(2); note('Артур растроган. Теперь вы друзья', 'good'); break;
    case 'rareTip': S.flags.rareTip = S.day + 1; note('Завтра бабушки понесут старину', 'gold'); break;
    case 'students': S.flags.students = S.day + 1; note('Завтра придёт поток студентов', 'gold'); break;
    case 'partsKit': S.cash -= 4000; ['screen', 'battery', 'port'].forEach((f) => { S.parts['s_' + f] = (S.parts['s_' + f] || 0) + 1; }); note('Набор запчастей у тебя', 'good'); break;
    default: break;
  }
  hud(); save();
}

/* ---------- кто рядом и что делать по кнопке ✋ ---------- */
function nearTarget() {
  if (!S || tradeOn || talkWith || mode !== 'walk') return null;
  const lvl = player.y > H2 - 0.9 ? 2 : 1;
  if (lvl === 2 && SHOP.front && Math.hypot(player.x - SHOP.front[0], player.z - SHOP.front[1]) < 2.8) return { kind: 'shop', text: '✋ Павильон G2-103' };
  let best = null, bd = 2.6;
  Object.values(NPC).forEach((P) => {
    if (!P.g.visible) return;
    const d = Math.hypot(P.g.position.x - player.x, P.g.position.z - player.z);
    if (d < bd && Math.abs(P.g.position.y - player.y) < 1) { bd = d; best = P; }
  });
  return best ? { kind: 'npc', P: best, text: '✋ Поговорить: ' + CHARS[best.who].name } : null;
}
let busyAct = false;
function onAction() {   // синхронно решает, наше ли это нажатие; сама сцена идёт дальше асинхронно
  if (!S || tradeOn || talkWith) return !!S && (tradeOn || !!talkWith);
  if (busyAct) return true;
  const t = nearTarget(); if (!t) return false;
  busyAct = true;
  (async () => { try { if (t.kind === 'shop') await shopMenu(); else await talkTo(t.P.who); } finally { busyAct = false; hud(); } })();
  return true;
}
async function talkTo(who) {
  avatarAct('wave');
  if (who === 'misha') {
    if (!S.scenes.intro) { await sceneOnce('intro'); note('Подойди к прилавку и нажми ✋, чтобы открыть павильон', 'gold'); return; }
    await playScene([['misha', pick(['Смотри на лицо покупателя. Улыбается — можно чуть поднажать.', 'Знатоку — факты, торопыге — «последний». Это Ким хорошо говорит.', 'Проверяй, что берёшь у людей: экран, батарея, серийник.', 'Аренду Зое Павловне — по воскресеньям. Она не любит ждать.'])]]);
    return;
  }
  if (who === 'kim') { if (!S.scenes.kimHello) await sceneOnce('kimHello'); return supplierMenu(false); }
  if (who === 'ashot') { if (!S.scenes.ashotHello) await sceneOnce('ashotHello'); return partsMenu(); }
  if (who === 'gosha') { if (!S.scenes.goshaHello) await sceneOnce('goshaHello'); return raresMenu(); }
  if (who === 'artur') {
    if (pending('artur')) { const fx = await sceneOnce('arturDeal'); await applyFx(fx); return; }
    await playScene([['artur', S.flags.artur === 'cartel' ? 'Партнёр! Цены держим, всё по плану.' : S.flags.artur === 'friend' ? 'Сосед! Заходи вечером, чай поставлю.' : pick(['Как торговля, сосед? У меня сегодня скидки, не обижайся.', 'Ну что, кто кого? Шучу. Почти.'])]]);
    return;
  }
  if (who === 'zoya') {
    if (S.debt > 0) {
      const r = await playScene([['zoya', `За вами долг ${rub(S.debt)}. Будем гасить?`], { choice: [{ t: `Погасить (−${rub(Math.min(S.debt, S.cash))})`, fx: 'pay' }, { t: 'Потом', fx: '' }] }]);
      if (r === 'pay') { const p = Math.min(S.debt, Math.max(0, S.cash)); S.cash -= p; S.debt -= p; note('Долг уменьшился', 'good'); }
      return;
    }
    await playScene([['zoya', `Аренда — каждое воскресенье, ${rub(rentNow())}. И чтобы у прилавка было чисто!`]]); return;
  }
  if (who === 'valera') { await playScene([['valera', S.up.guard ? 'Порядок, начальник! Воры обходят ваш павильон стороной.' : 'Здравия желаю. Если ворьё замучает — нанимайте, буду за вашим павильоном присматривать.']]); return; }
}

/* ---------- камера у прилавка: из глубины павильона, через плечо героя на покупателя ---------- */
function tradeCam(cam) {
  const [nx, nz] = SHOP.n, rx = -nz, rz = nx, [hx, hz] = SHOP.hero;
  cam.position.set(hx - nx * 1.45 + rx * 0.55, H2 + 1.95, hz - nz * 1.45 + rz * 0.55);
  const k = innerWidth > innerHeight * 1.3 ? 1.6 : 0.2;   // справа панель — покупатель левее центра
  cam.lookAt(SHOP.cust[0] + rx * k, H2 + 1.32, SHOP.cust[1] + rz * k);
  return true;
}
function heroToCounter() {
  Object.assign(player, { x: SHOP.hero[0], z: SHOP.hero[1], y: H2, vy: 0, yaw: SHOP.yawOut, pitch: 0 });
  AV.yaw = SHOP.yawOut; avatar.position.set(player.x, player.y, player.z);
}
function heroToFront() { Object.assign(player, { x: SHOP.front[0], z: SHOP.front[1], y: H2, vy: 0, yaw: SHOP.yawIn, pitch: 0.05 }); AV.yaw = SHOP.yawIn; }

/* ---------- кадр ---------- */
let promptFor = null;
function gameTick(dt) {
  PEOPLE.forEach((P) => {
    if (P.nav) moveNPC(P, dt);
    else if (P.who && !P.temp && !tradeOn) {      // стоят на месте, смотрят на героя, если он рядом
      const d = Math.hypot(P.g.position.x - player.x, P.g.position.z - player.z);
      const want = d < 5 ? Math.atan2(-(player.x - P.g.position.x), -(player.z - P.g.position.z)) : P.home ? P.home[3] : P.yaw;
      P.yaw += clamp(Math.atan2(Math.sin(want - P.yaw), Math.cos(want - P.yaw)), -3 * dt, 3 * dt); P.g.rotation.y = P.yaw;
    }
    if (P.home && !P.temp) {
      const d = Math.hypot(P.g.position.x - camera.position.x, P.g.position.z - camera.position.z);
      P.g.visible = present(P.who) && d < 48;
      if (P.mark) { P.mark.visible = P.g.visible && pending(P.who); if (P.mark.visible) { const k = clamp(d / 14, 1, 5); P.mark.scale.set(0.5 * k * 1.0, 0.5 * k, 1); P.mark.position.y = 2.75 + (k - 1) * 0.3; } }
      if (P.tag) P.tag.visible = P.g.visible && d < 14;
    }
    if (P.g.visible) animPerson(P, dt);
  });
  // подсказка «✋ …» рядом с павильоном и героями
  const t = nearTarget(); const txt = t ? t.text : null;
  if (txt !== promptFor) { promptFor = txt; promptEl.textContent = txt || ''; promptEl.hidden = !txt; }
  if (CHASE.on) chaseTick(dt);
}
/* =====================================================================
   ТОРГОВЫЙ ДЕНЬ: очередь, торг, касса, выкуп, ремонт, редкости, воры
   ===================================================================== */
const sexName = (type, fem) => (fem && TYPES[type] && TYPES[type].fem) || (TYPES[type] ? TYPES[type].name : 'Покупатель');
function mkCustomer(kind, type, extra) {
  const T = TYPES[type] || TYPES.office; const look = (extra && extra.look) || rollLook(type);
  const c = Object.assign({ kind, type, look, name: sexName(type, look.fem), mood: rnd(0.55, 0.75), pat: (T.pat || 4) + (S.up.coffee ? 1 : 0) + (S.cols.analog ? 1 : 0),
    hag: T.hag === undefined ? 0.5 : T.hag, wtpK: rnd(...(T.wtp || [0.9, 1.1])), pay: chance(T.card === undefined ? 0.5 : T.card) ? 'card' : 'cash', fake: false, used: {} }, extra || {});
  c.patMax = c.pat; c.trait = c.trait || pick(TYPE_TRAITS[type] || Object.keys(TRAITS)); c.heat = 40 + (c.mood - 0.6) * 40;
  return c;
}
function pickType() {
  const mix = {}; Object.keys(S.ads).forEach((id) => { const a = ADS.find((x) => x.id === id); if (a && a.mix) Object.entries(a.mix).forEach(([k, v]) => { mix[k] = (mix[k] || 1) * v; }); });
  if (S.flags.students === S.day) mix.student = 4;
  const types = Object.keys(TYPES).filter((t) => TYPES[t].w > 0 && (t !== 'reseller' || S.chapter >= 2));
  return wpick(types, (t) => TYPES[t].w * (mix[t] || 1));
}
function pickWant(type) {
  const av = avail();
  const p = wpick(av, (p) => (p.tags.includes(type) ? 3 : 0.6) * (S.news && S.news.hot === p.id ? 2.5 : 1) * (S.news && S.news.cold === p.id ? 0.6 : 1) * (p.size === 's' ? 1.3 : 1)) || pick(av);
  return p.id;
}
function rollDevice(type) {
  const p = pick(avail().filter((x) => x.rep));
  const cond = wpick(['A', 'B', 'C'], (c) => ({ A: 0.3, B: 0.4, C: 0.3 })[c]);
  const d = { pid: p.id, cond };
  if (cond === 'C') { d.fault = pick(devFaults(p.id)); d.sym = devSym(p.id, d.fault); }
  const liar = type === 'reseller' || (type === 'student' && chance(0.3));
  d.claim = liar ? (cond === 'A' ? 'new' : 'A') : cond;
  d.stolen = type === 'reseller' && chance(0.35);
  return d;
}
function planDay() {
  const list = [], n = traffic();
  for (let i = 0; i < n; i++) {
    const r = Math.random(); let kind = 'buy';
    if (S.day >= 2 && r < 0.12) kind = 'browse';
    else if (S.chapter >= 2 && r < 0.27) kind = 'sell';
    else if (S.chapter >= 2 && S.scenes.ch2start && r < 0.37) kind = 'repair';
    let type = pickType();
    if (kind === 'sell' && !['granny', 'grandpa', 'student', 'office', 'reseller', 'gamer'].includes(type)) type = pick(['student', 'reseller', 'office']);
    if (kind === 'repair' && type === 'reseller') type = 'office';
    if (S.day >= 3 && kind === 'buy' && chance(0.07)) { const f = mkCustomer('buy', 'fraud', { fake: true }); f.pay = 'cash'; f.want = pickWant('office'); list.push(f); continue; }
    const c = mkCustomer(kind === 'browse' ? 'buy' : kind, type);
    if (kind === 'buy') c.want = pickWant(type);
    if (kind === 'browse') c.browse = true;
    if (kind === 'sell') c.device = rollDevice(type);
    if (kind === 'repair') { const p = pick(avail().filter((x) => x.rep)); const f = pick(devFaults(p.id)); c.device = { pid: p.id, fault: f, sym: devSym(p.id, f) }; }
    list.push(c);
  }
  if (S.day === 1) { list.length = 0; ['charger', 'phone', 'case', 'powerbank', 'buds'].forEach((w, i) => { const c = mkCustomer('buy', i === 0 ? 'student' : pickType()); c.want = w; c.pay = i === 1 ? 'card' : i === 0 ? 'cash' : c.pay; list.push(c); }); }
  const rareK = S.flags.rareTip === S.day ? 2 : 1;
  if (S.day >= 3 && chance(Math.min(0.9, (S.chapter >= 4 ? 0.45 : 0.16) * rareK))) {
    const g = mkCustomer('rare', chance(0.5) ? 'granny' : 'grandpa'); g.rare = wpick(RARES, (x) => (S.rares[x.id] ? 0.4 : 1) / x.stars).id;
    list.splice(rndi(1, list.length), 0, g);
  }
  S.jobs.filter((j) => j.due <= S.day).forEach((j) => list.splice(rndi(0, list.length), 0, mkCustomer('pickup', j.type || 'office', { look: j.look, name: j.name, job: j.id })));
  S.returnsDue.filter((r) => r.day <= S.day).forEach((r) => list.splice(rndi(0, list.length), 0, mkCustomer('return', r.type || 'office', { look: r.look, ret: r })));
  S.returnsDue = S.returnsDue.filter((r) => r.day > S.day);
  if (S.day === 3 && !S.scenes.lizaFirst) list.splice(1, 0, mkCustomer('buy', 'student', { story: 'liza', look: CHARS.liza.look, name: 'Лиза', want: 'case', trait: 'chat' }));
  // вор: после второго дня, с камерой реже
  DAY.thiefAt = S.day >= 2 && chance(S.up.camera ? 0.3 : 0.5) ? rndi(1, Math.max(1, list.length - 1)) : -1;
  return list;
}

/* ---------- покупатели в 3D: по лестнице на второй этаж, в очередь, к прилавку ---------- */
const EXITS = () => links.map((L, i) => ({ L, i, d: fieldAt(fieldTo('shop', [SHOP.cust]), L.b[0], L.b[1]) })).filter((e) => e.d < 1e8).sort((a, b) => a.d - b.d);
function spotOf(i) { return i === 0 ? SHOP.cust : SHOP.queue[Math.min(i - 1, SHOP.queue.length - 1)]; }
function spawnPerson(c) {
  const P = makePerson(c.look); c.P = P; PEOPLE.add(P); scene.add(P.g);
  const ex = EXITS(); const e = wpick(ex.slice(0, 4), (x) => 1 / (1 + x.d / 10)) || ex[0];
  c.inMall = (async () => { await go(P, { kind: 'stairs', L: e.L, up: true, speed: e.L.kind === 'escalator' ? 0.7 : 1.3 }); })();
  P.g.position.set(e.L.a[0], 0, e.L.a[1]);
  return P;
}
function assign(c, idx) {
  c.slot = idx; const gen = c.gen = (c.gen || 0) + 1;
  c.walk = (async () => {
    await c.inMall; if (gen !== c.gen) return;
    await go(c.P, { kind: 'field', f: fieldTo('shop', [SHOP.cust]), goal: spotOf(idx), y: H2, k: () => (DAY.q[0] && DAY.q[0].ready ? 1 : 2.4) });
    if (gen !== c.gen) return;
    faceTo(c.P, SHOP.hero[0], SHOP.hero[1]);
    if (idx === 0) c.ready = true;
  })();
}
function leaveMall(c) {
  const P = c.P; if (!P) return;
  bubble(P, null);
  const ex = EXITS(); const e = pick(ex.slice(0, 4)) || ex[0];
  (async () => {
    await go(P, { kind: 'field', f: fieldTo('L' + e.i, [e.L.b]), goal: freeSpot(e.L.b[0] + e.L.dx * 0.6, e.L.b[1] + e.L.dz * 0.6, H2), y: H2, speed: 1.5 });
    await go(P, { kind: 'stairs', L: e.L, up: false, speed: e.L.kind === 'escalator' ? 0.7 : 1.3 });
    scene.remove(P.g); PEOPLE.delete(P);
  })();
}

/* ---------- панель торга ---------- */
let CUR = null;   // { c, lines: [[me?, text]] }
function patDots(c) { let h = ''; for (let i = 0; i < c.patMax; i++) h += `<i class="${i < c.pat ? '' : 'off'}"></i>`; return `<div class="gpat" title="Терпение">${h}</div>`; }
function head(c) { return `<div class="gwho"><b>${esc(c.name)}</b>${c.story ? '' : `<span class="tr">${TRAITS[c.trait].name}</span>`}${patDots(c)}</div>`; }
function convo() { return (CUR.lines || []).slice(-2).map(([me, t]) => `<div class="gsay ${me ? 'me' : ''}">${esc(t)}</div>`).join(''); }
function render(action) { return head(CUR.c) + convo() + (action || ''); }
let showOnly = null;
function show(action) { CUR.action = action || ''; panelEl.innerHTML = render(CUR.action); panelEl.hidden = false; }
async function act(action) { CUR.action = action; return ask(render(action)); }
async function cSay(c, text, mood) {
  const t = Array.isArray(text) ? text.join(' ') : text;
  CUR.lines.push([false, t]); show(''); gest(c.P, mood < 0 ? 'shake' : mood > 0 ? 'nod' : 'talk');
  if (mood > 0) bubble(c.P, '✓', 'green'); else if (mood < 0) bubble(c.P, '!', 'red');
  await wait(Math.min(1.6, 0.55 + t.length * 0.018));
}
async function meSay(t) { CUR.lines.push([true, t]); show(''); await wait(Math.min(1.2, 0.4 + t.length * 0.012)); }
function setMood(c, d) { c.mood = clamp(c.mood + d, 0, 1); }
function addPat(c, d) { c.pat = Math.max(0, c.pat + d); }

/* ---------- склад: единица товара ---------- */
function groups() {   // товар на продажу: по виду и состоянию
  const m = new Map();
  S.stock.forEach((l) => { if (l.q <= 0 || l.cond === 'C') return; const k = l.pid + '|' + l.cond; const g = m.get(k) || { pid: l.pid, cond: l.cond, q: 0, lots: [] }; g.q += l.q; g.lots.push(l); m.set(k, g); });
  return [...m.values()].sort((a, b) => PM[a.pid].lv - PM[b.pid].lv || a.pid.localeCompare(b.pid));
}
function takeUnit(pid, cond) {
  const lot = S.stock.find((l) => l.pid === pid && l.cond === cond && l.q > 0); if (!lot) return null;
  lot.q--; const u = { pid, cond, cost: lot.cost, def: lot.def, stolen: lot.stolen, fault: lot.fault };
  if (lot.q <= 0) S.stock.splice(S.stock.indexOf(lot), 1);
  return u;
}
function putBack(u) { addStock(u.pid, u.cond, 1, u.cost, u.def || u.stolen || u.fault ? { def: u.def, stolen: u.stolen, fault: u.fault } : null); }
let dealItem = null;
function showItem(pid, toHand) {
  hideItem(); dealItem = itemMesh(pid);
  const [nx, nz] = SHOP.n, [mx, mz] = SHOP.mid;
  dealItem.position.set(mx - nx * 0.3, H2 + 1.06, mz - nz * 0.3); dealItem.rotation.y = SHOP.yawIn;
  scene.add(dealItem);
  if (toHand && toHand.P) { scene.remove(dealItem); dealItem.position.set(0, -0.1, -0.03); dealItem.rotation.set(-1.2, 0, 0); toHand.P.J.wrR.add(dealItem); toHand.P.carry = dealItem; dealItem = null; }
}
function hideItem() { if (dealItem) { dealItem.parent && dealItem.parent.remove(dealItem); dealItem = null; } }

/* ---------- покупка ---------- */
async function doBuy(c) {
  let browse = !!c.browse; const T = TYPES[c.type] || TYPES.office; const p = c.want ? PM[c.want] : null; if (!p) browse = true;
  bubble(c.P, browse ? '?' : '₽', browse ? 'blue' : 'mustard');
  if (c.story === 'liza') { await sceneOnce('lizaFirst'); }
  if (browse) { c.interest = avail().filter((x) => x.tags.includes(c.type)).map((x) => x.id); if (!c.interest.length) c.interest = [pick(avail()).id]; await cSay(c, [pick(L.hello), pick(L.browse)]); }
  else await cSay(c, [pick(L.hello), pick(REQ(p)), pick(TAILS[c.type] || TAILS.office)]);
  let unit = null, misses = 0;
  while (!unit) {
    const gs = groups();
    const r = await act(`<div class="muted">Что показать? Продавец подаст с полки.</div>${gs.map((g) => `<button class="gb gitem" data-a="item" data-v="${g.pid}|${g.cond}"><span>${PM[g.pid].name}${g.cond !== 'new' ? ' · ' + COND[g.cond].name.toLowerCase() : ''}</span><span class="p">${rub(tagPrice(g.pid, g.cond))}</span><span class="q">${g.q} шт</span></button>`).join('')}<button class="gb" data-a="none">Нет такого товара</button>`);
    if (r.a === 'none') { if (!browse) addRep(-0.5); await cSay(c, pick(L.noStock), -1); return 'ok'; }
    const [pid, cond] = r.v.split('|'); const u = takeUnit(pid, cond); if (!u) continue;
    refreshDisplay(); showItem(pid); avatarAct('point'); await meSay('Сейчас покажу…'); gest(c.P, 'inspect');
    const okType = browse ? c.interest.includes(u.pid) : u.pid === c.want;
    const usedOk = u.cond === 'new' || chance((T.used || 0.3) * (u.cond === 'A' || u.cond === 'R' ? 1.2 : 0.7)) || c.type === 'reseller';
    if (!okType) { misses++; await cSay(c, browse ? pick(L.browseMiss) : pick(L.shownWrong), -1); setMood(c, -0.08); addPat(c, -1); putBack(u); hideItem(); refreshDisplay(); if (browse && misses === 1) await cSay(c, pick(L.hint[c.type] || L.hint.office)); }
    else if (!usedOk) { await cSay(c, pick(L.shownUsedNo), -1); setMood(c, -0.05); addPat(c, -1); putBack(u); hideItem(); refreshDisplay(); }
    else { unit = u; if (browse) { stat('browseHit'); await cSay(c, pick(L.browseHit), 1); setMood(c, 0.12); c.wtpK *= 0.97; } else { await cSay(c, pick(L.shownOk) + ' ' + pick(L.askPrice), 1); setMood(c, 0.04); } }
    if (!unit && c.pat <= 0) { await cSay(c, pick(L.leaveAngry), -1); addRep(-1); TODAY.lost++; return 'angry'; }
  }
  const price = await haggle(c, unit);
  if (price === null) { putBack(unit); hideItem(); refreshDisplay(); addRep(-2); TODAY.lost++; TODAY.angry++; stat('angry'); return 'angry'; }
  const items = [{ u: unit, price }];
  const xs = await crossSell(c, unit); if (xs) items.push(xs);
  const total = items.reduce((a, x) => a + x.price, 0);
  const paid = await checkout(c, total);
  if (!paid) { items.forEach((x) => putBack(x.u)); hideItem(); refreshDisplay(); TODAY.lost++; return c.ranAway ? 'run' : 'angry'; }
  showItem(unit.pid, c); gest(c.P, 'pay');
  let profit = 0;
  items.forEach((x) => {
    const pr = x.price - x.u.cost; profit += pr;
    TODAY.revenue += x.price; TODAY.cogs += x.u.cost; TODAY.sold++; stat('sold'); stat('revenue', x.price);
    if (x.u.cond === 'R') stat('refurbSold');
    if (x.price > marketPrice(x.u.pid) * COND[x.u.cond].k * 1.001) stat('overMarket');
    if (x.u.def && chance(0.75)) S.returnsDue.push({ pid: x.u.pid, price: x.price, day: S.day + rndi(1, 3), type: c.type, look: c.look });
    if (x.u.stolen) S.stolenDue.push({ pid: x.u.pid, day: S.day + rndi(1, 2), sold: true });
    if (!TODAY.best || pr > TODAY.best.profit) TODAY.best = { pid: x.u.pid, profit: pr };
  });
  if (c.gift || c.warranty) { const ex = (c.gift || 0) + Math.round(total * (c.warranty || 0)); S.cash -= ex; TODAY.cogs += ex; profit -= ex; }
  stat('profit', profit);
  addXP(5 + clamp(Math.floor(Math.max(0, profit) / 1500), 0, 25) + (items.length > 1 ? 4 : 0));
  banner((profit >= 0 ? 'ПРОДАНО! +' : 'В МИНУС… ') + rub(Math.abs(profit)), profit >= 0 ? '#ffd34d' : '#ff7a6a');
  if (c.mood > 0.68) { addRep(2); TODAY.happy++; stat('happy'); await cSay(c, pick(L.thanks), 1); gest(c.P, 'happy'); avatarAct('wave'); return 'happy'; }
  if (c.mood > 0.35) { addRep(0.5); await cSay(c, pick(L.thanks)); return 'ok'; }
  addRep(-1); await cSay(c, pick(L.thanksMeh), -1); return 'ok';
}

/* ---------- торг: разогрев тактиками и шкала цены с реакцией по лицу ---------- */
const heatK = (h) => 0.84 + 0.36 * clamp(h, 0, 100) / 100;
const heatNeed = (k) => (k - 0.84) / 0.36 * 100;
async function pitch(c, u, tag, W0) {
  while (true) {
    const need = heatNeed(tag / W0); if (c.heat >= need) return 'tag';
    const tacs = TACTICS.filter((t) => t.lv <= S.level), can = c.pat > 1, tr = TRAITS[c.trait];
    const r = await act(`<div class="muted">Характер: <b style="color:#ffd34d">${tr.name}</b> — ${tr.hint}. Разогрей интерес до отметки — купит по ценнику.</div>
      <div class="gheat"><i style="width:${clamp(c.heat, 0, 100)}%"></i><b style="left:${clamp(need, 0, 100)}%"></b></div>
      <div class="ggrid">${tacs.map((t) => `<button class="gb" data-a="tac" data-v="${t.id}" ${c.used[t.id] || !can ? 'disabled' : ''}>${t.name}<small>${c.used[t.id] ? 'уже было' : t.d}</small></button>`).join('')}</div>
      ${can ? '' : '<div class="muted">Терпение на исходе — пора называть цену.</div>'}
      <button class="gb go" data-a="price">К цене · ценник ${krub(tag)}</button>`);
    if (r.a !== 'tac') return 'price';
    const T = TACTICS.find((x) => x.id === r.v); if (!T || c.used[T.id] || c.pat <= 1) continue;
    c.used[T.id] = 1; addPat(c, -1); avatarAct('point');
    await meSay(pick(T.say));
    let d = (T.fx[c.trait] !== undefined ? T.fx[c.trait] : T.base) + (T.rnd ? rnd(-T.rnd, T.rnd) : rnd(-3, 3));
    if (c.trait === 'rush') d -= 3;
    if (T.gift) c.gift = T.gift; if (T.cost) c.warranty = T.cost;
    c.heat = clamp(c.heat + d, 0, 100); setMood(c, d > 0 ? 0.04 : -0.07);
    if (d >= 14) { stat('tacticHit'); bubble(c.P, '♥', 'pink'); gest(c.P, 'happy'); }
    await cSay(c, pick(d >= 14 ? L2.tacGreat : d > 0 ? L2.tacOk : L2.tacBad), d >= 14 ? 1 : d > 0 ? 0 : -1);
  }
}
async function haggle(c, u) {
  const mp = marketPrice(u.pid) * COND[u.cond].k, W0 = wtpOf(c, u.pid, u.cond); let W = W0;
  const tag = tagPrice(u.pid, u.cond); let P = tag; c.offer = null; c.triedLow = false;
  await meSay(`На ценнике ${rub(tag)}.`);
  if (tag <= W * 0.9 || (tag <= W && chance(1 - c.hag * 0.8))) { setMood(c, tag <= mp * 0.97 ? 0.15 : 0.06); await cSay(c, pick(['Беру по ценнику!', 'Нормальная цена, беру.', 'О, недорого! Заверните.', 'Отлично, беру как есть.']), 1); return tag; }
  const pr = await pitch(c, u, tag, W0); W = W0 * heatK(c.heat);
  if (pr === 'tag') { setMood(c, 0.1); await cSay(c, pick(L2.tagWin), 1); stat('pitchWin'); return tag; }
  if (tag <= W * 1.1) {
    const ask0 = Math.max(nice(Math.min(tag * rnd(0.86, 0.95), W * rnd(0.86, 0.97))), Math.round(u.cost * 1.02)); c.offer = ask0;
    await cSay(c, pick(L.askDisc));
    const r = await act(`<div class="gtag"><span>Ценник ${rub(tag)} · просит</span><b>${rub(ask0)}</b></div><div class="grow"><button class="gb go" data-a="give">Скинуть до ${krub(ask0)}</button><button class="gb" data-a="firm">Цена твёрдая</button></div><button class="gb" data-a="self">Торговаться самому</button>`);
    if (r.a === 'give') { setMood(c, 0.1); await cSay(c, pick(L.acceptHappy), 1); return ask0; }
    if (r.a === 'firm') {
      await meSay('Цена окончательная, вещь того стоит.');
      if (tag <= W && chance(0.4 + c.mood * 0.45)) { setMood(c, -0.04); await cSay(c, pick(L.acceptOk)); return tag; }
      setMood(c, -0.15); addPat(c, -1);
      if (c.pat <= 0 || c.mood < 0.2) { await cSay(c, pick(L.leaveAngry), -1); return null; }
      await cSay(c, pick(L.counterUp), -1);
    }
  } else {
    c.offer = Math.max(nice(W * rnd(0.74, 0.86)), Math.round(u.cost * 0.95)); setMood(c, -0.08);
    await cSay(c, [pick(L.tooPricey), pick(L.counterTail)], -1); gest(c.P, 'cross');
  }
  // шкала: тянешь цену и смотришь на пузырёк над головой покупателя
  if (c.tell === undefined) { c.poker = ['reseller', 'bizlady', 'fraud', 'office'].includes(c.type); c.tell = rnd(c.poker ? 0.9 : 0.95, c.poker ? 1.12 : 1.06); }
  const stp = stepFor(mp), lo = Math.max(stp, Math.floor(Math.min(u.cost, mp) * 0.6 / stp) * stp), hi = Math.ceil(Math.max(tag, mp, W) * 1.45 / stp) * stp;
  const pct = (v) => clamp((v - lo) / (hi - lo) * 100, 0, 100).toFixed(1);
  let lastBand = '';
  const react = () => {
    const k = P / (W * c.tell); let band = k <= 0.9 ? 'love' : k <= 1.0 ? 'ok' : k <= (c.poker ? 1.2 : 1.12) ? 'hmm' : 'no'; if (c.poker && band === 'love') band = 'ok';
    if (band === lastBand) return; lastBand = band;
    const B = { love: ['♥', 'pink', 'happy'], ok: ['✓', 'green', 'nod'], hmm: ['?', 'mustard', 'think'], no: ['!', 'red', 'angry'] }[band];
    bubble(c.P, B[0], B[1]); gest(c.P, B[2]);
  };
  const paint = () => { const v = el('gV'), f = el('gF'); if (v) v.textContent = rub(P); if (f) { const d = P - u.cost; f.textContent = (d >= 0 ? '+' : '−') + fmt(Math.abs(d)) + ' ₽'; f.className = 'pr ' + (d >= 0 ? 'g' : 'r'); } };
  const ui = () => `<div class="gtag"><span>${PM[u.pid].name}${u.cond !== 'new' ? ' · ' + COND[u.cond].name.toLowerCase() : ''}</span><b id="gV">${rub(P)}</b><span id="gF" class="pr"></span></div>
    <div class="gslide"><button class="gb" data-a="dec" aria-label="Дешевле">−</button><input type="range" id="gR" min="${lo}" max="${hi}" step="${stp}" value="${P}" aria-label="Цена"><button class="gb" data-a="inc" aria-label="Дороже">+</button></div>
    <div class="gmarks"><i style="left:${pct(u.cost)}%">закупка</i><i style="left:${pct(mp)}%">рынок</i></div>
    <div class="muted">Над головой покупателя: ♥ дёшево, ✓ нормально, ? на грани, ! дорого.</div>
    <div class="grow">${c.offer ? `<button class="gb blue" data-a="take">Взять ${krub(c.offer)}</button>` : '<button class="gb" data-a="mk">По рынку</button>'}<button class="gb go" data-a="ask">Предложить</button></div>`;
  onInput = (e) => { if (e.target.id === 'gR') { P = +e.target.value; paint(); react(); } };
  while (true) {
    P = clamp(P, lo, hi); lastBand = '';
    const pr2 = act(ui()); paint(); react();
    const r = await pr2;
    if (r.a === 'inc') { P += stp; continue; }
    if (r.a === 'dec') { P = Math.max(stp, P - stp); continue; }
    if (r.a === 'mk') { P = nice(mp); continue; }
    if (r.a === 'take') { onInput = null; setMood(c, 0.06); await cSay(c, pick(L.acceptOk), 1); return c.offer; }
    if (r.a === 'ask') {
      onInput = null; await meSay(`${rub(P)}. Отличная вещь!`);
      if (c.offer && P <= c.offer) { setMood(c, 0.1); await cSay(c, pick(L.acceptHappy), 1); return P; }
      if (P <= W) {
        if (!c.triedLow && P > W * 0.88 && chance(c.hag * 0.75)) {
          c.triedLow = true; c.offer = Math.max(Math.min(P - stepFor(P), nice(P * rnd(0.86, 0.94))), Math.round(W * 0.7));
          await cSay(c, pick(L.counter) + ' ' + rub(c.offer) + '?', 0); gest(c.P, 'shrug'); onInput = (e) => { if (e.target.id === 'gR') { P = +e.target.value; paint(); react(); } }; continue;
        }
        const cheap = P <= mp * 0.97; setMood(c, cheap ? 0.2 : P <= W * 0.9 ? 0.1 : 0.02);
        await cSay(c, pick(cheap ? L.acceptHappy : L.acceptOk), 1); return P;
      }
      const over = (P - W) / W; setMood(c, -(0.09 + over * 1.1)); addPat(c, -1);
      if (c.mood <= 0.02 || c.pat <= 0) { await cSay(c, pick(over > 0.4 ? L.offended : L.leaveAngry), -1); return null; }
      const base = c.offer || Math.round(W * rnd(0.72, 0.86) * (1 - c.hag * 0.06));
      let next = nice(Math.min(W, base + (W - base) * rnd(0.3, 0.55))); if (c.offer && next <= c.offer) next = Math.min(nice(W), c.offer + stepFor(c.offer));
      c.offer = next;
      if (over > 0.35) { await cSay(c, pick(L.offended), -1); gest(c.P, 'cross'); }
      await cSay(c, pick(c.pat <= 1 ? L.counterUp : L.counter) + ' ' + rub(c.offer) + '?', c.mood < 0.4 ? -1 : 0);
      onInput = (e) => { if (e.target.id === 'gR') { P = +e.target.value; paint(); react(); } };
    }
  }
}
async function crossSell(c, u) {
  const P = PM[u.pid]; if (!P.cross.length || c.mood < 0.32) return null;
  const g = groups().filter((x) => P.cross.includes(x.pid) && x.cond === 'new'); if (!g.length) return null;
  const x = pick(g), xp = marketPrice(x.pid);
  const r = await act(`<div class="gtag"><span>Предложить ещё</span><b>${PM[x.pid].name}</b><span class="pr">${rub(xp)}</span></div><div class="grow"><button class="gb" data-a="no">Не надо</button><button class="gb go" data-a="yes">Предложить</button></div>`);
  if (r.a !== 'yes') return null;
  await meSay(`А к нему ${PM[x.pid].acc} за ${rub(xp)} — пригодится!`);
  if (chance(0.25 + c.mood * 0.6)) { const uu = takeUnit(x.pid, 'new'); if (!uu) return null; refreshDisplay(); stat('cross'); await cSay(c, pick(L.crossYes), 1); return { u: uu, price: xp }; }
  await cSay(c, pick(L.crossNo)); return null;
}
function billsFor(total) { const out = []; let left = total; for (const b of [5000, 2000, 1000, 500, 100, 50]) while (left >= b && out.length < 8) { out.push(b); left -= b; } if (left > 0) out.push(left >= 100 ? 500 : 100); return out; }
async function checkout(c, total) {
  if (c.pay === 'card' && !S.up.terminal) {
    if (chance(0.22)) { await cSay(c, pick(L.cardNoTerminalLeave), -1); note('Без терминала часть людей уходит. Купи его вечером в «Улучшениях»'); return false; }
    await cSay(c, pick(L.cardNoTerminal), -1); setMood(c, -0.1); c.pay = 'cash';
  }
  gest(c.P, 'pay');
  if (c.pay === 'card') { await act(`<div class="gtag"><span>К оплате</span><b>${rub(total)}</b></div><button class="gb blue" data-a="tap">Принять оплату на терминале</button>`); S.cash += total; note(`Оплата картой: +${rub(total)}`, 'good'); return true; }
  const bills = billsFor(total), sum = bills.reduce((a, b) => a + b, 0), fakeIdx = c.fake ? rndi(0, Math.min(5, bills.length) - 1) : -1;
  let uv = !!S.up.uv, checked = uv;
  while (true) {
    const verdict = !uv ? '<div class="muted">Купюры не проверены — посвети УФ-лампой</div>' : fakeIdx >= 0 ? '<div class="muted" style="color:#ff7a6a">✗ Найдена подделка! Верни её покупателю</div>' : '<div class="muted" style="color:#4ade80">✓ Все купюры настоящие</div>';
    const r = await act(`<div class="gtag"><span>К оплате ${rub(total)} · дали ${rub(sum)}</span><span class="pr">сдача ${rub(sum - total)}</span></div>
      <div>${bills.slice(0, 6).map((b, i) => `<span class="gbill ${uv ? 'uv' : ''} ${i === fakeIdx ? 'fake' : ''}">${fmt(b)} ₽${uv && i === fakeIdx ? ' ✗' : ''}</span>`).join('')}</div>${verdict}
      <div class="grow"><button class="gb" data-a="uv">${uv ? 'Убрать лампу' : 'Проверить УФ'}</button><button class="gb go" data-a="ok">Принять ${krub(total)}</button></div>
      <button class="gb ${checked && fakeIdx >= 0 ? 'red' : ''}" data-a="reject">${checked && fakeIdx >= 0 ? 'Вернуть фальшивку' : 'Не брать купюры'}</button>`);
    if (r.a === 'uv') { uv = !uv; if (uv) { checked = true; stat('uvChecks'); if (fakeIdx >= 0) { bubble(c.P, '!', 'red'); gest(c.P, 'shrug'); } } continue; }
    if (r.a === 'reject') {
      if (fakeIdx >= 0) { stat('fakesCaught'); addXP(8); if (chance(0.5)) { await cSay(c, pick(L.fakeCaught), -1); S.cash += total; return true; } await cSay(c, pick(L.fakeRun), -1); c.ranAway = true; return false; }
      await cSay(c, pick(L.realRefused), -1); setMood(c, -0.5); return false;
    }
    S.cash += total;
    if (fakeIdx >= 0) { const loss = bills[fakeIdx]; TODAY.fakeLoss += loss; S.pendingFake = (S.pendingFake || 0) + loss; }
    note(`+${rub(total)} в кассу`, 'good'); return true;
  }
}

/* ---------- выкуп у людей ---------- */
const CHECKS = {
  power: ['Включить', (d) => (d.fault === 'battery' ? ['warn', 'гаснет сам'] : d.cond === 'C' && d.fault === 'screen' ? ['bad', 'включается, экран в полосах'] : ['ok', 'включается'])],
  charge: ['На зарядку', (d) => (d.fault === 'port' ? ['bad', 'не заряжается'] : d.fault === 'battery' ? ['bad', 'заряд скачет'] : d.cond === 'B' ? ['warn', 'износ батареи 79%'] : ['ok', 'заряжается'])],
  screen: ['Экран', (d) => (d.fault === 'screen' ? ['bad', 'полосы'] : d.cond === 'B' ? ['warn', 'царапины'] : ['ok', 'целый'])],
  sound: ['Звук', (d) => (d.fault === 'speaker' ? ['bad', 'хрип и треск'] : ['ok', 'чистый'])],
  look: ['Осмотр', (d) => (d.cond === 'B' ? ['warn', 'потёртости'] : d.fault ? ['warn', 'следы ремонта'] : ['ok', 'без следов'])],
  imei: ['Серийник', (d) => (d.stolen ? ['bad', 'В РОЗЫСКЕ!'] : ['ok', 'чистый'])],
};
async function doSell(c) {
  const d = c.device, P = PM[d.pid]; bubble(c.P, '₽?', 'green');
  await cSay(c, [pick(L.hello), pick(L.sell[c.type] || L.sell.student), L.sellClaim[d.claim]]);
  showItem(d.pid); gest(c.P, 'pay');
  const mp = marketPrice(d.pid);
  c.min = Math.round(mp * COND[d.cond].k * (d.cond === 'C' ? rnd(0.6, 0.85) : rnd(0.42, 0.55)));
  c.ask = nice(mp * COND[d.claim === 'new' ? 'A' : d.claim].k * rnd(0.62, 0.74));
  const res = {};
  while (true) {
    const list = Object.entries(CHECKS).map(([k, [n]]) => { const r = res[k]; return `<button class="gb" data-a="chk" data-v="${k}" ${r ? 'disabled' : ''}>${n}${r ? `<small style="color:${r[0] === 'ok' ? '#4ade80' : r[0] === 'warn' ? '#ffd34d' : '#ff7a6a'}">${r[1]}</small>` : `<small>${k === 'imei' && !S.up.scanner ? '−1 терпения' : 'проверить'}</small>`}</button>`; }).join('');
    const r = await act(`<div class="gtag"><span>${P.name} · говорит «${COND[d.claim === 'new' ? 'A' : d.claim].name.toLowerCase()}»</span><span class="pr">хочет ${krub(c.ask)}</span></div>
      <div class="ggrid">${list}</div><div class="muted">Рынок: новый ${rub(mp)}. Проверь, потом назови цену.</div>
      <div class="grow"><button class="gb" data-a="no">Не надо</button><button class="gb go" data-a="offer">Назвать цену</button></div>`);
    if (r.a === 'no') { hideItem(); await cSay(c, pick(L.sellLeave)); return 'ok'; }
    if (r.a === 'chk') { const k = r.v; res[k] = CHECKS[k][1](d); if (k === 'imei' && !S.up.scanner) addPat(c, -1); if (res[k][0] === 'bad') bubble(c.P, '?', 'mustard'); if (k === 'imei' && d.stolen) { gest(c.P, 'shrug'); } continue; }
    break;
  }
  if (res.imei && d.stolen) {
    const r = await act(`<div class="muted" style="color:#ff7a6a">Серийник в розыске. Такое брать — до первой проверки Сомова.</div><div class="grow"><button class="gb red" data-a="no">Отказаться</button><button class="gb" data-a="yes">Всё равно взять</button></div>`);
    if (r.a === 'no') { hideItem(); await cSay(c, 'Э-э… да он чистый вообще-то. Ладно, пойду.', -1); addRep(1); return 'ok'; }
  }
  const stp = stepFor(c.ask), lo = stp, hi = Math.ceil(mp * 0.9 / stp) * stp; let P0 = nice(c.ask * 0.6), tries = 0;
  onInput = (e) => { if (e.target.id === 'gR') { P0 = +e.target.value; el('gV').textContent = rub(P0); } };
  while (true) {
    const r = await act(`<div class="gtag"><span>Твоя цена</span><b id="gV">${rub(P0)}</b><span class="pr">просит ${krub(c.ask)}</span></div>
      <div class="gslide"><button class="gb" data-a="dec">−</button><input type="range" id="gR" min="${lo}" max="${hi}" step="${stp}" value="${P0}"><button class="gb" data-a="inc">+</button></div>
      <div class="grow"><button class="gb" data-a="no">Передумал</button><button class="gb blue" data-a="take">Дать ${krub(c.ask)}</button><button class="gb go" data-a="ask">Предложить</button></div>`);
    if (r.a === 'inc') { P0 = Math.min(hi, P0 + stp); continue; } if (r.a === 'dec') { P0 = Math.max(lo, P0 - stp); continue; }
    if (r.a === 'no') { onInput = null; hideItem(); await cSay(c, pick(L.sellLeave)); return 'ok'; }
    const price = r.a === 'take' ? c.ask : P0; onInput = null;
    if (price >= c.min || r.a === 'take') {
      if (S.cash < price) { note('Не хватает денег в кассе', 'bad'); continue; }
      await cSay(c, pick(L.sellAccept), 1); S.cash -= price; TODAY.buyinSpent += price; stat('buyins');
      addStock(d.pid, d.cond, 1, price, d.fault || d.stolen ? { fault: d.fault, stolen: d.stolen } : null);
      if (d.stolen) S.stolenDue.push({ pid: d.pid, day: S.day + rndi(1, 2) });
      hideItem(); refreshDisplay(); addXP(6); checkChapter(); return 'ok';
    }
    tries++; addPat(c, -1);
    if (price < c.min * 0.5) { await cSay(c, pick(L.sellInsult), -1); gest(c.P, 'angry'); }
    if (c.pat <= 0 || tries >= 3) { hideItem(); await cSay(c, pick(L.sellLeave), -1); return 'angry'; }
    c.ask = Math.max(c.min, nice(c.ask - (c.ask - c.min) * rnd(0.3, 0.5))); await cSay(c, pick(L.sellCounter) + ' ' + rub(c.ask) + '?', 0);
    onInput = (e) => { if (e.target.id === 'gR') { P0 = +e.target.value; el('gV').textContent = rub(P0); } };
  }
}

/* ---------- ремонт, выдача, возврат, редкость ---------- */
const laborOf = (p) => (p.sz === 'l' ? 2600 : 1300);
async function doRepair(c) {
  const d = c.device, P = PM[d.pid]; bubble(c.P, '🔧', 'blue');
  await cSay(c, [pick(L.hello), pick(REPQ(P)), d.sym[0].toUpperCase() + d.sym.slice(1) + '.', pick(L.repairTail)]);
  showItem(d.pid);
  const part = PART_PRICE[szOf(d.pid)][d.fault] || 1000, base = part + laborOf(P);
  const opts = [nice(base * 0.85), nice(base * 1.15), nice(base * 1.6)];
  const r = await act(`<div class="muted">Готово будет завтра. Деталь стоит примерно ${rub(part)} у Ашота.</div>${opts.map((p, i) => `<button class="gb ${i === 1 ? 'go' : ''}" data-a="q" data-v="${p}">${rub(p)}<small>${['дёшево — точно согласится', 'нормально', 'дорого'][i]}</small></button>`).join('')}<button class="gb" data-a="no">Не возьмусь</button>`);
  hideItem();
  if (r.a === 'no') { await cSay(c, 'Жаль. Поищу другого мастера.'); return 'ok'; }
  const price = +r.v, k = price / base;
  if (chance(k <= 0.9 ? 0.97 : k <= 1.2 ? 0.8 : 0.4)) {
    await cSay(c, pick(L.repairAccept), 1);
    S.jobs.push({ id: newUid(), pid: d.pid, fault: d.fault, sym: d.sym, price, due: S.day + 1, ready: false, type: c.type, look: c.look, name: c.name });
    note('Заказ на ремонт принят. Вечером — в мастерскую', 'good'); return 'ok';
  }
  await cSay(c, pick(L.repairTooMuch), -1); return 'ok';
}
async function doPickup(c) {
  const j = S.jobs.find((x) => x.id === c.job); if (!j) return 'ok';
  bubble(c.P, '🔧', 'blue');
  if (j.ready) {
    await cSay(c, [pick(L.hello), `Я за ${PM[j.pid].acc}. Готово?`]); showItem(j.pid, c);
    S.cash += j.price; TODAY.revenue += j.price; stat('jobs'); stat('revenue', j.price); stat('profit', j.price); addRep(2); addXP(10);
    S.jobs.splice(S.jobs.indexOf(j), 1); banner('РЕМОНТ ОПЛАЧЕН +' + rub(j.price));
    await cSay(c, pick(L.pickupOk), 1); gest(c.P, 'happy'); checkChapter(); return 'happy';
  }
  await cSay(c, pick(L.pickupLate), -1); gest(c.P, 'angry'); addRep(-3);
  if (j.late) { S.jobs.splice(S.jobs.indexOf(j), 1); note('Заказ отменён — клиент забрал устройство', 'bad'); } else { j.late = 1; j.due = S.day + 1; }
  return 'angry';
}
async function doReturn(c) {
  const rt = c.ret; bubble(c.P, '!', 'red');
  await cSay(c, [pick(L.returnStart), pick(L.returnProblems), pick(L.returnEnd)], -1); showItem(rt.pid);
  const r = await act(`<div class="gtag"><span>Возврат: ${PM[rt.pid].name}</span><b>${rub(rt.price)}</b></div><div class="grow"><button class="gb go" data-a="yes">Вернуть деньги</button><button class="gb red" data-a="no">Отказать</button></div>`);
  hideItem();
  if (r.a === 'yes') { S.cash -= rt.price; TODAY.revenue -= rt.price; stat('refunds'); addRep(2); addStock(rt.pid, 'C', 1, 0, { fault: pick(devFaults(rt.pid)) }); await cSay(c, pick(L.returnOk), 1); return 'ok'; }
  addRep(-4); await cSay(c, pick(L.returnRefused), -1); return 'angry';
}
async function doRare(c) {
  const R = RM[c.rare]; bubble(c.P, '★', 'gold');
  await cSay(c, [pick(L.hello), pick(L.sell[c.type] || L.sell.granny)]); showItem(c.rare);
  const ask0 = nice(R.val * rnd(0.35, 0.55));
  const r = await act(`<div class="gtag"><span>${R.name}, ${R.year}</span><b>${rub(ask0)}</b></div><p>${esc(R.lore)}</p><div class="muted">Редкость ${'★'.repeat(R.stars)} · коллекционеры дают до ${rub(R.val)}</div>
    <div class="grow"><button class="gb go" data-a="buy">Взять за ${krub(ask0)}</button><button class="gb" data-a="low">Предложить ${krub(nice(ask0 * 0.7))}</button></div><button class="gb" data-a="no">Не нужно</button>`);
  hideItem();
  if (r.a === 'no') { await cSay(c, 'Ну, отнесу внуку тогда.'); return 'ok'; }
  const price = r.a === 'buy' ? ask0 : nice(ask0 * 0.7);
  if (r.a === 'low' && !chance(0.5)) { await cSay(c, 'Нет, сынок, это память. Дешевле не отдам.', -1); return 'ok'; }
  if (S.cash < price) { note('Не хватает денег', 'bad'); return 'ok'; }
  S.cash -= price; if (!S.rares[c.rare]) stat('raresFound'); S.rares[c.rare] = (S.rares[c.rare] || 0) + 1;
  await cSay(c, 'Вот и славно. Пусть у хорошего человека будет.', 1); note(`Редкость «${R.name}» у тебя. Гоша оценит!`, 'gold'); checkChapter(); return 'happy';
}

/* ---------- обслужить покупателя ---------- */
async function serve(c) {
  CUR = { c, lines: [] }; stat('customers');
  let how = 'ok';
  if (c.kind === 'buy') how = await doBuy(c);
  else if (c.kind === 'sell') how = await doSell(c);
  else if (c.kind === 'repair') how = await doRepair(c);
  else if (c.kind === 'pickup') how = await doPickup(c);
  else if (c.kind === 'return') how = await doReturn(c);
  else if (c.kind === 'rare') how = await doRare(c);
  if (how === 'angry') { bubble(c.P, '!', 'red'); gest(c.P, 'angry'); } else if (how === 'happy') bubble(c.P, '♥', 'pink'); else bubble(c.P, null);
  hideItem(); onInput = null; checkChapter(); save();
  await wait(0.5);
}
/* =====================================================================
   ДЕНЬ ЦЕЛИКОМ, ВОР И ПОГОНЯ, ВЕЧЕР, УТРО, ЗАПУСК
   ===================================================================== */
async function openDay() {
  if (!S.scenes.intro) { note('Сначала поговори с дядей Мишей — он рядом с павильоном', 'gold'); return; }
  closePanel(); note('Открываем павильон…'); await wait(0.05);
  navBuild(); fieldTo('shop', [SHOP.cust]);
  TODAY = newToday(); DAY.on = true; DAY.clock = 0; DAY.q = [];
  tradeOn = true; busy(true); GAME.lock = true; GAME.camHook = tradeCam;
  if (view !== 'tp') { view = 'tp'; applyView(); }
  if (beacon) beacon.visible = false;
  heroToCounter(); refreshDisplay();
  const list = planDay(); let idx = 0, served = 0; const n = list.length;
  banner('ОТКРЫТО! 10:00'); hud();
  const fill = () => { while (DAY.q.length < 1 + SHOP.queue.length && idx < list.length) { const c = list[idx++]; spawnPerson(c); DAY.q.push(c); assign(c, DAY.q.length - 1); } };
  fill();
  while (DAY.q.length) {
    const c = DAY.q[0];
    panelEl.innerHTML = '<div class="muted">Покупатель идёт к прилавку…</div>'; panelEl.hidden = false;
    await c.walk; if (!c.ready) { assign(c, 0); await c.walk; }
    await serve(c);
    served++; DAY.clock = Math.min(600, served / n * 600); hud();
    DAY.q.shift(); leaveMall(c);
    DAY.q.forEach((q, i) => assign(q, i));
    fill();
    if (DAY.thiefAt === served) { DAY.thiefAt = -1; await thief(); }
  }
  await endDay();
}

/* ---------- вор: хватает товар с прилавка и бежит к лестнице; догони! ---------- */
const CHASE = { on: false };
async function thief() {
  const pool = groups().filter((g) => PM[g.pid].size !== 'l'); if (!pool.length) return;
  const g = pick(pool);
  const c = mkCustomer('buy', 'thief'); const P = makePerson(c.look); c.P = P; PEOPLE.add(P); scene.add(P.g);
  const ex = EXITS(); const e0 = ex[Math.min(1, ex.length - 1)];
  P.g.position.set(e0.L.a[0], 0, e0.L.a[1]);
  closePanel(); panelEl.innerHTML = '<div class="muted">К прилавку кто-то идёт…</div>'; panelEl.hidden = false;
  await go(P, { kind: 'stairs', L: e0.L, up: true, speed: 2.2 });
  await go(P, { kind: 'field', f: fieldTo('shop', [SHOP.cust]), goal: SHOP.cust, y: H2, speed: 2.6 });
  faceTo(P, SHOP.hero[0], SHOP.hero[1]); gest(P, 'grab');
  const u = takeUnit(g.pid, g.cond); refreshDisplay(); if (u) showItem(u.pid, c);
  stat('thefts'); TODAY.thefts++;
  if (S.up.guard && chance(0.5)) {
    banner('ВАЛЕРА ПОЙМАЛ ВОРА!'); await wait(0.6); if (u) putBack(u); refreshDisplay(); stat('caught'); TODAY.caught++; addRep(2);
    gest(P, 'shrug'); await wait(1); leaveMall(c); return;
  }
  // беглец бежит к самой дальней из ближних лестниц; герой выбегает из-за прилавка
  const far = ex.slice(0, 5).sort((a, b) => b.d - a.d)[0];
  banner('ДЕРЖИ ВОРА!', '#ff7a6a');
  closePanel(); busy(false); tradeOn = false; GAME.camHook = null; GAME.lock = false;
  Object.assign(player, { x: SHOP.cust[0] - SHOP.n[0] * 0.1 + SHOP.u[0] * 0.9, z: SHOP.cust[1] - SHOP.n[1] * 0.1 + SHOP.u[1] * 0.9, y: H2, vy: 0 });
  player.yaw = SHOP.yawOut; AV.yaw = player.yaw;
  Object.assign(CHASE, { on: true, P, u, t: 0, max: S.up.camera ? 32 : 24, res: null });
  note('Догони его! Беги следом — левая половина экрана, кнопка «Бег»', 'gold');
  const run = go(P, { kind: 'field', f: fieldTo('L' + far.i, [far.L.b]), goal: freeSpot(far.L.b[0] + far.L.dx * 0.6, far.L.b[1] + far.L.dz * 0.6, H2), y: H2, speed: 4.4 });
  await Promise.race([run, new Promise((r) => { CHASE.done = r; })]);
  if (!CHASE.res) CHASE.res = 'gone';
  CHASE.on = false;
  if (CHASE.res === 'gone' && P.nav) await run;   // время вышло, а он ещё бежит — добежит до лестницы
  if (CHASE.res === 'caught') {
    P.nav = null; banner('ПОЙМАЛ!'); stat('caught'); TODAY.caught++; addRep(3); addXP(12); if (u) { putBack(u); if (P.carry) { P.carry.parent && P.carry.parent.remove(P.carry); P.carry = null; } }
    bubble(P, '!', 'red'); gest(P, 'shrug'); await wait(1.4); leaveMall(c);
  } else {
    banner('УШЁЛ…', '#ff7a6a'); addRep(-1); if (u) TODAY.cogs += u.cost;
    await go(P, { kind: 'stairs', L: far.L, up: false, speed: 2.4 }); scene.remove(P.g); PEOPLE.delete(P);
  }
  refreshDisplay(); checkChapter();
  await wait(0.6);
  tradeOn = true; busy(true); GAME.lock = true; GAME.camHook = tradeCam; heroToCounter(); save();
}
function chaseTick(dt) {
  CHASE.t += dt; const P = CHASE.P;
  const d = Math.hypot(P.g.position.x - player.x, P.g.position.z - player.z);
  if (d < 1.5 && Math.abs(P.g.position.y - player.y) < 1) { CHASE.res = 'caught'; CHASE.done(); }
  else if (CHASE.t > CHASE.max) { CHASE.res = 'gone'; CHASE.done(); }
}

/* ---------- вечер: итог, аренда, сюжет ---------- */
async function endDay() {
  DAY.on = false; DAY.clock = 600; tradeOn = false; GAME.lock = false; GAME.camHook = null; busy(false); closePanel();
  if (beacon) beacon.visible = true;
  banner('20:00 — ЗАКРЫТО'); avatarAct('wave');
  const T = TODAY;
  if (S.pendingFake) { S.cash -= S.pendingFake; S.pendingFake = 0; }
  stat('days');
  let rent = 0;
  if (S.day % 7 === 0) {
    rent = rentNow(); heroToFront();
    await playScene(SCENES.rent, { rent: rub(rent) });
    if (S.cash >= rent) S.cash -= rent; else { S.debt += Math.round((rent - Math.max(0, S.cash)) * 1.15); S.cash = Math.min(S.cash, 0); await playScene(SCENES.rentDebt); }
  }
  const profit = T.revenue - T.cogs - T.fakeLoss;
  heroToFront(); S.phase = 'evening'; save(); hud();
  await ask(`<h3>Итоги дня ${S.day}</h3>
    <p>Выручка: <b>${rub(T.revenue)}</b><br>Себестоимость: ${rub(T.cogs)}<br>Прибыль: <b style="color:${profit >= 0 ? '#4ade80' : '#ff7a6a'}">${rub(profit)}</b>${T.buyinSpent ? `<br>Выкуп у людей: −${rub(T.buyinSpent)}` : ''}${rent ? `<br>Аренда: −${rub(rent)}` : ''}${T.fakeLoss ? `<br>Фальшивки: −${rub(T.fakeLoss)}` : ''}</p>
    <p>Продано: ${T.sold} · довольных: ${T.happy} · ушли ни с чем: ${T.lost}${T.thefts ? ` · воры: ${T.thefts}, поймано ${T.caught}` : ''}</p>
    <p>Репутация: ${starsTxt(S.rep)} (${T.repD >= 0 ? '+' : ''}${T.repD.toFixed(1)})</p>
    <button class="gb go" data-a="ok">Дальше</button>`);
  closePanel();
  if (S.chReady) await finishChapter();
  note(S.chapter >= 2 ? 'Вечер: мастерская, закупка у Кима, улучшения — у павильона по ✋' : 'Вечер: закупись у Кима или ложись спать — у павильона по ✋', 'gold');
  save(); hud();
}
async function finishChapter() {
  const n = S.chapter, ch = CHAPTERS[n - 1]; if (!ch) return;
  heroToFront();
  await sceneOnce('ch' + n + 'done');
  S.cash += ch.reward; banner(`ГЛАВА ${n} ПРОЙДЕНА! +${krub(ch.reward)}`);
  S.chapter++; S.chSnap = snapStats(); S.chReady = false; S.chDay = S.day;
  const next = CHAPTERS[S.chapter - 1];
  if (next) { note(`Глава ${next.id} «${next.title}»: ${next.sub}`, 'gold'); if (SCENES['ch' + next.id + 'start']) await sceneOnce('ch' + next.id + 'start'); }
  else { await sceneOnce('end1'); note('Акт I пройден! Акты II–IV — следующим обновлением', 'gold'); }
  save(); hud();
}

/* ---------- утро: газета, сюжет, побочные истории ---------- */
async function sleep() {
  closePanel(); banner('НОЧЬ… УТРО!', '#9fc1e0');
  S.day++; S.phase = 'morning'; rollMarket(); S.ads = S.adsNext || {}; S.adsNext = {};
  if (S.debt > 0 && S.cash > S.debt * 1.2) { S.cash -= S.debt; S.debt = 0; note('Долг Зое Павловне погашен', 'good'); }
  save(); hud(); await wait(0.8);
  if (S.news) note('Газета рынка: ' + S.news.t + ' ' + S.news.t2);
  // краденое всплыло
  const due = S.stolenDue.filter((x) => x.day <= S.day);
  if (due.length) {
    S.stolenDue = S.stolenDue.filter((x) => x.day > S.day);
    const it = due[0], fine = rndi(5, 15) * 1000;
    const lot = S.stock.find((l) => l.stolen && l.pid === it.pid); if (lot) { lot.q--; if (lot.q <= 0) S.stock.splice(S.stock.indexOf(lot), 1); }
    await playScene(SCENES.police, { item: PM[it.pid].acc, fine: rub(fine) }); S.cash -= fine; addRep(-5);
  } else if (S.day % 9 === 0) await playScene(SCENES.policeOk);
  if (S.chapter >= 3 && S.day >= 6 && !S.scenes.lizaLaptop && S.scenes.lizaFirst) await sceneOnce('lizaLaptop');
  else if (chance(0.4)) {
    const sd = SIDE.filter((x) => !S.sideSeen[x.id] && x.c(S));
    if (sd.length) { const s = pick(sd); S.sideSeen[s.id] = 1; const fx = await playScene(s.lines); await applyFx(fx); }
  }
  note('Утро. Открой павильон: подойди к прилавку и нажми ✋', 'gold'); save(); hud();
}

/* ---------- меню павильона и лавки героев ---------- */
async function shopMenu() {
  while (true) {
    const ev = S.phase === 'evening', jobs = S.jobs.filter((j) => !j.ready).length, broken = S.stock.filter((l) => l.cond === 'C').reduce((a, l) => a + l.q, 0);
    const r = await ask(`<h3>Павильон G2-103</h3><p class="muted">День ${S.day}, ${ev ? 'вечер' : 'утро'} · касса ${rub(S.cash)} · на складе ${stockUnits()} шт</p>
      ${ev ? '' : '<button class="gb go" data-a="open">Открыть павильон<small>покупатели пойдут к прилавку</small></button>'}
      ${ev && S.chapter >= 2 ? `<button class="gb" data-a="work">Мастерская<small>заказы: ${jobs} · сломанное: ${broken}</small></button>` : ''}
      <button class="gb" data-a="stock">Склад<small>что есть и почём</small></button>
      ${S.scenes.kimHello ? '<button class="gb" data-a="call">Позвонить Киму<small>привезёт сам, +5% за доставку</small></button>' : '<p class="muted">Товар — у оптовика Кима, первый этаж, у служебного входа (!)</p>'}
      ${ev ? '<button class="gb" data-a="up">Улучшения</button><button class="gb" data-a="ads">Реклама на завтра</button>' : ''}
      ${ev ? '<button class="gb gold" data-a="sleep">Лечь спать → утро</button>' : ''}
      <button class="gb" data-a="close">Закрыть</button>`);
    if (r.a === 'close') { closePanel(); return; }
    if (r.a === 'open') return openDay();
    if (r.a === 'sleep') return sleep();
    if (r.a === 'work') await workshop();
    if (r.a === 'stock') await stockView();
    if (r.a === 'call') await supplierMenu(true);
    if (r.a === 'up') await upgradesMenu();
    if (r.a === 'ads') await adsMenu();
  }
}
async function stockView() {
  const rows = S.stock.slice().sort((a, b) => PM[a.pid].lv - PM[b.pid].lv).map((l) => `<div class="gitem"><span>${PM[l.pid].name} · ${COND[l.cond].name.toLowerCase()}</span><span class="p">${l.cond === 'C' ? 'в ремонт' : rub(tagPrice(l.pid, l.cond))}</span><span class="q">${l.q} шт</span></div>`).join('');
  const rares = Object.entries(S.rares).filter(([, n]) => n > 0).map(([id, n]) => `${RM[id].name}${n > 1 ? ' ×' + n : ''}`).join(', ');
  const parts = Object.entries(S.parts).filter(([, n]) => n > 0).map(([k, n]) => `${FAULTS[k.split('_')[1]].name.toLowerCase()} (${k[0] === 's' ? 'малый' : 'большой'}) ×${n}`).join(', ');
  await ask(`<h3>Склад · ${stockUnits()} / ${STOCK_CAP}</h3>${rows || '<p>Пусто. Закупись у Кима.</p>'}${rares ? `<p class="muted">Редкости: ${rares}</p>` : ''}${parts ? `<p class="muted">Запчасти: ${parts}</p>` : ''}<button class="gb" data-a="back">Назад</button>`);
}
async function supplierMenu(phone) {
  let tab = 'kim';
  while (true) {
    const k = SUP_K[tab] * (phone ? 1.05 : 1);
    const rows = avail().map((p) => { const u = Math.round(PM[p.id].cost * S.mk[p.id] * k); return `<div class="gitem"><span>${p.name}<small class="muted"> · продаётся ~${krub(marketPrice(p.id))}</small></span><span class="p">${rub(u)}</span></div><div class="grow"><button class="gb" data-a="buy" data-v="${p.id}|1" ${S.cash < u ? 'disabled' : ''}>+1</button><button class="gb" data-a="buy" data-v="${p.id}|5" ${S.cash < u * 5 * 0.95 ? 'disabled' : ''}>+5 · −5%</button></div>`; }).join('');
    const r = await ask(`<h3>${tab === 'kim' ? 'Ким Опт' : 'Склад «Ветерок»'}${phone ? ' · по телефону' : ''}</h3><p class="muted">${tab === 'kim' ? 'Новые товары, честные цены, без брака.' : 'На 20–30% дешевле, но каждый пятый — с сюрпризом.'} Касса ${rub(S.cash)} · склад ${stockUnits()}/${STOCK_CAP}</p>
      <div class="grow"><button class="gb ${tab === 'kim' ? 'gold' : ''}" data-a="tab" data-v="kim">Ким</button><button class="gb ${tab === 'grey' ? 'gold' : ''}" data-a="tab" data-v="grey">«Ветерок»</button></div>${rows}<button class="gb" data-a="back">Готово</button>`);
    if (r.a === 'back') { closePanel(); refreshDisplay(); return; }
    if (r.a === 'tab') { tab = r.v; continue; }
    const [pid, qs] = r.v.split('|'), q = +qs, unit = Math.round(PM[pid].cost * S.mk[pid] * k * (q >= 5 ? 0.95 : 1));
    if (stockUnits() + q > STOCK_CAP) { note('Склад полон', 'bad'); continue; }
    if (S.cash < unit * q) { note('Не хватает денег', 'bad'); continue; }
    S.cash -= unit * q;
    for (let i = 0; i < q; i++) { const def = tab === 'grey' && chance(0.2); addStock(pid, 'new', 1, unit, def ? { def: true } : null); }
    note(`+${q} ${PM[pid].name.toLowerCase()} на склад`, 'good'); hud(); save();
  }
}
async function partsMenu() {
  const faults = [...new Set(avail().filter((p) => p.rep).flatMap((p) => devFaults(p.id).map((f) => szOf(p.id) + '_' + f)))].sort();
  while (true) {
    const rows = faults.map((key) => { const [sz, f] = key.split('_'), pr = PART_PRICE[sz][f]; return `<button class="gb gitem" data-a="buy" data-v="${key}" ${S.cash < pr ? 'disabled' : ''}><span>${FAULTS[f].name} · ${sz === 's' ? 'малый' : 'большой'}</span><span class="p">${rub(pr)}</span><span class="q">есть ${S.parts[key] || 0}</span></button>`; }).join('');
    const r = await ask(`<h3>Запчасти у Ашота</h3><p class="muted">Малые — для телефонов, наушников, часов; большие — для планшетов, ноутбуков, приставок. Касса ${rub(S.cash)}</p>${rows}<button class="gb" data-a="back">Готово</button>`);
    if (r.a === 'back') { closePanel(); return; }
    const [sz, f] = r.v.split('_'); S.cash -= PART_PRICE[sz][f]; S.parts[r.v] = (S.parts[r.v] || 0) + 1; hud(); save();
  }
}
async function workshop() {
  while (true) {
    const jobs = S.jobs.filter((j) => !j.ready), broken = S.stock.filter((l) => l.cond === 'C' && l.q > 0);
    const items = jobs.map((j) => ({ k: 'j' + j.id, pid: j.pid, fault: j.fault, sym: j.sym, t: `Заказ: ${PM[j.pid].name}`, s: j.sym })).concat(broken.map((l) => ({ k: 's' + l.uid, pid: l.pid, fault: l.fault || (l.fault = pick(devFaults(l.pid))), sym: devSym(l.pid, l.fault), t: `Со склада: ${PM[l.pid].name}`, s: 'неисправен' })));
    const r = await ask(`<h3>Мастерская</h3><p class="muted">Найди поломку и поставь деталь от Ашота. Починенное со склада станет «восстановленным».</p>${items.map((it) => `<button class="gb" data-a="fix" data-v="${it.k}">${it.t}<small>${esc(it.s)}</small></button>`).join('') || '<p>Чинить нечего.</p>'}<button class="gb" data-a="back">Назад</button>`);
    if (r.a === 'back') return;
    const it = items.find((x) => x.k === r.v); if (!it) continue;
    const opts = devFaults(it.pid), tester = S.up.toolkit ? it.fault : null;
    let tries = 0;
    while (true) {
      const r2 = await ask(`<h3>${PM[it.pid].name}</h3><p>Жалоба: «${esc(it.sym)}».${tester ? ` <b style="color:#4ade80">Тестер: ${FAULTS[tester].name.toLowerCase()}.</b>` : ''}</p><p class="muted">Что менять?</p>
        ${opts.map((f) => { const key = szOf(it.pid) + '_' + f; return `<button class="gb gitem" data-a="part" data-v="${f}"><span>${FAULTS[f].name}</span><span class="q">деталей: ${S.parts[key] || 0}</span></button>`; }).join('')}<button class="gb" data-a="back">Назад</button>`);
      if (r2.a === 'back') break;
      const key = szOf(it.pid) + '_' + r2.v;
      if (r2.v !== it.fault) { tries++; note(tries > 1 ? 'Снова не то. Подумай, к чему жалоба' : 'Разобрал, проверил — дело не в этом', 'bad'); continue; }
      if (!S.parts[key]) { note(`Нужна деталь «${FAULTS[r2.v].name.toLowerCase()}» — купи у Ашота`, 'bad'); break; }
      S.parts[key]--; stat('repairs'); addXP(12);
      if (it.k[0] === 'j') { const j = S.jobs.find((x) => 'j' + x.id === it.k); if (j) j.ready = true; }
      else { const lot = S.stock.find((l) => 's' + l.uid === it.k); if (lot) { lot.q--; if (lot.q <= 0) S.stock.splice(S.stock.indexOf(lot), 1); addStock(it.pid, 'R', 1, lot.cost + PART_PRICE[szOf(it.pid)][it.fault]); } }
      banner('ПОЧИНЕНО!'); checkChapter(); save(); break;
    }
  }
}
async function raresMenu() {
  while (true) {
    const own = Object.entries(S.rares).filter(([, n]) => n > 0);
    const cols = COLLECTIONS.map((c) => { const have = c.items.filter((id) => S.rares[id] > 0).length, done = S.cols[c.id]; return `<div class="gitem"><span>${c.name}<small class="muted"> · ${c.bonus}</small></span><span class="q">${done ? 'собрана' : have + '/' + c.items.length}</span></div>${!done && have === c.items.length ? `<button class="gb gold" data-a="col" data-v="${c.id}">Собрать коллекцию · +${rub(c.reward)}</button>` : ''}`; }).join('');
    const r = await ask(`<h3>Гоша · коллекционер</h3><p class="muted">Продай вещь Гоше или собери коллекцию сам — она даёт бонус навсегда.</p>${cols}
      ${own.map(([id, n]) => `<button class="gb gitem" data-a="sell" data-v="${id}"><span>${RM[id].name} ×${n}</span><span class="p">${rub(nice(RM[id].val * 1.15))}</span><span class="q">продать</span></button>`).join('') || '<p>Редкостей пока нет. Бабушки иногда приносят старину к прилавку.</p>'}
      <button class="gb" data-a="back">Готово</button>`);
    if (r.a === 'back') { closePanel(); return; }
    if (r.a === 'sell') { const p = nice(RM[r.v].val * 1.15); S.rares[r.v]--; S.cash += p; stat('profit', p); note(`Гоша купил «${RM[r.v].name}»: +${rub(p)}`, 'good'); }
    if (r.a === 'col') { const c = COLLECTIONS.find((x) => x.id === r.v); S.cols[c.id] = 1; S.cash += c.reward; stat('colsDone'); banner('КОЛЛЕКЦИЯ СОБРАНА!'); checkChapter(); }
    hud(); save();
  }
}
async function upgradesMenu() {
  while (true) {
    const r = await ask(`<h3>Улучшения павильона</h3><p class="muted">Касса ${rub(S.cash)} · уровень ${S.level}</p>${UPGRADES.map((u) => `<button class="gb" data-a="buy" data-v="${u.id}" ${S.up[u.id] || S.cash < u.price || S.level < u.lv ? 'disabled' : ''}>${u.name} · ${S.up[u.id] ? 'есть' : S.level < u.lv ? 'с уровня ' + u.lv : rub(u.price)}<small>${u.desc}</small></button>`).join('')}<button class="gb" data-a="back">Назад</button>`);
    if (r.a === 'back') return;
    const u = UPGRADES.find((x) => x.id === r.v); S.cash -= u.price; S.up[u.id] = 1; banner(u.name.toUpperCase() + '!');
    if (u.id === 'guard') await sceneOnce('valera');
    checkChapter(); hud(); save();
  }
}
async function adsMenu() {
  while (true) {
    const r = await ask(`<h3>Реклама на завтра</h3>${ADS.map((a) => `<button class="gb" data-a="buy" data-v="${a.id}" ${S.adsNext[a.id] || S.cash < a.price || S.level < (a.lv || 1) ? 'disabled' : ''}>${a.name} · ${S.adsNext[a.id] ? 'заказано' : rub(a.price)}<small>${a.desc}</small></button>`).join('')}<button class="gb" data-a="back">Назад</button>`);
    if (r.a === 'back') return;
    const a = ADS.find((x) => x.id === r.v); S.cash -= a.price; S.adsNext[a.id] = 1; hud(); save();
  }
}
async function journal() {
  if (!S) {
    const r = await ask(`<h3>Рыночный король</h3><p>Сюжет и игра друга — теперь в Горбушке. Дядя Миша оставляет тебе павильон G2-103: торгуйся с покупателями, лови воров, чини технику, собирай редкости.</p><button class="gb go" data-a="new">Начать игру</button><button class="gb" data-a="close">Просто гулять</button>`);
    closePanel(); if (r.a === 'new') newGame(); return;
  }
  const ci = chapterInfo();
  const r = await ask(`<h3>${ci ? `Глава ${ci.ch.id}. ${ci.ch.title}` : 'Акт I пройден'}</h3>${ci ? `<p>${esc(ci.ch.sub)}</p>${ci.goals.map((g) => `<div class="gitem"><span>${g.v >= g.n ? '✓' : '○'} ${esc(g.t)}</span><span class="q">${g.money ? krub(g.v) + ' / ' + krub(g.n) : g.v + ' / ' + g.n}</span></div>`).join('')}<p class="muted">Награда: ${rub(ci.ch.reward)}</p>` : ''}
    <p class="muted">Касса ${rub(S.cash)} · капитал ${krub(worth())} · уровень ${S.level} (${S.xp}/${xpNeed(S.level)} опыта) · репутация ${starsTxt(S.rep)}${S.debt ? ' · долг ' + rub(S.debt) : ''}</p>
    <button class="gb" data-a="close">Закрыть</button><button class="gb red" data-a="reset">Начать заново</button>`);
  if (r.a === 'reset') { const r2 = await ask('<p>Стереть прогресс и начать с первой главы?</p><div class="grow"><button class="gb red" data-a="yes">Да, заново</button><button class="gb" data-a="no">Нет</button></div>'); if (r2.a === 'yes') { closePanel(); newGame(); return; } }
  closePanel();
}
function newGame() {
  S = freshState(); startStock(); rollMarket(true); S.chSnap = snapStats(); save(); hud();
  if (SHOP.disp) refreshDisplay();
  note('Твой павильон — G2-103 на втором этаже. Кнопка ★ ведёт туда, там ждёт дядя Миша', 'gold');
}

/* ---------- запуск и связь с 3D-страницей ---------- */
function mini(ctx, tx, tz, lvl) {
  if (!S) return;
  Object.values(NPC).forEach((P) => {
    if (!present(P.who)) return;
    const pl = P.g.position.y > 2 ? 2 : 1; if (pl !== lvl) return;
    const x = tx(P.g.position.x), z = tz(P.g.position.z), pend = pending(P.who);
    ctx.beginPath(); ctx.arc(x, z, pend ? 9 : 6, 0, 7); ctx.fillStyle = pend ? '#ffc23a' : '#ffffff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1d1f22'; ctx.stroke();
  });
}
function init() {
  if (!mine) return;
  uiInit(); shopInit(); placeNPCs();
  const btn = document.createElement('button'); btn.className = 'btn'; btn.id = 'bGame'; btn.type = 'button'; btn.title = 'Рыночный король'; btn.setAttribute('aria-label', 'Игра: сюжет и цели');
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>'; btn.onclick = () => { if (!tradeOn && !talkWith) journal(); };
  const tools = document.querySelector('.tools'); tools.insertBefore(btn, tools.firstChild);
  goalEl.onclick = () => { if (!tradeOn && !talkWith) journal(); };
  const st = document.createElement('style'); st.textContent = '.gbusy .tools .btn:not(#bFull), .gtalk .tools .btn:not(#bFull) { pointer-events: none; opacity: 0.35; }'; document.head.appendChild(st);
  S = load();
  if (S) { if (S.phase !== 'evening') S.phase = 'morning'; refreshDisplay(); hud(); note(`С возвращением! День ${S.day}. Павильон G2-103 ждёт`, 'gold'); }
  else journal();
}
Object.assign(GAME, { init, tick: gameTick, onAction, mini, lock: false, camHook: null,
  _: { get S() { return S; }, set S(v) { S = v; }, openDay, sleep, newGame, NPC, SHOP, NAV, DAY, CHASE, navBuild, fieldTo, PEOPLE, makePerson, doAction: onAction, shopMenu, journal, endDay } });
})();
