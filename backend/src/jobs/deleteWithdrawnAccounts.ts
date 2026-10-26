import { deleteWithdrawnAccounts, WITHDRAWN_ACCOUNT_RETENTION_DAYS } from '../services/users';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
// Accounts are deleted one check interval early, so that none is kept longer than the
// promised retention period between two checks.
const RETENTION = `${WITHDRAWN_ACCOUNT_RETENTION_DAYS} days -${CHECK_INTERVAL_MS / 1000} seconds`;

async function run(): Promise<void> {
  try {
    const deleted = await deleteWithdrawnAccounts(RETENTION);
    if (deleted > 0) console.log(`[accounts] Deleted ${deleted} account(s) with withdrawn consent`);
  } catch (err) {
    // E.g. the database is unavailable: the next check retries.
    console.error('[accounts] Failed to delete accounts with withdrawn consent:', err);
  }
}

/**
 * Deletes accounts with a consent withdrawn WITHDRAWN_ACCOUNT_RETENTION_DAYS ago: now and
 * then every hour. Safe to run in several server processes at once.
 */
export function startDeletingWithdrawnAccounts(): () => void {
  void run();
  const timer = setInterval(() => void run(), CHECK_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
