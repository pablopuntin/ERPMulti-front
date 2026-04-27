import { useState, useEffect } from 'react';
import { cashAPI, ordersAPI, reportsAPI } from '@/services/api';

const withFallback = async <T,>(request: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await request;
  } catch (error) {
    console.error('Dashboard fallback activated:', error);
    return fallback;
  }
};

export interface DashboardKPI {
  title: string;
  value: string | number;
  change?: number;
  changeType?: "increase" | "decrease" | "neutral";
  description?: string;
}

export interface SalesData {
  day: string;
  sales: number;
  orders: number;
}

export interface ActivityItem {
  id: string;
  type: "sale" | "stock" | "payment" | "alert";
  title: string;
  description: string;
  time: string;
  amount?: string;
}

export interface OperationalAlertItem {
  id: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  count?: number;
}

export const useDashboardData = (branchId?: string, enabled = true) => {
  const [kpis, setKpis] = useState<DashboardKPI[]>([]);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [operationalAlerts, setOperationalAlerts] = useState<OperationalAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    if (!enabled || !branchId) {
      setKpis([]);
      setSalesData([]);
      setRecentActivity([]);
      setOperationalAlerts([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];

      // Cargar datos reales del backend usando endpoints de reports
      const [dailySummary, cashMovements, stockSummary, currentRegister, pendingDeliveries] = await Promise.all([
        reportsAPI.getDailySummary(undefined, branchId),
        reportsAPI.getCashMovements({ from: today, branchId }),
        withFallback(reportsAPI.getStockSummary({ order: 'desc', branchId }), []),
        cashAPI.getCurrentRegister(branchId),
        ordersAPI.getPendingDeliveries(branchId ? { branchId } : undefined),
      ]);

      const incomeMovements = Array.isArray(cashMovements)
        ? cashMovements.filter((movement: any) => movement.type === 'income')
        : [];
      const expenseMovements = Array.isArray(cashMovements)
        ? cashMovements.filter((movement: any) => movement.type === 'expense')
        : [];
      const totalIncome = incomeMovements.reduce((sum: number, movement: any) => sum + Number(movement.amount || 0), 0);
      const totalExpense = expenseMovements.reduce((sum: number, movement: any) => sum + Number(movement.amount || 0), 0);

      const stockItems = Array.isArray(stockSummary) ? stockSummary : [];
      const noStockCount = stockItems.filter((item: any) => Number(item.totalStock || 0) <= 0).length;
      const lowStockCount = stockItems.filter((item: any) => {
        const totalStock = Number(item.totalStock || 0);
        return totalStock > 0 && totalStock < 10;
      }).length;
      const criticalStockCount = noStockCount + lowStockCount;

      const pendingDeliveryOrders = Array.isArray(pendingDeliveries) ? pendingDeliveries : [];
      const registerMovements = Array.isArray(currentRegister?.movements)
        ? currentRegister.movements
        : [];
      const registerIncome = registerMovements.reduce((sum: number, movement: any) => {
        return movement.type === 'income'
          ? sum + Number(movement.amount || 0)
          : sum;
      }, 0);
      const registerExpense = registerMovements.reduce((sum: number, movement: any) => {
        return movement.type === 'expense'
          ? sum + Number(movement.amount || 0)
          : sum;
      }, 0);
      const registerBalance = Number(currentRegister?.openingBalance || 0) + registerIncome - registerExpense;

      // Procesar KPIs desde los datos reales
      const processedKPIs: DashboardKPI[] = [
        {
          title: "Ventas del Día",
          value: dailySummary.totalIncome ? `$${dailySummary.totalIncome.toLocaleString()}` : "$0",
          change: dailySummary.incomeChange || 0,
          changeType: dailySummary.incomeChange > 0 ? "increase" : dailySummary.incomeChange < 0 ? "decrease" : "neutral",
          description: `${dailySummary.ordersCount || 0} órdenes`
        },
        {
          title: "Caja actual",
          value: `$${registerBalance.toLocaleString('es-AR')}`,
          description: `Ingresó: $${totalIncome.toLocaleString('es-AR')}\nEgresó: $${totalExpense.toLocaleString('es-AR')}`
        },
        {
          title: "Stock crítico",
          value: criticalStockCount,
          description: `${noStockCount} sin stock\n${lowStockCount} bajos`
        },
        {
          title: "Pendientes de entrega",
          value: pendingDeliveryOrders.length,
          description: "Remitos con entrega pendiente"
        }
      ];

      setKpis(processedKPIs);

      // Procesar datos de ventas (simulados por ahora hasta tener endpoint específico)
      setSalesData([
        { day: "Lun", sales: 12500, orders: 15 },
        { day: "Mar", sales: 18900, orders: 22 },
        { day: "Mié", sales: 15700, orders: 18 },
        { day: "Jue", sales: 22100, orders: 28 },
        { day: "Vie", sales: 28900, orders: 35 },
        { day: "Sáb", sales: 31200, orders: 42 },
        { day: "Dom", sales: 19800, orders: 24 },
      ]);

      // Procesar actividad reciente desde movimientos de caja
      const processedActivity: ActivityItem[] = cashMovements.slice(0, 5).map((movement: any, index: number) => ({
        id: movement.id || index.toString(),
        type: movement.type === 'income' ? 'payment' : 'expense',
        title: movement.type === 'income' ? 'Ingreso' : 'Egreso',
        description: movement.description || movement.reason || movement.concept || 'Movimiento de caja',
        time: movement.date && movement.date !== 'Invalid Date' 
          ? new Date(movement.date).toLocaleString('es-AR', { 
              hour: '2-digit', 
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit'
            })
          : 'Sin fecha',
        amount: `$${Number(movement.amount || 0).toLocaleString('es-AR')}`
      }));

      setRecentActivity(processedActivity);

      const processedAlerts: OperationalAlertItem[] = [
        {
          id: 'no-stock',
          title: 'Productos sin stock',
          description: noStockCount > 0
            ? `${noStockCount} producto(s) están sin stock y requieren revisión.`
            : 'No hay productos totalmente agotados en este momento.',
          severity: noStockCount > 0 ? 'high' : 'low',
          count: noStockCount,
        },
        {
          id: 'low-stock',
          title: 'Productos con stock bajo',
          description: lowStockCount > 0
            ? `${lowStockCount} producto(s) quedaron con stock por debajo del mínimo operativo.`
            : 'No hay productos con stock bajo para revisar ahora.',
          severity: lowStockCount > 0 ? 'medium' : 'low',
          count: lowStockCount,
        },
        {
          id: 'pending-deliveries',
          title: 'Remitos con entrega pendiente',
          description: pendingDeliveryOrders.length > 0
            ? `${pendingDeliveryOrders.length} remito(s) todavía tienen entregas pendientes.`
            : 'No hay remitos con entregas pendientes.',
          severity: pendingDeliveryOrders.length > 0 ? 'medium' : 'low',
          count: pendingDeliveryOrders.length,
        },
      ];

      setOperationalAlerts(processedAlerts);

    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError('Error al cargar los datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [branchId, enabled]);

  return {
    kpis,
    salesData,
    recentActivity,
    operationalAlerts,
    loading,
    error,
    refreshData: loadDashboardData
  };
};
