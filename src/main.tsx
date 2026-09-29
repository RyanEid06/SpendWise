import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { StorageManager } from './utils/storage';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

async function bootstrap() {
  try {
    await StorageManager.init();
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('SpendWise local data initialization failed.', error);
    root.render(
      <div className="min-h-screen bg-slate-100 dark:bg-[#05080C] text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-[#111928] p-6 shadow-sm space-y-3">
          <h1 className="text-lg font-extrabold">SpendWise could not safely open local data</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Your existing financial data was not deleted. Close and reopen the app. If this continues,
            keep the current installation in place so the stored data remains available for recovery.
          </p>
        </div>
      </div>
    );
  }
}

void bootstrap();
