import type { Clock } from './clock-port.js';

export class SystemClock implements Clock {
  nowIso(): string {
    return new Date().toISOString();
  }
}
