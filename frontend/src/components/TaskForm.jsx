import { useState } from "react";
import axios from "axios";
import { CheckSquare, AlertCircle, Loader2, Rocket } from "lucide-react";
import { useAuth } from "../context/auth";

const API_URL = import.meta.env.VITE_API_URL || "";

const getAuthHeaders = (token) => {
  const authToken = token || localStorage.getItem("token");
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
};

const operations = [
  { value: "uppercase", label: "Convert to Uppercase" },
  { value: "lowercase", label: "Convert to Lowercase" },
  { value: "reverse", label: "Reverse String" },
  { value: "wordcount", label: "Count Words" },
];

const TaskForm = ({ onTaskCreated }) => {
  const [title, setTitle] = useState("");
  const [inputText, setInputText] = useState("");
  const [operation, setOperation] = useState("uppercase");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { token } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/tasks`,
        {
          title,
          inputText,
          operation,
        },
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(token),
          },
        }
      );
      setTitle("");
      setInputText("");
      onTaskCreated();
    } catch (err) {
      setError(err.response?.data?.msg || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[24px] bg-slate-900 p-7 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <div className="space-y-7">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-800 text-cyan-300">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-slate-500">New task</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Create a task</h2>
            <p className="mt-2 text-sm text-slate-400 leading-6">
              Queue a task and review its progress from the dashboard.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-[20px] bg-red-500/10 p-4 text-sm text-red-200 shadow-[0_8px_24px_rgba(220,38,38,0.12)]">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-300">Task title</label>
            <input
              type="text"
              placeholder="E.g., Convert customer names to uppercase"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-[20px] bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/15"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-300">Input</label>
            <textarea
              placeholder="Enter the text you want to process..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={6}
              className="w-full rounded-[20px] bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/15 resize-none"
              required
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-300">Operation</label>
            <select
              value={operation}
              onChange={(e) => setOperation(e.target.value)}
              className="w-full rounded-[20px] bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-400/15 cursor-pointer"
            >
              {operations.map((op) => (
                <option key={op.value} value={op.value} className="bg-slate-800 text-white">
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-[20px] bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-white" />
                Creating task...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5 text-white" />
                Create task
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;
