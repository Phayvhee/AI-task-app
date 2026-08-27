import { createClient } from "redis";
import Task from "./models/Task.js";

// In-process port of worker/worker.py. Enabled with RUN_INLINE_WORKER=true so
// a single service (e.g. a free Render web service) can run both the API and
// the queue consumer. In Kubernetes we run the dedicated Python worker instead,
// so this stays disabled there and the two never double-process.

const QUEUE_KEY = process.env.REDIS_TASK_QUEUE || "tasks";

// Mirrors the operations in worker/tasks.py.
const OPERATIONS = {
  uppercase: (t) => t.toUpperCase(),
  lowercase: (t) => t.toLowerCase(),
  reverse: (t) => [...t].reverse().join(""),
  wordcount: (t) => String(t.trim() ? t.trim().split(/\s+/).length : 0),
};

const processJob = async (job) => {
  const { taskId, operation, inputText } = job;
  try {
    await Task.findByIdAndUpdate(taskId, {
      status: "running",
      $push: { logs: "Started processing" },
    });

    // Simulate processing time (matches the Python worker's behaviour).
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const op = OPERATIONS[operation];
    const result = op ? op(inputText) : "Unknown operation";

    await Task.findByIdAndUpdate(taskId, {
      status: "success",
      result,
      $push: { logs: `Completed: ${result}` },
    });
    console.info(`Task ${taskId} completed successfully`);
  } catch (err) {
    console.error(`Error processing task ${taskId}:`, err.message);
    try {
      await Task.findByIdAndUpdate(taskId, {
        status: "failed",
        $push: { logs: String(err.message) },
      });
    } catch (updateErr) {
      console.error("Failed to update task status:", updateErr.message);
    }
  }
};

export const startInlineWorker = async () => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  // A dedicated connection: BLPOP blocks the connection it runs on, so it must
  // not share the client the API uses to enqueue jobs.
  const client = createClient({
    url: redisUrl,
    socket: { reconnectStrategy: (retries) => Math.min(retries * 100, 3000) },
  });
  client.on("error", (err) => console.error("Inline worker Redis error:", err.message));

  await client.connect();
  console.info(`Inline worker listening for tasks on Redis queue '${QUEUE_KEY}'`);

  for (;;) {
    try {
      const popped = await client.blPop(QUEUE_KEY, 5); // { key, element } | null
      if (!popped) continue;

      let job;
      try {
        job = JSON.parse(popped.element);
      } catch {
        console.error("Invalid JSON payload from queue; skipping");
        continue;
      }
      if (!job || typeof job !== "object") {
        console.error("Queue payload is not a JSON object; skipping");
        continue;
      }
      console.info(`Received task job ${job.taskId} for operation ${job.operation}`);
      await processJob(job);
    } catch (err) {
      console.error("Inline worker loop error:", err.message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};
