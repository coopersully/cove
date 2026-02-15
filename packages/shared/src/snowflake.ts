/** Discord-compatible snowflake ID generator. */

/** Cove epoch: 2025-01-01T00:00:00Z */
const EPOCH = 1_735_689_600_000n;

const WORKER_BITS = 5n;
const SEQUENCE_BITS = 17n;

const MAX_WORKER_ID = (1n << WORKER_BITS) - 1n;
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;

const WORKER_SHIFT = SEQUENCE_BITS;
const TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_BITS;

let workerId = 0n;
let sequence = 0n;
let lastTimestamp = -1n;

export function configureWorker(id: number): void {
  const bigId = BigInt(id);
  if (bigId < 0n || bigId > MAX_WORKER_ID) {
    throw new Error(`Worker ID must be between 0 and ${String(MAX_WORKER_ID)}`);
  }
  workerId = bigId;
}

export function generateSnowflake(): string {
  let now = BigInt(Date.now()) - EPOCH;

  if (now === lastTimestamp) {
    sequence = (sequence + 1n) & MAX_SEQUENCE;
    if (sequence === 0n) {
      while (now <= lastTimestamp) {
        now = BigInt(Date.now()) - EPOCH;
      }
    }
  } else {
    sequence = 0n;
  }

  lastTimestamp = now;

  return String((now << TIMESTAMP_SHIFT) | (workerId << WORKER_SHIFT) | sequence);
}

export function snowflakeTimestamp(id: string): Date {
  const snowflake = BigInt(id);
  const timestamp = (snowflake >> TIMESTAMP_SHIFT) + EPOCH;
  return new Date(Number(timestamp));
}

export function compareSnowflakes(a: string, b: string): number {
  const diff = BigInt(a) - BigInt(b);
  if (diff < 0n) {
    return -1;
  }
  if (diff > 0n) {
    return 1;
  }
  return 0;
}
