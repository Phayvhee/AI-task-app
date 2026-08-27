import time
import os
import logging
from pymongo import MongoClient
from bson.objectid import ObjectId
import redis

# Configure logging
logger = logging.getLogger(__name__)

# Lazy-load connections to avoid import-time failures
_redis_conn = None
_mongo_client = None
_db = None
_tasks_col = None

def get_redis_conn():
    """Get or create Redis connection."""
    global _redis_conn
    if _redis_conn is None:
        redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        _redis_conn = redis.from_url(redis_url)
    return _redis_conn

def get_tasks_col():
    """Get or create MongoDB tasks collection."""
    global _mongo_client, _db, _tasks_col
    if _tasks_col is None:
        mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/ai-task-platform')
        _mongo_client = MongoClient(mongo_uri)
        try:
            _db = _mongo_client.get_default_database()
        except Exception:
            _db = _mongo_client.get_database('ai-task-platform')
        _tasks_col = _db.tasks
    return _tasks_col

def process_task(task_id, operation, input_text):
    """Process a task by performing the specified operation on input_text."""
    try:
        tasks_col = get_tasks_col()
        
        # Convert string ID to ObjectId if needed
        task_oid = ObjectId(task_id) if isinstance(task_id, str) else task_id
        
        # Update task status to running
        tasks_col.update_one(
            {"_id": task_oid}, 
            {
                "$set": {"status": "running"}, 
                "$push": {"logs": "Started processing"}
            }
        )
        
        # Simulate processing time
        time.sleep(2)
        
        # Perform operation
        if operation == "uppercase":
            result = input_text.upper()
        elif operation == "lowercase":
            result = input_text.lower()
        elif operation == "reverse":
            result = input_text[::-1]
        elif operation == "wordcount":
            result = str(len(input_text.split()))
        else:
            result = "Unknown operation"
        
        # Update task with result
        tasks_col.update_one(
            {"_id": task_oid}, 
            {
                "$set": {"status": "success", "result": result},
                "$push": {"logs": f"Completed: {result}"}
            }
        )
        logger.info(f"Task {task_id} completed successfully")
    except Exception as e:
        logger.error(f"Error processing task {task_id}: {str(e)}")
        try:
            tasks_col = get_tasks_col()
            task_oid = ObjectId(task_id) if isinstance(task_id, str) else task_id
            tasks_col.update_one(
                {"_id": task_oid}, 
                {"$set": {"status": "failed"}, "$push": {"logs": str(e)}}
            )
        except Exception as update_error:
            logger.error(f"Failed to update task status: {str(update_error)}")