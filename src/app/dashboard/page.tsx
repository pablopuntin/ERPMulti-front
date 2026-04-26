"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp,
  AlertTriangle
} from "lucide-react";
import MetricCard from "./components/MetricCard";
import RecentActivity from "./components/RecentActivity";
import OperationalAlerts from "./components/OperationalAlerts";
import SalesChart from "./components/SalesChart";
import { useDashboardData } from "./hooks/useDashboardData";
import { useAuth } from "@/components/auth/AuthContext";

export default function DashboardHome() {
  const router = useRouter();
  const { user, isSellerOnly, canAccessAllBranches } = useAuth();
  const activeBranchId = user?.activeBranchId || user?.branchId || "";
  const isGlobalUser = canAccessAllBranches();
  const resolvedBranchId = activeBranchId;
  const shouldLoadDashboard = Boolean(resolvedBranchId);

  const { kpis, salesData, recentActivity, operationalAlerts, loading, error, refreshData } = useDashboardData(
    resolvedBranchId || undefined,
    shouldLoadDashboard,
  );

  useEffect(() => {
    if (isSellerOnly()) {
      router.replace('/dashboard/sales');
    }
  }, [isSellerOnly, router]);

  const getIcon = (title: string) => {
    switch (title) {
      case "Ventas del Día":
        return DollarSign;
      case "Caja actual":
        return DollarSign;
      case "Pendientes de entrega":
        return ShoppingCart;
      case "Stock crítico":
        return AlertTriangle;
      default:
        return TrendingUp;
    }
  };

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Panel de Administración
          </h1>
          <p className="text-muted-foreground mt-1">
            Bienvenido a Electrotec - Gestión Integral de la sucursal activa
          </p>
        </div>
      </div>

      {isGlobalUser && !resolvedBranchId && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">Seleccioná una sucursal activa desde la barra superior</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Para usuarios globales, el panel necesita una sucursal concreta para mostrar caja actual, ventas del día y pendientes de entrega.
          </p>
        </div>
      )}

      {resolvedBranchId && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Mostrando información operativa según la <span className="font-medium text-foreground">sucursal activa</span> seleccionada en la barra superior.
        </div>
      )}

      {!shouldLoadDashboard ? null : (
        <>
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Error de Conexión</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button 
                onClick={refreshData}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reintentar
              </button>
            </div>
          ) : loading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded mb-4"></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted rounded"></div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, index) => {
                  const Icon = getIcon(kpi.title);
                  
                  return (
                    <MetricCard
                      key={index}
                      title={kpi.title}
                      value={kpi.value}
                      change={kpi.change}
                      changeType={kpi.changeType}
                      icon={Icon}
                      description={kpi.description}
                    />
                  );
                })}
              </div>

              <SalesChart data={salesData} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentActivity activities={recentActivity} />
                <OperationalAlerts alerts={operationalAlerts} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
