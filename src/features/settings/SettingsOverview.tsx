import React from 'react';
import {
  Check,
  Database,
  DollarSign,
  FileText,
  Globe,
  Images,
  Lock,
  Palette,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Language, ThemeMode } from '../../types';
import { SUPPORTED_CURRENCIES } from '../../utils/currency';
import { t } from '../../utils/translations';
import { APP_VERSION_CODE, APP_VERSION_NAME } from '../../utils/appVersion';
import { SettingsRow } from './SettingsRow';
import type { SettingsOverviewCopy } from './settingsCopy';

export type InlineSettingsSection = 'appearance' | 'language' | 'currency' | null;

interface SettingsOverviewProps {
  currentCurrencyCode: string;
  currentThemeMode: ThemeMode;
  currentLanguage: Language;
  totalExpensesCount: number;
  isAppLockEnabled: boolean;
  storageValue: string;
  copy: SettingsOverviewCopy;
  expandedSection: InlineSettingsSection;
  onExpandedSectionChange: (section: InlineSettingsSection) => void;
  onThemeChange: (mode: ThemeMode) => void;
  onLanguageChange: (language: Language) => void;
  onCurrencyRequest: (currencyCode: string) => void;
  onOpenAppLock: () => void;
  onOpenStorageMedia: () => void;
  onOpenBackupRestore: () => void;
  onReviewSetup: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onClearData: () => void;
}

const languages: { code: Language; name: string; direction: string }[] = [
  { code: 'en', name: 'English', direction: 'LTR' },
  { code: 'fr', name: 'Français', direction: 'LTR' },
  { code: 'ar', name: 'العربية', direction: 'RTL' },
];

export const SettingsOverview: React.FC<SettingsOverviewProps> = ({
  currentCurrencyCode,
  currentThemeMode,
  currentLanguage,
  totalExpensesCount,
  isAppLockEnabled,
  storageValue,
  copy,
  expandedSection,
  onExpandedSectionChange,
  onThemeChange,
  onLanguageChange,
  onCurrencyRequest,
  onOpenAppLock,
  onOpenStorageMedia,
  onOpenBackupRestore,
  onReviewSetup,
  onOpenTerms,
  onOpenPrivacy,
  onClearData,
}) => {
  const appearanceValue =
    currentThemeMode === 'SYSTEM'
      ? t(currentLanguage, 'themeSystem')
      : currentThemeMode === 'LIGHT'
        ? t(currentLanguage, 'themeLight')
        : t(currentLanguage, 'themeDark');
  const languageValue =
    languages.find((item) => item.code === currentLanguage)?.name ?? 'English';

  return (
    <>
      <section
        className="bg-white dark:bg-[#111928] border border-slate-200/90 dark:border-slate-800/80 rounded-3xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80"
        data-settings-overview="compact"
      >
        <div>
          <SettingsRow
            icon={<Palette className="w-4 h-4" />}
            label={copy.appearance}
            value={appearanceValue}
            indicator="expand"
            expanded={expandedSection === 'appearance'}
            onClick={() =>
              onExpandedSectionChange(expandedSection === 'appearance' ? null : 'appearance')
            }
          />
          {expandedSection === 'appearance' && (
            <div className="px-3.5 pb-3 grid grid-cols-3 gap-2" data-inline-settings="appearance">
              {(
                [
                  ['SYSTEM', t(currentLanguage, 'themeSystem')],
                  ['LIGHT', t(currentLanguage, 'themeLight')],
                  ['DARK', t(currentLanguage, 'themeDark')],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onThemeChange(mode)}
                  className={
                    'min-h-[48px] px-2 rounded-xl border text-xs font-bold ' +
                    (currentThemeMode === mode
                      ? 'border-indigo-500 bg-indigo-600 text-white'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19] text-slate-700 dark:text-slate-300')
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <SettingsRow
            icon={<Globe className="w-4 h-4" />}
            label={copy.language}
            value={languageValue}
            indicator="expand"
            expanded={expandedSection === 'language'}
            onClick={() =>
              onExpandedSectionChange(expandedSection === 'language' ? null : 'language')
            }
          />
          {expandedSection === 'language' && (
            <div className="px-3.5 pb-3 grid grid-cols-1 gap-2" data-inline-settings="language">
              {languages.map((language) => (
                <button
                  key={language.code}
                  type="button"
                  onClick={() => onLanguageChange(language.code)}
                  className={
                    'min-h-[48px] px-3 rounded-xl border text-sm font-bold flex items-center justify-between gap-3 text-left rtl:text-right ' +
                    (currentLanguage === language.code
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19]')
                  }
                >
                  <span>{language.name}</span>
                  <span className="text-[10px] opacity-70">{language.direction}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <SettingsRow
            icon={<DollarSign className="w-4 h-4" />}
            label={copy.currency}
            value={currentCurrencyCode.toUpperCase()}
            indicator="expand"
            expanded={expandedSection === 'currency'}
            onClick={() =>
              onExpandedSectionChange(expandedSection === 'currency' ? null : 'currency')
            }
          />
          {expandedSection === 'currency' && (
            <div className="px-3.5 pb-3 space-y-1.5" data-inline-settings="currency">
              {SUPPORTED_CURRENCIES.map((currency) => {
                const selected =
                  currency.code.toLowerCase() === currentCurrencyCode.toLowerCase();
                return (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => onCurrencyRequest(currency.code)}
                    className={
                      'w-full min-h-[48px] px-3 rounded-xl border flex items-center justify-between gap-3 text-left rtl:text-right text-xs ' +
                      (selected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0F19]')
                    }
                  >
                    <span className="min-w-0 flex items-center gap-3">
                      <span className="w-9 font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">{currency.symbol}</span>
                      <span className="truncate">{currency.name}</span>
                    </span>
                    {selected && <Check className="w-4 h-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <SettingsRow
          icon={<Lock className="w-4 h-4" />}
          label={copy.appLock}
          value={isAppLockEnabled ? copy.enabled : copy.disabled}
          hint={copy.appLockSub}
          indicator="navigate"
          onClick={onOpenAppLock}
        />
        <SettingsRow
          icon={<Images className="w-4 h-4" />}
          label={copy.storage}
          value={storageValue}
          hint={copy.storageSub}
          indicator="navigate"
          onClick={onOpenStorageMedia}
        />
        <SettingsRow
          icon={<Database className="w-4 h-4" />}
          label={copy.backup}
          hint={copy.backupSub}
          indicator="navigate"
          onClick={onOpenBackupRestore}
        />
        <SettingsRow
          icon={<RotateCcw className="w-4 h-4" />}
          label={copy.reviewSetup}
          hint={copy.reviewSetupSub}
          indicator="navigate"
          onClick={onReviewSetup}
        />
        <SettingsRow
          icon={<FileText className="w-4 h-4" />}
          label={copy.terms}
          indicator="navigate"
          onClick={onOpenTerms}
        />
        <SettingsRow
          icon={<ShieldCheck className="w-4 h-4" />}
          label={copy.privacy}
          indicator="navigate"
          onClick={onOpenPrivacy}
        />
      </section>

      <div className="px-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
        <span>{copy.version} <strong className="font-bold text-slate-700 dark:text-slate-300">{APP_VERSION_NAME}</strong></span>
        <span>{copy.build} <strong className="font-bold text-slate-700 dark:text-slate-300">{APP_VERSION_CODE}</strong></span>
      </div>

      <section className="bg-white dark:bg-[#111928] border border-rose-200 dark:border-rose-900/50 rounded-3xl overflow-hidden">
        <SettingsRow
          icon={<Trash2 className="w-4 h-4" />}
          label={copy.clearData}
          hint={t(currentLanguage, 'dangerZoneSub', { count: totalExpensesCount })}
          indicator="none"
          destructive={true}
          onClick={onClearData}
        />
      </section>
    </>
  );
};
