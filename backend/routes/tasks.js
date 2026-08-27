import express from 'express';
import jwt from 'jsonwebtoken';
import Task from '../models/Task.js';
import redis from 'redis';

const TASK_QUEUE_KEY = process.env.REDIS_TASK_QUEUE || 'tasks';
let redisClient = null;

// Initialize Redis client
const initRedis = async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redisClient = redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
  });
  
  redisClient.on('connect', () => {
    console.info('Connected to Redis');
  });
  
  try {
    await redisClient.connect();
    console.info('[REDIS] Redis client initialized successfully');
    
    // Test the connection with a simple SET/GET
    const testKey = '__test_key_' + Date.now();
    await redisClient.set(testKey, 'test_value');
    const testValue = await redisClient.get(testKey);
    await redisClient.del(testKey);
    console.info('[REDIS] Connection test passed, got value:', testValue);
  } catch (err) {
    console.warn('[REDIS] Redis connection failed, continuing without queue support:', err.message || err);
    redisClient = null;
  }
}

// Initialize Redis on module load
const initPromise = initRedis();

const waitForRedisReady = async () => {
  try {
    await initPromise;
  } catch {
    // If Redis initialization failed, the request will continue without queue support.
  }
};

initPromise.then(() => {
  console.info('[REDIS] Initialization promise resolved');
}).catch(err => {
  console.error('[REDIS] Initialization promise rejected:', err);
});

const router = express.Router();

const auth = (req, res, next) => {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ msg: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (e) {
    console.error('JWT verification failed:', e.message);
    res.status(401).json({ msg: 'Invalid token' });
  }
};

router.use(auth);

// Create a new task
router.post('/', async (req, res) => {
  try {
    const { title, inputText, operation } = req.body;
    
    // Validate input
    if (!title || !inputText || !operation) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }
    
    const validOperations = ["uppercase", "lowercase", "reverse", "wordcount"];
    if (!validOperations.includes(operation)) {
      return res.status(400).json({ msg: 'Invalid operation' });
    }
    
    // Create task in database
    const task = new Task({ userId: req.userId, title, inputText, operation });
    await task.save();

    // Enqueue task to Redis queue for worker processing
    await waitForRedisReady();
    if (redisClient) {
      try {
        const jobData = {
          taskId: task._id.toString(),
          operation,
          inputText,
        };
        await redisClient.rPush(TASK_QUEUE_KEY, JSON.stringify(jobData));
        console.info(`Task ${task._id} enqueued for processing in queue ${TASK_QUEUE_KEY}`);
      } catch (err) {
        console.warn('Failed to enqueue task to Redis:', err.message || err);
        // Still return success as task is in database
      }
    } else {
      console.warn('Redis client not available, task queuing skipped');
    }

    res.json(task);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ msg: 'Error creating task' });
  }
});

// Get all tasks for current user
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ msg: 'Error fetching tasks' });
  }
});

// Get a specific task
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }
    res.json(task);
  } catch (err) {
    console.error('Error fetching task:', err);
    res.status(500).json({ msg: 'Error fetching task' });
  }
});

// Re-queue pending tasks for the current user
router.post('/requeue-pending', async (req, res) => {
  try {
    const pendingTasks = await Task.find({ userId: req.userId, status: 'pending' });
    
    if (pendingTasks.length === 0) {
      return res.json({ msg: 'No pending tasks to re-queue', requeued: 0 });
    }

    await waitForRedisReady();
    let requeued = 0;
    
    if (redisClient) {
      for (const task of pendingTasks) {
        try {
          const jobData = {
            taskId: task._id.toString(),
            operation: task.operation,
            inputText: task.inputText,
          };
          await redisClient.rPush(TASK_QUEUE_KEY, JSON.stringify(jobData));
          requeued++;
        } catch (err) {
          console.warn(`Failed to re-queue task ${task._id}:`, err.message || err);
        }
      }
    } else {
      return res.status(500).json({ msg: 'Redis client not available' });
    }

    res.json({ msg: `Re-queued ${requeued} pending tasks`, requeued });
  } catch (err) {
    console.error('Error re-queuing tasks:', err);
    res.status(500).json({ msg: 'Error re-queuing tasks' });
  }
});

export default router;