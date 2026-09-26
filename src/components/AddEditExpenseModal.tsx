import React, { useState, useRef } from 'react';
import { Camera, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Expense, ReceiptScanResult } from '../types';
import { DEFAULT_CATEGORIES } from '../utils/categories';
import { getCurrency, formatCurrency } from '../utils/currency';
import { formatDate, fromInputDateFormat, toInputDateFormat } from '../utils/date';

interface AddEditExpenseModalProps {
  isOpen: boolean;
  initialExpense?: Expense | null;
  defaultDate?: number;
  currencyCode: string;
  onSave: (amount: number, description: string, category: string, date: number, note?: string | null) => void;
  onClose: () => void;
}

export const AddEditExpenseModal: React.FC<AddEditExpenseModalProps> = ({
  isOpen,
  initialExpense,
  defaultDate = Date.now(),
  currencyCode,
  onSave,
  onClose,
}) => {
  if (!isOpen) return null;

  const currency = getCurrency(currencyCode);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [amountText, setAmountText] = useState(
    initialExpense ? initialExpense.amount.toString() : ''
  );
  const [descriptionText, setDescriptionText] = useState(initialExpense?.description || '');
  const [selectedCategory, setSelectedCategory] = useState(
    initialExpense?.category || DEFAULT_CATEGORIES[0].name
  );
  const [selectedDateMillis, setSelectedDateMillis] = useState<number>(
    initialExpense?.date || defaultDate
  );
  const [noteText, setNoteText] = useState(initialExpense?.note || '');

  const [amountError, setAmountError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  // Receipt scanning states
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ReceiptScanResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        try {
          const res = await fetch('/api/gemini/scan-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64Data,
              mimeType: file.type || 'image/jpeg',
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server returned ${res.status}`);
          }

          const extracted: ReceiptScanResult = await res.json();
          setScannedResult(extracted);

          if (extracted.totalAmount != null && extracted.totalAmount > 0) {
            setAmountText(extracted.totalAmount.toString());
            setAmountError(null);
          }
          if (extracted.merchant) {
            setDescriptionText(extracted.merchant);
            setDescriptionError(null);
          }
          if (extracted.category) {
            setSelectedCategory(extracted.category);
          }
          if (extracted.dateMillis) {
            setSelectedDateMillis(extracted.dateMillis);
          }
          if (extracted.notesSummary) {
            setNoteText((prev) => (prev ? `${prev}\n${extracted.notesSummary}` : extracted.notesSummary!));
          }
        } catch (err: any) {
          setScanError(err.message || 'Failed to scan receipt with Gemini AI vision.');
        } finally {
          setIsScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setScanError(err.message || 'Failed to read image file.');
      setIsScanning(false);
    }
  };

  const handleSave = () => {
    let hasError = false;
    const amount = parseFloat(amountText);

    if (isNaN(amount) || amount <= 0) {
      setAmountError('Please enter an amount greater than 0');
      hasError = true;
    }

    if (!descriptionText.trim()) {
      setDescriptionError('Description cannot be empty');
      hasError = true;
    }

    if (!hasError && !isNaN(amount)) {
      onSave(
        amount,
        descriptionText.trim(),
        selectedCategory,
        selectedDateMillis,
        noteText.trim() || null
      );
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#111928] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">
            {initialExpense ? 'Edit Expense' : 'Add Expense'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Scan Receipt Action Button */}
          <div className="bg-purple-950/40 border border-purple-800/60 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-purple-900/60 text-purple-300 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-purple-100">
                    Scan Receipt with AI
                  </h4>
                  <p className="text-xs text-purple-300/80">
                    Auto-extract merchant, total, date & items
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                type="button"
                disabled={isScanning}
                onClick={() => fileInputRef.current?.click()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs px-3.5 py-2 rounded-xl transition-all disabled:opacity-50 cursor-pointer shadow-xs flex items-center space-x-1.5"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <span>Upload / Photo</span>
                )}
              </button>
            </div>

            {/* Scanning Indicator */}
            {isScanning && (
              <div className="mt-3 flex items-center space-x-2 text-xs text-purple-300 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>Gemini AI is analyzing receipt image...</span>
              </div>
            )}

            {/* Error Message */}
            {scanError && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-950/60 text-rose-200 text-xs flex items-center space-x-2 border border-rose-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{scanError}</span>
              </div>
            )}

            {/* Extracted Receipt Review Card */}
            {scannedResult && !isScanning && (
              <div className="mt-3.5 p-3.5 rounded-xl bg-purple-900/40 border border-purple-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-purple-200 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Extracted Receipt Data</span>
                  </div>
                  <span className="text-[11px] font-semibold text-purple-300">
                    Review & Edit Below
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-400">Merchant:</span>
                    <p className="font-semibold text-white truncate">
                      {scannedResult.merchant || 'Uncertain'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400">Total:</span>
                    <p className="font-bold text-white">
                      {scannedResult.totalAmount != null
                        ? formatCurrency(scannedResult.totalAmount, currencyCode)
                        : 'Uncertain'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Amount Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Amount *
            </label>
            <div className="relative rounded-2xl">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none font-bold text-slate-400 text-lg">
                {currency.symbol}
              </div>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value);
                  setAmountError(null);
                }}
                className={`w-full pl-9 pr-4 py-3 rounded-2xl border text-lg font-bold bg-[#0B0F19] text-white focus:outline-none focus:ring-2 transition-all ${
                  amountError
                    ? 'border-rose-500 focus:ring-rose-500'
                    : 'border-slate-800 focus:ring-emerald-500'
                }`}
              />
            </div>
            {amountError && <p className="text-xs text-rose-400 mt-1 font-medium">{amountError}</p>}
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Description / Merchant *
            </label>
            <input
              type="text"
              placeholder="e.g. Carrefour, Starbucks"
              value={descriptionText}
              onChange={(e) => {
                setDescriptionText(e.target.value);
                setDescriptionError(null);
              }}
              className={`w-full px-4 py-3 rounded-2xl border text-sm font-medium bg-[#0B0F19] text-white focus:outline-none focus:ring-2 transition-all ${
                descriptionError
                  ? 'border-rose-500 focus:ring-rose-500'
                  : 'border-slate-800 focus:ring-emerald-500'
              }`}
            />
            {descriptionError && (
              <p className="text-xs text-rose-400 mt-1 font-medium">{descriptionError}</p>
            )}
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Category *
            </label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_CATEGORIES.map((cat) => {
                const isSelected = cat.name.toLowerCase() === selectedCategory.toLowerCase();
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setSelectedCategory(cat.name)}
                    style={{
                      borderColor: isSelected ? cat.color : undefined,
                      backgroundColor: isSelected ? `${cat.color}25` : undefined,
                    }}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-2 text-white scale-102 shadow-xs'
                        : 'border-slate-800 bg-[#0B0F19] text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{cat.iconEmoji}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Date *
            </label>
            <div className="relative">
              <input
                type="date"
                value={toInputDateFormat(selectedDateMillis)}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDateMillis(fromInputDateFormat(e.target.value));
                  }
                }}
                className="w-full px-4 py-3 rounded-2xl border border-slate-800 bg-[#0B0F19] text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Optional Note / Breakdown
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Lunch with friends or scanned item details"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-800 bg-[#0B0F19] text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#0B0F19]/60 border-t border-slate-800 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl text-sm font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            {initialExpense ? 'Update Expense' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  );
};
