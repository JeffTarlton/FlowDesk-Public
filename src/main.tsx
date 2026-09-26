import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './themes.css'
import './index.css'
import App from './App.tsx'
import SetupRequired from './components/SetupRequired.tsx'
import { isSupabaseConfigured } from './lib/supabase'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Without Supabase credentials, show setup instructions instead of a broken app */}
    {isSupabaseConfigured ? <App /> : <SetupRequired />}
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 4000,
        // react-hot-toast sets inline colors, so the theme classes need !important
        className: '!bg-white !text-gray-900 dark:!bg-surface-dark dark:!text-gray-100 !text-sm !rounded-xl !shadow-lg border border-gray-100 dark:border-gray-800',
      }}
    />
  </StrictMode>,
)
