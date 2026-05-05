import "server-only";

// Bounded-concurrency in-process queue for AI work spawned by the LINE
// webhook. Without this, a burst of incoming messages spawns one AI call
// per webhook in parallel — the Node process keeps file descriptors,
// outbound sockets, and ~50MB heap per call open until each one finishes.
// Hostinger LiteSpeed sees the worker as still doing work and spawns more
// processes; the pool fills up and unrelated routes start returning 503.
//
// With this queue:
//   - At most MAX_CONCURRENT AI jobs run at once per Node process
//   - Up to MAX_BACKLOG jobs wait in FIFO; excess is dropped + logged
//   - The webhook handler always returns immediately — enqueueAiJob is
//     synchronous (it never awaits the job), it just decides slot/queue/drop
//
// Tunable via env:
//   AI_QUEUE_CONCURRENCY  default 2
//   AI_QUEUE_BACKLOG      default 50

type Job = () => Promise<void>;

const MAX_CONCURRENT = Math.max(
  1,
  parseInt(process.env.AI_QUEUE_CONCURRENCY ?? "2", 10) || 2,
);
const MAX_BACKLOG = Math.max(
  0,
  parseInt(process.env.AI_QUEUE_BACKLOG ?? "50", 10) || 50,
);

type Entry = { job: Job; enqueuedAt: number };

let active = 0;
const queue: Entry[] = [];
let totalCompleted = 0;
let totalDropped = 0;
let totalEnqueued = 0;

export type EnqueueResult =
  | { ok: true; active: number; backlog: number; queued: boolean }
  | { ok: false; reason: "backlog_full"; active: number; backlog: number };

/**
 * Enqueue a job. Synchronous — never awaits the job itself. Returns
 * immediately with placement info (or rejection if the backlog is full).
 */
export function enqueueAiJob(job: Job): EnqueueResult {
  totalEnqueued++;

  // Slot available — start running immediately
  if (active < MAX_CONCURRENT) {
    void runJob(job);
    return { ok: true, active, backlog: queue.length, queued: false };
  }

  // No slot, but backlog has room
  if (queue.length < MAX_BACKLOG) {
    queue.push({ job, enqueuedAt: Date.now() });
    return { ok: true, active, backlog: queue.length, queued: true };
  }

  // Backlog full — drop. Caller is responsible for logging + marking the
  // affected row so the merchant knows AI didn't get to it.
  totalDropped++;
  return {
    ok: false,
    reason: "backlog_full",
    active,
    backlog: queue.length,
  };
}

async function runJob(job: Job) {
  active++;
  try {
    await job();
  } catch (e) {
    // Should be impossible if callers wrap their own try/catch — log
    // anyway so the queue itself never silently swallows errors.
    console.error("[ai-queue] uncaught job error:", e);
  } finally {
    active--;
    totalCompleted++;
    const next = queue.shift();
    if (next) {
      const waitedMs = Date.now() - next.enqueuedAt;
      if (waitedMs > 30_000) {
        console.warn(
          `[ai-queue] job waited ${waitedMs}ms before starting — LINE replyToken probably expired (1 min validity)`,
        );
      }
      void runJob(next.job);
    }
  }
}

export function getQueueStats() {
  return {
    active,
    backlog: queue.length,
    max_concurrent: MAX_CONCURRENT,
    max_backlog: MAX_BACKLOG,
    total_enqueued: totalEnqueued,
    total_completed: totalCompleted,
    total_dropped: totalDropped,
  };
}
