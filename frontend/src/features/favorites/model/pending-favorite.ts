type PendingFavorite = { id: string; createdAt: number; userId?: string };

const STORAGE_KEY = 'moe-pravo:pending-favorite';
const MAX_AGE = 30 * 60 * 1000;
let cached: PendingFavorite | null | undefined;
let inFlight: { intent: PendingFavorite; promise: Promise<boolean> } | undefined;

function store(intent: PendingFavorite | null) {
  cached = intent;
  try {
    if (intent) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Keep the intent in memory if browser storage is unavailable.
  }
}

function read(): PendingFavorite | null {
  if (cached === undefined) {
    cached = null;
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      if (
        value &&
        typeof value === 'object' &&
        'id' in value &&
        typeof value.id === 'string' &&
        value.id.length > 0 &&
        'createdAt' in value &&
        typeof value.createdAt === 'number' &&
        (!('userId' in value) || typeof value.userId === 'string')
      )
        cached = value as PendingFavorite;
    } catch {
      // Ignore malformed or inaccessible storage.
    }
  }
  if (cached && !(Date.now() - cached.createdAt >= 0 && Date.now() - cached.createdAt < MAX_AGE))
    store(null);
  return cached;
}

/** Remember the guest's action through reloads and switching between login and registration. */
export function rememberPendingFavorite(id: string) {
  store({ id, createdAt: Date.now() });
}

/** Use an idempotent add, never a toggle. Failed requests remain bound to the same account. */
export function resumePendingFavorite(
  userId: string,
  add: (id: string) => Promise<void>,
): Promise<boolean> {
  const intent = read();
  if (!intent || (intent.userId && intent.userId !== userId)) return Promise.resolve(false);
  if (inFlight?.intent === intent) return inFlight.promise;
  const bound = { ...intent, userId };
  store(bound);
  const promise = add(bound.id)
    .then(() => {
      if (read() === bound) store(null);
      return true;
    })
    .finally(() => {
      if (inFlight?.intent === bound) inFlight = undefined;
    });
  inFlight = { intent: bound, promise };
  return promise;
}
