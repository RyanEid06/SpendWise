import React from 'react';
import { ChevronRight, Image as ImageIcon, NotebookPen } from 'lucide-react';
import { Expense, Language } from '../types';
import { getCategoryInfo } from '../utils/categories';
import { formatCurrency } from '../utils/currency';
import { getLocalizedCategoryName } from '../utils/translations';
import { formatHistoryTime, formatHistoryDate } from '../utils/historyView';
import { ta } from '../utils/attachmentTranslations';
import { wp17Copy } from '../utils/wp17Copy';

interface ExpenseItemCardProps {
  expense: Expense; currencyCode: string; language: Language; attachmentCount: number; onClick: () => void;
}
export const ExpenseItemCard: React.FC<ExpenseItemCardProps> = ({ expense,currencyCode,language,attachmentCount,onClick }) => {
  const catInfo=getCategoryInfo(expense.category), localizedCat=getLocalizedCategoryName(expense.category,language);
  const hasNote=Boolean(expense.note?.trim());
  const localizedDate=formatHistoryDate(expense.date,language);
  return <div className="relative bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-2xl shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700">
    <div onClick={onClick} role="button" tabIndex={0}
      aria-label={`${expense.description}, ${formatCurrency(expense.amount,currencyCode)}, ${localizedCat}`}
      onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onClick();}}}
      className="min-h-[64px] px-3 py-2.5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 cursor-pointer active:scale-[0.995] transition-transform select-none">
      <div style={{backgroundColor:`${catInfo.color}15`,borderColor:`${catInfo.color}35`}} className="w-10 h-10 rounded-xl border flex items-center justify-center text-lg shrink-0" aria-hidden="true">{catInfo.iconEmoji}</div>
      <div className="min-w-0"><h4 className="font-bold text-slate-900 dark:text-white text-sm truncate leading-snug">{expense.description}</h4>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span style={{color:catInfo.color}} className="font-semibold shrink-0">{localizedCat}</span><span aria-hidden="true">·</span>
          <span className="shrink-0 whitespace-nowrap">{localizedDate} · {formatHistoryTime(expense.date,language)}</span>
          {attachmentCount>0&&<><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title={attachmentCount===1?ta(language,'photoAttached'):ta(language,'photosAttached',{count:attachmentCount})}><ImageIcon className="w-3.5 h-3.5"/><span className="font-bold">{attachmentCount}</span></span></>}
          {hasNote&&<><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1" title={wp17Copy(language,'noteAttached')}><NotebookPen className="w-3.5 h-3.5"/><span className="sr-only">{wp17Copy(language,'noteAttached')}</span></span></>}
        </div></div>
      <div className="flex items-center min-w-0"><div dir="ltr" className="max-w-[7rem] font-extrabold text-sm tabular-nums [overflow-wrap:anywhere]">{formatCurrency(expense.amount,currencyCode)}</div><ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180 shrink-0 ml-1 rtl:ml-0 rtl:mr-1" aria-hidden="true"/></div>
    </div></div>;
};
