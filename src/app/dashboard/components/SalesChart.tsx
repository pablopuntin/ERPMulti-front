"use client";

import { BarChart3, TrendingUp } from "lucide-react";

interface SalesData {
  day: string;
  sales: number;
  orders: number;
}

interface SalesChartProps {
  data?: SalesData[];
}

export default function SalesChart({ data }: SalesChartProps) {
  const salesData = data || [];
  const maxSales = salesData.length ? Math.max(...salesData.map(d => d.sales)) : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Ventas de la Semana
          </h3>
          <p className="text-sm text-muted-foreground">
            Últimos 7 días
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <span className="text-sm font-medium text-green-600">
            +15.3%
          </span>
        </div>
      </div>

      {/* Simple bar chart using divs */}
      <div className="space-y-4">
        {salesData.length > 0 ? (
          <div className="flex items-end justify-between h-48 px-2">
            {salesData.map((data, index) => (
              <div
                key={index}
                className="flex flex-col items-center flex-1 mx-1"
              >
                <div className="relative w-full flex flex-col items-center">
                  <div
                    className="w-full bg-primary/80 rounded-t-lg hover:bg-primary transition-colors duration-200"
                    style={{
                      height: `${maxSales > 0 ? (data.sales / maxSales) * 100 : 0}%`,
                      minHeight: "4px"
                    }}
                  />
                  <span className="text-xs text-muted-foreground mt-2 font-medium">
                    {data.day}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No hay datos de ventas para mostrar.
          </div>
        )}
        
        {/* Legend */}
        <div className="flex items-center justify-center space-x-6 pt-4 border-t border-border">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-primary/80 rounded" />
            <span className="text-xs text-muted-foreground">Ventas</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Total: ${salesData.reduce((sum, d) => sum + d.sales, 0).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
