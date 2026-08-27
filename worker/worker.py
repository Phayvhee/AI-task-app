import os
import sys
import json
import logging
import time
from pathlib import Path
import redis
from tasks import process_task

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

QUEUE_KEY = os.getenv('REDIS_TASK_QUEUE', 'tasks')
HEARTBEAT_FILE = os.getenv('WORKER_HEARTBEAT_FILE', '/tmp/worker_heartbeat')


def _touch_heartbeat():
    """Update the heartbeat file so the liveness probe knows we're alive."""
    try:
        Path(HEARTBEAT_FILE).touch()
    except OSError as e:
        logger.warning(f"Could not update heartbeat file: {e}")


def wait_for_redis(redis_url, max_retries=30, retry_delay=1):
    """Wait for Redis to be available with retries."""
    for attempt in range(max_retries):
        try:
            redis_conn = redis.from_url(redis_url)
            redis_conn.ping()
            logger.info(f"Redis is ready at {redis_url}")
            return redis_conn
        except (redis.ConnectionError, Exception) as e:
            if attempt < max_retries - 1:
                logger.warning(f"Redis connection attempt {attempt + 1}/{max_retries} failed: {e}")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to connect to Redis after {max_retries} attempts")
                raise


def process_queue(redis_conn):
    """Process tasks from the Redis list queue."""
    logger.info(f"Listening for tasks on Redis queue '{QUEUE_KEY}'")
    while True:
        _touch_heartbeat()
        try:
            item = redis_conn.blpop(QUEUE_KEY, timeout=5)
            if item:
                _, payload = item
                if not payload:
                    logger.warning("Received empty payload from queue; skipping.")
                    continue
                if isinstance(payload, bytes):
                    payload = payload.decode('utf-8')
                try:
                    job_data = json.loads(payload)
                    if not isinstance(job_data, dict):
                        raise ValueError("Queue payload is not a JSON object")
                    task_id = job_data.get('taskId')
                    operation = job_data.get('operation')
                    input_text = job_data.get('inputText')
                    logger.info(f"Received task job {task_id} for operation {operation}")
                    process_task(task_id, operation, input_text)
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON payload from queue: {e}")
                except Exception as e:
                    logger.error(f"Failed to process queued job: {e}")
            else:
                time.sleep(0.5)
        except redis.ConnectionError as e:
            logger.error(f"Redis connection lost: {e}")
            time.sleep(2)
        except Exception as e:
            logger.error(f"Unexpected worker error: {e}")
            time.sleep(2)


def main():
    """Start the worker to process tasks from Redis queue."""
    redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')

    # Wait for Redis to be available
    try:
        redis_conn = wait_for_redis(redis_url)
    except Exception as e:
        logger.error(f"Fatal: Could not connect to Redis: {e}")
        sys.exit(1)

    process_queue(redis_conn)


if __name__ == '__main__':
    main()
