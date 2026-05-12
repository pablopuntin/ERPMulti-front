import React from 'react';
import { Building2, Truck, Warehouse } from 'lucide-react';

interface StockByBranch {
  branchId: string | null;
  branchName: string | null;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  minStock?: number;
  isLowStock: boolean;
  locationType?: string;
  locationLabel?: string;
}

interface StockDisplayProps {
  stocks: StockByBranch[];
  compact?: boolean;
}

export const StockDisplay: React.FC<StockDisplayProps> = ({ 
  stocks, 
  compact = false 
}) => {
  const visibleStocks = stocks.filter((stock) => Number(stock.quantity || 0) > 0 || Number(stock.availableQuantity || 0) > 0 || Number(stock.reservedQuantity || 0) > 0);

  const resolvedStocks = visibleStocks.length > 0 ? visibleStocks : stocks;

  const getLabel = (stock: StockByBranch) => {
    if (stock.locationLabel) return stock.locationLabel;
    if (stock.branchName) return stock.branchName;
    
    switch (stock.locationType) {
      case 'warehouse': return 'Depósito';
      case 'transit': return 'Tránsito';
      default: return 'Sucursal';
    }
  };

  const getLocationIcon = (stock: StockByBranch) => {
    switch (stock.locationType) {
      case 'warehouse': return <Warehouse className="w-3.5 h-3.5" />;
      case 'transit': return <Truck className="w-3.5 h-3.5" />;
      default: return <Building2 className="w-3.5 h-3.5" />;
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {resolvedStocks.map((stock, index) => (
          <div
            key={`${stock.locationType || 'branch'}-${stock.branchId || stock.locationLabel || index}`}
            className={`inline-flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1 text-xs ${stock.isLowStock
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
              : 'border-border bg-muted/30 text-foreground'
            }`}
          >
            <div className="flex items-center gap-1">
              <span title={stock.locationType}>
                {getLocationIcon(stock)}
              </span>
              <span className="max-w-[80px] truncate font-medium">
                {getLabel(stock)}
              </span>
            </div>
            <span className={`text-center font-bold ${stock.isLowStock
              ? 'text-amber-100'
              : 'text-emerald-100'
            }`}>
              {stock.availableQuantity}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {resolvedStocks.map((stock, index) => (
        <div
          key={`${stock.locationType || 'branch'}-${stock.branchId || stock.locationLabel || index}`}
          className={`rounded-lg border px-3 py-2 ${stock.isLowStock ? 'border-amber-500/40 bg-amber-500/10' : 'border-border bg-muted/30'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span title={stock.locationType}>
                {getLocationIcon(stock)}
              </span>
              <span className="text-sm font-medium text-foreground truncate">
                {getLabel(stock)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stock.isLowStock 
                ? 'bg-amber-400/20 text-amber-100' 
                : 'bg-emerald-400/15 text-emerald-100'
              }`}>
                {stock.availableQuantity} disp.
              </span>
            </div>
          </div>
          {(stock.reservedQuantity > 0 || stock.isLowStock) && (
            <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
              {stock.reservedQuantity > 0 && (
                <span className="text-muted-foreground">
                  {stock.reservedQuantity} res. de {stock.quantity}
                </span>
              )}
              {stock.isLowStock && (
                <span className="text-amber-200">
                  &#9888; Mín: {stock.minStock || 5}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
