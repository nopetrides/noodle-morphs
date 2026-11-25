import { AlertTriangle, DollarSign, Sparkles, X } from 'lucide-react';
import {
  formatCurrency,
  type SaleValuation,
  type SaleWarningAnalysis,
} from '../game/economy';
import type { SnakeEntity } from '../game/types';

interface SellConfirmModalProps {
  snake: SnakeEntity;
  valuation: SaleValuation;
  warnings: SaleWarningAnalysis;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SellConfirmModal({
  snake,
  valuation,
  warnings,
  onCancel,
  onConfirm,
}: SellConfirmModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sell-confirm-title"
      data-testid="sell-confirm-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#110D0A]/85"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[#1E1914] border border-[#D8BC87]/35 shadow-2xl shadow-black/75 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="sell-confirm-title"
              className="font-display text-xl font-semibold text-[#F7F1E5]"
            >
              Sell {snake.name}?
            </h2>
            <p className="text-xs text-[#E4BE74] font-medium mt-0.5">
              {snake.phenotype.morphName}
              {snake.phenotype.hetGenes.length > 0
                ? ` · Het ${snake.phenotype.hetGenes.join(', ')}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel sale"
            className="p-1.5 rounded-lg text-[#BFB19E] hover:text-[#F5EFE4] hover:bg-[#2C241D] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Valuation breakdown */}
        <div className="rounded-xl bg-[#251F19] border border-[#D8BC87]/20 p-3.5 space-y-2 text-sm">
          <div className="flex items-center justify-between text-[#C8BAA5]">
            <span>Base valuation</span>
            <span className="font-mono-code tabular-nums">
              {formatCurrency(valuation.baseValue)}
            </span>
          </div>

          {valuation.isFirstSale && (
            <div
              data-testid="first-sale-bonus-banner"
              className="flex items-center justify-between text-[#F5CF7B] bg-[#3A2E1A]/80 border border-[#D9A754]/40 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                First Sale of Morph Bonus!
              </span>
              <span className="font-mono-code tabular-nums">
                +{formatCurrency(valuation.firstSaleBonus)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#D8BC87]/15 font-semibold text-[#F7F1E5]">
            <span>Total Payout</span>
            <span className="font-mono-code text-base text-[#90D4A8] tabular-nums">
              {formatCurrency(valuation.total)}
            </span>
          </div>
        </div>

        {/* Big Last-Two Warning Banner */}
        {warnings.hasWarning && (
          <div
            data-testid="sell-big-warning"
            className="rounded-xl bg-[#441E1B]/90 border-2 border-[#E06A5E] p-3.5 space-y-2"
          >
            <div className="flex items-center gap-2 text-[#FFB8B0] font-semibold text-sm">
              <AlertTriangle className="w-5 h-5 text-[#F07164] shrink-0" aria-hidden="true" />
              <span>Important Lineage Warning</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-xs text-[#F7D7D2]">
              {warnings.reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-[#2B241D] hover:bg-[#382F26] text-xs sm:text-sm font-medium text-[#EAE0CE] cursor-pointer"
          >
            Keep Snake
          </button>

          {warnings.canSell && (
            <button
              type="button"
              data-testid="confirm-sell-btn"
              onClick={onConfirm}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                warnings.hasWarning
                  ? 'bg-[#C94B40] hover:bg-[#DC5A4E] text-white'
                  : 'bg-[#4E8C64] hover:bg-[#5CA074] text-[#F8FFF9]'
              }`}
            >
              <DollarSign className="w-4 h-4" aria-hidden="true" />
              <span>
                {warnings.hasWarning
                  ? `Sell Anyway (${formatCurrency(valuation.total)})`
                  : `Confirm Sale (${formatCurrency(valuation.total)})`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
