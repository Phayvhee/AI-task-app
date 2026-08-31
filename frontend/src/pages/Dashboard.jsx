import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../context/auth";
import TaskForm from "../components/TaskForm.jsx";
import TaskList from "../components/TaskList.jsx";

const API_URL = import.meta.env.VITE_API_URL || "";

const getAuthHeaders = (token) => {
  const authToken = token || localStorage.getItem("token");
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
};

const Dashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  const fetchTasks = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/tasks`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(token),
        },
      });
      setTasks(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timeout = setTimeout(fetchTasks, 0);
    const interval = setInterval(fetchTasks, 4000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [fetchTasks, token]);

  return (
    <div className="min-h-screen bg-[#050816] text-white py-10 px-4">
      <div className="mx-auto w-full max-w-[900px]">
        <div className="rounded-[28px] bg-slate-950 p-8 shadow-[0_18px_45px_rgba(0,0,0,0.35)]">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Queue dashboard</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
                AI Task Processing
              </h1>
              <p className="mt-4 text-slate-400 text-base leading-7">
                Create jobs, monitor status updates, and keep the queue moving with a polished queue management experience.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <TaskForm onTaskCreated={fetchTasks} />
            <TaskList tasks={tasks} loading={loading} refresh={fetchTasks} token={token} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
