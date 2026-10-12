import React from 'react';
import type { AiProgress } from '../app/hooks/aiOperation';
import type { Language } from '../types';

export const aiProgressCopy = {
  en: { idle: '', starting: 'Preparing the request…', preparing: 'Preparing photo…', connecting: 'Checking backend readiness…', authenticating: 'Connecting securely…', sending: 'Waiting for the AI service…', checking: 'Checking the result…', ready: 'Ready to review', local: 'Local analysis ready to review', cancelled: 'Cancelled. Your entered fields are unchanged.', error: 'The request could not complete.', wait: 'The request is still pending. You can cancel at any time.', cancel: 'Cancel AI request', retry: 'Retry' },
  fr: { idle: '', starting: 'Préparation de la requête…', preparing: 'Préparation de la photo…', connecting: 'Vérification de la disponibilité du serveur…', authenticating: 'Connexion sécurisée…', sending: 'En attente du service IA…', checking: 'Vérification du résultat…', ready: 'Prêt à vérifier', local: 'Analyse locale prête à vérifier', cancelled: 'Annulé. Les champs saisis sont inchangés.', error: 'La requête n’a pas pu aboutir.', wait: 'La requête est toujours en attente. Vous pouvez l’annuler à tout moment.', cancel: 'Annuler la requête IA', retry: 'Réessayer' },
  ar: { idle: '', starting: 'جارٍ تحضير الطلب…', preparing: 'جارٍ تحضير الصورة…', connecting: 'جارٍ التحقق من جاهزية الخادم…', authenticating: 'جارٍ الاتصال بأمان…', sending: 'في انتظار خدمة الذكاء الاصطناعي…', checking: 'جارٍ التحقق من النتيجة…', ready: 'جاهز للمراجعة', local: 'التحليل المحلي جاهز للمراجعة', cancelled: 'تم الإلغاء. الحقول التي أدخلتها لم تتغير.', error: 'تعذر إكمال الطلب.', wait: 'لا يزال الطلب قيد الانتظار. يمكنك إلغاؤه في أي وقت.', cancel: 'إلغاء طلب الذكاء الاصطناعي', retry: 'إعادة المحاولة' },
};

export function AiProgressPanel({ progress, language, onCancel, onRetry, tone = 'indigo', errorMessage }: {
  progress: AiProgress; language: Language; onCancel?: () => void; onRetry?: () => void;
  tone?: 'indigo' | 'cyan' | 'purple'; errorMessage?: string | null;
}) {
  if (progress.stage === 'idle') return null;
  const text = aiProgressCopy[language];
  return <div className="ai-progress space-y-2 py-2 text-xs text-slate-800 dark:text-slate-100" data-ai-stage={progress.stage} data-ai-tone={tone}>
    <p role="status" aria-live="polite" aria-atomic="true" className="font-semibold break-words leading-relaxed flex items-start gap-2">
      <span aria-hidden="true" className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--ai-accent)]" />
      <span>{progress.stage === 'error' && errorMessage ? errorMessage : text[progress.stage]}</span>
    </p>
    {progress.active && <>
      <div aria-hidden="true" className="ai-progress-track"><div className="ai-progress-bar" /></div>
      <p className="text-slate-600 dark:text-slate-300">{text.wait}</p>
    </>}
    {progress.active && onCancel && <button type="button" onClick={onCancel} className="min-h-[48px] max-w-full px-2 rounded-lg font-semibold underline underline-offset-4 text-start">{text.cancel}</button>}
    {!progress.active && ['error', 'cancelled', 'local'].includes(progress.stage) && onRetry && <button type="button" onClick={onRetry} className="min-h-[48px] max-w-full px-2 rounded-lg font-semibold underline underline-offset-4 text-start">{text.retry}</button>}
  </div>;
}
