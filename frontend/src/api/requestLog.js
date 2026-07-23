// In-memory log of API calls made by this dashboard session, for the
// DeveloperPanel drawer. Deliberately not persisted across reloads — it's a
// live "what is this page actually doing" view, not an audit trail (that's
// the backend AuditLogEntry/Event tables, viewed elsewhere).
const MAX_ENTRIES = 100;
let entries = [];
let idCounter = 0;
const subscribers = new Set();

export function pushRequestLog(entry) {
  entries = [{ id: ++idCounter, ...entry }, ...entries].slice(0, MAX_ENTRIES);
  subscribers.forEach((cb) => cb(entries));
}

export function getRequestLog() {
  return entries;
}

export function subscribeRequestLog(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function clearRequestLog() {
  entries = [];
  subscribers.forEach((cb) => cb(entries));
}
