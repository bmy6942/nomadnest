'use client';
import { useState } from 'react';
import { formatPrice } from '@/lib/utils';

interface Props {
  price: number;       // 月租金
  deposit: number;     // 押金（月數）
  minRent: number;     // 最短租期（月）
  maxRent: number;     // 最長租期（月）
  includedFees: string[]; // 已含費用
}

export default function RentCalculator({ price, deposit, minRent, maxRent, includedFees }: Props) {
  const [months, setMonths] = useState(minRent);
  const [open, setOpen] = useState(false);

  const depositAmount  = price * deposit;
  const serviceFee     = Math.round(price / 2);
  const totalRent      = price * months;
  const firstMonthTotal = price + depositAmount + serviceFee;
  const grandTotal     = totalRent + depositAmount + serviceFee;

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 hover:text-blue-600 transition-colors">
        <span>🧮 租金試算</span>
        <span className="text-gray-400 text-xs">{open ? '▲ 收起' : '▼ 展開'}</span>
      </button>

      {open && (
        <div className="mt-3 bg-blue-50 rounded-xl p-4 space-y-3">
          {/* 租期滑桿 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-blue-800">租期</label>
              <span className="text-sm font-bold text-blue-700">{months} 個月</span>
            </div>
            <input
              type="range"
              min={minRent}
              max={maxRent}
              step={1}
              value={months}
              onChange={e => setMonths(parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>{minRent} 個月</span>
              <span>{maxRent} 個月</span>
            </div>
          </div>

          {/* 費用明細 */}
          <div className="bg-white rounded-xl p-3 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>月租金 × {months} 個月</span>
              <span className="font-medium">{formatPrice(totalRent)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>押金（{deposit} 個月）</span>
              <span className="font-medium">{formatPrice(depositAmount)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>平台媒合服務費</span>
              <span className="font-medium">{formatPrice(serviceFee)}</span>
            </div>
            {includedFees.length > 0 && (
              <div className="flex justify-between text-green-600 text-xs pt-1">
                <span>✓ 已含</span>
                <span>{includedFees.join('、')}</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-2">
              <div className="flex justify-between font-bold text-nomad-navy">
                <span>入住總費用</span>
                <span>{formatPrice(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>第一個月需付</span>
                <span>{formatPrice(firstMonthTotal)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            ＊試算僅供參考，實際費用依合約為準。服務費為半個月租金，押金入住後可退還。
          </p>
        </div>
      )}
    </div>
  );
}
