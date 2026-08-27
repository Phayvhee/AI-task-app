import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/auth';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, ArrowRight, AlertCircle } from 'lucide-react';

const getErrorMessage = (err) => {
  if (axios.isAxiosError(err)) {
    if (err.response?.data?.msg) return err.response.data.msg;
    if (err.message === 'Network Error') {
      return 'Unable to reach the server. Please check your connection and try again.';
    }
    return err.message || 'Invalid username or password';
  }
  return err?.message || 'Invalid username or password';
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] flex items-center justify-center px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <div className="rounded-[32px] bg-slate-950/95 p-10 shadow-[0_30px_90px_rgba(0,0,0,0.55)]">
          <div className="space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Secure access</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Sign in to your dashboard</h1>
              <p className="mt-3 text-sm text-slate-400 leading-6">
                Access the task queue and manage processing with a clean, modern workflow.
              </p>
            </div>

            {error && (
              <div className="rounded-[24px] bg-red-500/10 p-4 text-sm text-red-200 shadow-[0_10px_30px_rgba(220,38,38,0.12)]">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Username</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-4 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-[24px] bg-slate-900 px-4 py-4 pl-12 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
                    placeholder="Enter username"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-4 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[24px] bg-slate-900 px-4 py-4 pl-12 text-sm text-white outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
                    placeholder="Enter password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-[24px] bg-indigo-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-70"
              >
                {loading ? 'Signing in...' : 'Sign In'}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
            </form>

            <p className="text-center text-sm text-slate-400">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-indigo-300 hover:text-indigo-200 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
