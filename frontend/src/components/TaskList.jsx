import { useState } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, Loader2, Info, RefreshCw, Inbox, Sparkles, Calendar, FileText, X, Settings, ArrowRight, Edit, Terminal, RotateCcw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "";

const TaskList = ({ tasks, loading, refresh, token }) => {
  const [selectedTask, setSelectedTask] = useState(null);
  const [requeuing, setRequeuing] = useState(false);
  const [banner, setBanner] = useState(null);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-yellow-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'running':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    }
  };

  const handleRequeuePending = async () => {
    setBanner(null);
    setRequeuing(true);
    try {
      const res = await axios.post(`${API_URL}/api/tasks/requeue-pending`, {}, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      setBanner({
        type: res.data.msg?.toLowerCase().includes('no pending') ? 'info' : 'success',
        text: res.data.msg || 'Pending tasks have been re-queued successfully.',
      });
      refresh(); // Refresh the task list
    } catch (err) {
      console.error('Error re-queuing tasks:', err);
      setBanner({
        type: 'error',
        text: err.response?.data?.msg || 'Unable to re-queue pending tasks. Please try again.',
      });
    } finally {
      setRequeuing(false);
    }
  };

  return (
    <div className="rounded-[24px] bg-slate-900 p-7 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <div className="space-y-6">
        <section className="rounded-[22px] bg-slate-950 p-6 shadow-sm shadow-slate-950/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Task queue</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Current tasks</h2>
              <p className="mt-2 text-sm text-slate-400 max-w-xl">
                Refresh the feed or requeue pending jobs without leaving the dashboard.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={refresh}
                aria-label="Refresh tasks"
                className="inline-flex h-11 items-center justify-center rounded-[20px] bg-indigo-600 px-4 text-white transition hover:bg-indigo-500"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={handleRequeuePending}
                disabled={requeuing}
                aria-label="Re-queue pending tasks"
                className="inline-flex h-11 items-center justify-center rounded-[20px] bg-orange-500 px-4 text-white transition hover:bg-orange-400 disabled:opacity-70"
              >
                {requeuing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </section>

        {banner && (
          <section className={`rounded-[20px] px-5 py-4 text-sm ${banner.type === 'error' ? 'bg-red-500/10 text-red-200' : banner.type === 'success' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-sky-500/10 text-sky-200'} shadow-[0_10px_30px_rgba(15,23,42,0.1)]`}>
            {banner.text}
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[20px] bg-slate-950 p-5 text-sm text-slate-300 shadow-sm shadow-slate-950/10">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Total tasks</p>
            <p className="mt-3 text-xl font-semibold text-white">{tasks.length}</p>
          </div>
          <div className="rounded-[20px] bg-slate-950 p-5 text-sm text-slate-300 shadow-sm shadow-slate-950/10">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Auto refresh</p>
            <p className="mt-3 text-xl font-semibold text-white">Every 4 seconds</p>
          </div>
        </section>

        {loading ? (
          <section className="rounded-[22px] bg-slate-950 p-10 text-center shadow-sm shadow-slate-950/20">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-cyan-400" />
            <p className="text-slate-300 text-lg">Loading tasks…</p>
          </section>
        ) : tasks.length === 0 ? (
          <section className="rounded-[22px] bg-slate-950 p-10 text-center shadow-sm shadow-slate-950/20">
            <Inbox className="mx-auto mb-4 h-12 w-12 text-slate-400" />
            <p className="text-slate-300 text-lg font-semibold">No tasks available</p>
            <p className="text-slate-400 text-sm mt-2">Create a task to begin processing immediately.</p>
          </section>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task._id}
                onClick={() => setSelectedTask(task)}
                className="group cursor-pointer overflow-hidden rounded-[24px] bg-slate-950 p-6 shadow-sm shadow-slate-950/20 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(79,70,229,0.12)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white transition group-hover:text-indigo-300">
                      {task.title}
                    </h3>
                    <p className="mt-2 text-slate-400 text-sm leading-6 line-clamp-2">{task.inputText}</p>
                  </div>
                  <span
                    className={`inline-flex min-w-[120px] items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${getStatusColor(
                      task.status
                    )}`}
                  >
                    {getStatusIcon(task.status)}
                    {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {task.operation}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTask && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-950/95 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="sticky top-0 bg-slate-900 p-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-semibold text-white">{selectedTask.title}</h2>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-400" />Operation
                </label>
                <p className="rounded-[20px] bg-slate-800 px-4 py-3 text-white">
                  <ArrowRight className="w-4 h-4 mr-2 inline" />
                  {selectedTask.operation.charAt(0).toUpperCase() + selectedTask.operation.slice(1)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Edit className="w-4 h-4 text-blue-400" />Input
                </label>
                <p className="rounded-[20px] bg-slate-800 px-4 py-3 text-white break-words">
                  {selectedTask.inputText}
                </p>
              </div>

              {selectedTask.result && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />Result
                  </label>
                  <p className="rounded-[20px] bg-emerald-500/10 px-4 py-3 text-emerald-300 break-words">
                    {selectedTask.result}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-yellow-400" />Logs
                </label>
                <pre className="rounded-[20px] bg-slate-950 px-4 py-3 text-slate-300 text-sm overflow-auto max-h-48 font-mono">
                  {selectedTask.logs?.length ? selectedTask.logs.join('\n') : 'No logs available'}
                </pre>
              </div>

              <button
                onClick={() => setSelectedTask(null)}
                className="w-full rounded-[24px] bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskList;
