import { CheckCircle2, XCircle } from 'lucide-react';
import LokdITLogo from './LokdITLogo';
import { supabaseEnvStatus } from '../lib/supabase';

// Shown instead of the app when the Supabase environment variables are missing or invalid.
export default function SetupRequired() {
  const rows = [
    {
      name: 'VITE_SUPABASE_URL',
      ok: supabaseEnvStatus.url === 'ok',
      note: supabaseEnvStatus.url === 'invalid' ? 'not a valid URL' : supabaseEnvStatus.url === 'ok' ? 'set' : 'missing',
    },
    {
      name: 'VITE_SUPABASE_ANON_KEY',
      ok: supabaseEnvStatus.key === 'ok',
      note: supabaseEnvStatus.key === 'ok' ? 'set' : 'missing',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-canvas-dark p-4">
      <div className="w-full max-w-lg bg-white dark:bg-surface-dark rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-800">
        <div className="flex justify-center mb-6">
          <LokdITLogo size="lg" subtitle="FlowDesk" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
          FlowDesk isn't configured yet
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
          Set <code className="font-mono text-gray-700 dark:text-gray-300">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono text-gray-700 dark:text-gray-300">VITE_SUPABASE_ANON_KEY</code> to connect FlowDesk to your Supabase project.
          See <code className="font-mono text-gray-700 dark:text-gray-300">docs/SETUP.md</code> for the full guide.
        </p>

        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2 mb-6">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center gap-2 text-sm">
              {row.ok
                ? <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                : <XCircle size={16} className="text-red-500 shrink-0" />}
              <code className="font-mono text-gray-800 dark:text-gray-200">{row.name}</code>
              <span className={`ml-auto text-xs font-medium ${row.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{row.note}</span>
            </div>
          ))}
        </div>

        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc pl-5">
          <li>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Local:</span> copy{' '}
            <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code>, fill in both values, then restart{' '}
            <code className="font-mono">npm run dev</code>.
          </li>
          <li>
            <span className="font-semibold text-gray-800 dark:text-gray-200">Vercel:</span> add both variables under Project Settings &rarr; Environment Variables, then redeploy (values are baked in at build time).
          </li>
          <li>
            In Supabase, the Project URL is under Project Settings &rarr; Data API, and the key (publishable or legacy anon) is under Project Settings &rarr; API Keys.
          </li>
        </ul>
      </div>
    </div>
  );
}
