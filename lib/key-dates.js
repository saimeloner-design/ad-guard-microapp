// Fechas importantes para el comercio en Chile (docs/SPEC.md §4e). Funciones puras:
// calculan las próximas fechas y buscan en el historial de 18 meses una campaña
// que se haya hecho para la misma fecha el año anterior.

const DAY = 86_400_000;

/** n-ésimo domingo (o el día de la semana `weekday`, 0 = domingo) de un mes. */
function nthWeekday(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

const fixed = (month, day) => (year) => new Date(Date.UTC(year, month, day));

// Palabras que suelen aparecer en el nombre de una campaña hecha para esa fecha (sin tildes, en minúscula).
export const KEY_DATES = [
  { key: 'valentin', name: 'San Valentín', on: fixed(1, 14), words: ['valentin', 'enamorados'] },
  { key: 'madre', name: 'Día de la Madre', on: (y) => nthWeekday(y, 4, 0, 2), words: ['madre', 'mama'] },
  { key: 'padre', name: 'Día del Padre', on: (y) => nthWeekday(y, 5, 0, 3), words: ['padre', 'papa'] },
  { key: 'nino', name: 'Día del Niño', on: (y) => nthWeekday(y, 7, 0, 2), words: ['nino', 'ninos'] },
  { key: 'fiestas', name: 'Fiestas Patrias', on: fixed(8, 18), words: ['fiestas patrias', 'dieciocho', 'septiembre'] },
  { key: 'halloween', name: 'Halloween', on: fixed(9, 31), words: ['halloween'] },
  // El viernes después del cuarto jueves de noviembre.
  { key: 'black', name: 'Black Friday', on: (y) => new Date(nthWeekday(y, 10, 4, 4).getTime() + DAY), words: ['black friday', 'blackfriday'] },
  { key: 'navidad', name: 'Navidad', on: fixed(11, 25), words: ['navidad', 'navideno', 'christmas'] },
];

const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const startOfDay = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

/** Días antes de la fecha en que conviene tener la campaña creada: Meta necesita aprender antes de las ventas fuertes. */
export const LEAD_DAYS = 28;

/**
 * Próximas fechas dentro de `withinDays`, de la más cercana a la más lejana.
 * @param today fecha de hoy (Date local)
 * @param yearHistory campañas de los últimos 18 meses (lib/meta-ads.js, `context.yearHistory`)
 * @param types RESULT_TYPES de lib/alerts-meta.js
 * @returns {Array<{key, name, date, daysLeft, startBy, startByPassed, past}>} `date` y `startBy` en ISO (AAAA-MM-DD)
 */
export function upcomingDates(today, yearHistory = [], { types, money, withinDays = 120 } = {}) {
  const now = startOfDay(today);
  const year = today.getFullYear();
  const list = [];
  for (const d of KEY_DATES) {
    const next = [d.on(year), d.on(year + 1)].find((date) => date.getTime() >= now);
    const daysLeft = Math.round((next.getTime() - now) / DAY);
    if (daysLeft > withinDays) continue;
    const startBy = new Date(next.getTime() - LEAD_DAYS * DAY);

    // La que más resultados trajo entre las campañas con esa fecha en el nombre.
    const match = yearHistory
      .filter((h) => h.results > 0 && types[h.resultType]?.compare && d.words.some((w) => normalize(h.name ?? '').includes(w)))
      .sort((a, b) => b.results - a.results)[0];
    const type = match && types[match.resultType];
    list.push({
      key: d.key,
      name: d.name,
      date: next.toISOString().slice(0, 10),
      daysLeft,
      startBy: startBy.toISOString().slice(0, 10),
      startByPassed: startBy.getTime() < now,
      past: match
        ? {
            name: match.name,
            month: match.month,
            results: match.results,
            label: match.results === 1 ? type.one : type.label.toLowerCase(),
            costPerResult: money ? money(match.cost / match.results) : match.cost / match.results,
            unit: type.one,
          }
        : null,
    });
  }
  return list.sort((a, b) => a.daysLeft - b.daysLeft);
}
