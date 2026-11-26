import { type ExecutionContext, SetMetadata } from "@nestjs/common";

/** Named throttler: total sign-in attempts per client source (every email together). */
export const SIGN_IN_SOURCE_THROTTLER = "sign-in-source";
const SIGN_IN_SOURCE_KEY = "ph:sign-in-source-limit";
/** Marks a route for the SIGN_IN_SOURCE_THROTTLER limit (the throttler skips every other route). */
export const SignInSourceLimit = () => SetMetadata(SIGN_IN_SOURCE_KEY, true);
export function isSignInSourceLimited(ctx: ExecutionContext): boolean {
  return Reflect.getMetadata(SIGN_IN_SOURCE_KEY, ctx.getHandler()) === true;
}

/**
 * Failed sign-ins per (client source, account), kept in memory.
 *
 * After SOURCE_MAX_FAILURES failures within WINDOW_MS, THAT source is refused for that account until
 * WINDOW_MS has passed since its first failure. Other sources — e.g. the owner's remembered device —
 * are not affected, so a stranger cannot lock staff out by guessing passwords. A separate, higher
 * account-wide limit (database, auth.service.ts) still caps guesses spread over many sources.
 *
 * In memory on purpose (no schema change): a restart clears it, which only gives an attacker a
 * fresh small budget; the account-wide database limit is unaffected.
 */
export const SOURCE_MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60_000;
const MAX_ENTRIES = 10_000;

type Entry = { failures: number; firstAt: number };

export class SourceFailureLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  private key(source: string, account: string) {
    return `${source}|${account}`;
  }

  private live(key: string): Entry | undefined {
    const e = this.entries.get(key);
    if (e && this.now() - e.firstAt >= WINDOW_MS) {
      this.entries.delete(key);
      return undefined;
    }
    return e;
  }

  /** True while this source has used up its failures for this account. */
  isBlocked(source: string, account: string): boolean {
    return (this.live(this.key(source, account))?.failures ?? 0) >= SOURCE_MAX_FAILURES;
  }

  recordFailure(source: string, account: string): void {
    const key = this.key(source, account);
    const e = this.live(key);
    if (e) e.failures += 1;
    else {
      if (this.entries.size >= MAX_ENTRIES) this.prune();
      this.entries.set(key, { failures: 1, firstAt: this.now() });
    }
  }

  /** Successful sign-in from this source. */
  clear(source: string, account: string): void {
    this.entries.delete(this.key(source, account));
  }

  /** Password reset / unlock by an administrator: every source for this account starts afresh. */
  clearAccount(account: string): void {
    const suffix = `|${account}`;
    for (const key of this.entries.keys()) if (key.endsWith(suffix)) this.entries.delete(key);
  }

  private prune() {
    const t = this.now();
    for (const [k, e] of this.entries) if (t - e.firstAt >= WINDOW_MS) this.entries.delete(k);
    // Still full (a flood of distinct sources): drop the oldest entries.
    while (this.entries.size >= MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
