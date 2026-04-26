"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  type LucideIcon,
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Package,
  FileText,
  Filter,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";
import { branchesAPI, reportsAPI } from "@/services/api";

interface ReportSummary {
  title: string;
  value: string;
  change: number;
  changeType: "increase" | "decrease";
  icon: LucideIcon;
}

interface ReportPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface BranchOption {
  id: string;
  name: string;
}

interface FinanceReport {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  from?: string;
  to?: string;
  branchId?: string;
}

interface CashMovementReport {
  id: string;
  description: string;
  createdAt: string;
  type: "income" | "expense";
  amount: number;
  sellerName?: string;
}

interface SalesProductRow {
  productId: string;
  productName: string;
  productSku?: string;
  categoryName?: string;
  brandName?: string;
  totalUnits: number;
  totalRevenue: number;
  averagePrice: number;
  marginPercentage?: number;
}

interface SalesCategoryRow {
  categoryId: string;
  categoryName: string;
  totalUnits: number;
  totalRevenue: number;
  averagePrice: number;
  ordersCount: number;
}

interface SalesBrandRow {
  brandId: string;
  brandName: string;
  totalUnits: number;
  totalRevenue: number;
  averagePrice: number;
  ordersCount: number;
}

type SalesRow = SalesProductRow | SalesCategoryRow | SalesBrandRow;

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);

const buildRecentReportPeriods = (): ReportPeriod[] => {
  const now = new Date();

  return Array.from({ length: 3 }, (_, index) => {
    const baseDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const endDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);

    return {
      id: String(index + 1),
      name: baseDate.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
      startDate: formatDateInput(startDate),
      endDate: formatDateInput(endDate),
    };
  });
};

const reportPeriods = buildRecentReportPeriods();

export default function ReportsPage() {
  const { user, canAccessAllBranches } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<string>("1");
  const [reportType, setReportType] = useState<"sales" | "products" | "categories" | "brands" | "financial">("sales");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [financeReport, setFinanceReport] = useState<FinanceReport | null>(null);
  const [cashMovements, setCashMovements] = useState<CashMovementReport[]>([]);
  const [salesData, setSalesData] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedPeriodData = useMemo(
    () => reportPeriods.find((period) => period.id === selectedPeriod) || reportPeriods[0],
    [selectedPeriod],
  );
  const activeBranchId = user?.activeBranchId || user?.branchId;
  const canViewReports = user?.role === 'root' || user?.role === 'gerente_general' || user?.role === 'gerente_sucursal';
  const activeBranchName = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId)?.name || 'Sucursal activa',
    [branches, activeBranchId],
  );
  const selectedBranchLabel = useMemo(() => {
    if (selectedBranchId === "all") {
      return "Todas las sucursales";
    }

    return branches.find((branch) => branch.id === selectedBranchId)?.name || activeBranchName;
  }, [branches, selectedBranchId, activeBranchName]);
  const isCustomDateActive = Boolean(selectedDate);
  const activeRangeLabel = isCustomDateActive
    ? `Fecha puntual: ${selectedDate}`
    : `${selectedPeriodData.name} (${selectedPeriodData.startDate} - ${selectedPeriodData.endDate})`;

  useEffect(() => {
    if (canAccessAllBranches() && activeBranchId) {
      setSelectedBranchId((current) => (current === "all" ? activeBranchId : current));
    }
  }, [activeBranchId, canAccessAllBranches]);

  useEffect(() => {
    const loadBranches = async () => {
      if (!canAccessAllBranches()) {
        return;
      }

      try {
        const data = await branchesAPI.getAll();
        setBranches(
          Array.isArray(data)
            ? data
                .filter(
                  (branch): branch is BranchOption =>
                    typeof branch?.id === "string" && typeof branch?.name === "string",
                )
                .map((branch) => ({ id: branch.id, name: branch.name }))
            : [],
        );
      } catch {
        setBranches([]);
      }
    };

    loadBranches();
  }, [canAccessAllBranches]);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);

      try {
        const branchId = canAccessAllBranches()
          ? selectedBranchId !== "all"
            ? selectedBranchId
            : undefined
          : activeBranchId;

        const rangeParams = selectedDate
          ? { from: selectedDate, to: selectedDate, branchId }
          : {
              from: selectedPeriodData.startDate,
              to: selectedPeriodData.endDate,
              branchId,
            };

        // Load base financial data for summary cards
        const [financeData, movementsData] = await Promise.all([
          selectedDate
            ? reportsAPI.getDailySummary(selectedDate, branchId)
            : reportsAPI.getFinanceReport(rangeParams),
          reportsAPI.getCashMovements(rangeParams),
        ]);

        const normalizedMovements = Array.isArray(movementsData) ? movementsData : [];

        setFinanceReport(financeData);
        setCashMovements(normalizedMovements);

        // Load specific data based on selected report type
        let nextSalesData: SalesRow[] = [];
        switch (reportType) {
          case "sales":
          case "products":
            nextSalesData = await reportsAPI.getSalesByProducts(rangeParams) as SalesProductRow[];
            break;
          case "categories":
            nextSalesData = await reportsAPI.getSalesByCategories(rangeParams) as SalesCategoryRow[];
            break;
          case "brands":
            nextSalesData = await reportsAPI.getSalesByBrands(rangeParams) as SalesBrandRow[];
            break;
          case "financial":
            nextSalesData = [];
            break;
        }

        setSalesData(Array.isArray(nextSalesData) ? nextSalesData : []);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [selectedPeriod, selectedDate, selectedBranchId, activeBranchId, user?.hasAllBranchAccess, reportType]);

  if (!canViewReports) {
    return (
      <div className="w-full px-4 py-6 space-y-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h1 className="text-3xl font-bold text-foreground">Reportes y Análisis</h1>
          <p className="text-muted-foreground mt-2">Esta sección está disponible solo para gerencias y usuarios root.</p>
        </div>
      </div>
    );
  }

  const reportSummaries: ReportSummary[] = useMemo(() => {
    const totalIncome = Number(financeReport?.totalIncome || 0);
    const totalExpense = Number(financeReport?.totalExpense || 0);
    const balance = Number(financeReport?.balance || 0);

    return [
      {
        title: "Ingresos",
        value: `$${totalIncome.toLocaleString('es-AR')}`,
        change: 0,
        changeType: "increase",
        icon: DollarSign,
      },
      {
        title: "Egresos",
        value: `$${totalExpense.toLocaleString('es-AR')}`,
        change: 0,
        changeType: "decrease",
        icon: TrendingDown,
      },
      {
        title: "Balance",
        value: `$${balance.toLocaleString('es-AR')}`,
        change: 0,
        changeType: balance >= 0 ? "increase" : "decrease",
        icon: TrendingUp,
      },
      {
        title: "Movimientos",
        value: `${cashMovements.length}`,
        change: 0,
        changeType: "increase",
        icon: FileText,
      },
    ];
  }, [financeReport, cashMovements]);

  const isProductView = reportType === "sales" || reportType === "products";
  const productRows = (isProductView ? salesData : []) as SalesProductRow[];
  const categoryRows = (reportType === "categories" ? salesData : []) as SalesCategoryRow[];
  const brandRows = (reportType === "brands" ? salesData : []) as SalesBrandRow[];

  const getCsvContent = () => {
    if (reportType === "financial") {
      const headers = ["Fecha", "Descripcion", "Tipo", "Monto", "Vendedor"];
      const rows = cashMovements.map((movement) => [
        new Date(movement.createdAt).toLocaleDateString("es-AR"),
        movement.description,
        movement.type === "income" ? "Ingreso" : "Egreso",
        String(movement.amount),
        movement.sellerName || "",
      ]);
      return [headers, ...rows];
    }

    if (reportType === "categories") {
      const headers = ["Categoria", "Unidades", "Ingresos", "Promedio", "Pedidos"];
      const rows = categoryRows.map((item) => [
        item.categoryName,
        String(item.totalUnits),
        String(item.totalRevenue),
        String(item.averagePrice),
        String(item.ordersCount),
      ]);
      return [headers, ...rows];
    }

    if (reportType === "brands") {
      const headers = ["Marca", "Unidades", "Ingresos", "Promedio", "Pedidos"];
      const rows = brandRows.map((item) => [
        item.brandName,
        String(item.totalUnits),
        String(item.totalRevenue),
        String(item.averagePrice),
        String(item.ordersCount),
      ]);
      return [headers, ...rows];
    }

    const headers = ["Producto", "SKU", "Categoria", "Marca", "Unidades", "Precio Promedio", "Total", "Margen %"];
    const rows = productRows.map((item) => [
      item.productName,
      item.productSku || "",
      item.categoryName || "",
      item.brandName || "",
      String(item.totalUnits),
      String(item.averagePrice),
      String(item.totalRevenue),
      item.marginPercentage !== undefined ? String(item.marginPercentage) : "",
    ]);
    return [headers, ...rows];
  };

  const getSalesRowKey = (item: SalesRow) => {
    if ("productId" in item) {
      return item.productId;
    }
    if ("categoryId" in item) {
      return item.categoryId;
    }
    return item.brandId;
  };

  const getSalesRowName = (item: SalesRow) => {
    if ("productName" in item) {
      return item.productName;
    }
    if ("categoryName" in item) {
      return item.categoryName;
    }
    return item.brandName;
  };

  const getSalesRowSku = (item: SalesRow) => ("productSku" in item ? item.productSku || "-" : "-");

  const getSalesRowCategoryLabel = (item: SalesRow) => {
    if ("productName" in item) {
      return item.categoryName || "-";
    }
    if ("categoryName" in item) {
      return item.categoryName;
    }
    return "-";
  };

  const getSalesRowBrandLabel = (item: SalesRow) => {
    if ("brandName" in item) {
      return item.brandName || "-";
    }
    return "-";
  };

  const getSalesRowMargin = (item: SalesRow) => ("marginPercentage" in item ? item.marginPercentage : undefined);

  const handleExportReport = (format: "pdf" | "excel" | "csv") => {
    if (format !== "csv") {
      window.alert("Por ahora está habilitada la exportación CSV. PDF/Excel quedan para la siguiente iteración.");
      return;
    }

    const csvRows = getCsvContent();
    if (csvRows.length <= 1) {
      window.alert("No hay datos para exportar con los filtros actuales.");
      return;
    }

    const csv = csvRows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const branchLabel = canAccessAllBranches() ? selectedBranchId : activeBranchId || "branch";
    const periodLabel = selectedDate || `${selectedPeriodData.startDate}_${selectedPeriodData.endDate}`;
    link.href = url;
    link.download = `reporte-${reportType}-${branchLabel}-${periodLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const getChangeIcon = (changeType: "increase" | "decrease") => {
    return changeType === "increase" ? ArrowUpRight : ArrowDownRight;
  };

  const getChangeColor = (changeType: "increase" | "decrease") => {
    return changeType === "increase" ? "text-green-600" : "text-red-600";
  };

  const handlePeriodChange = (value: string) => {
    setSelectedDate("");
    setSelectedPeriod(value);
  };

  const handleDateChange = (value: string) => {
    setSelectedDate(value);
  };

  return (
    <div className="w-full px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Reportes y Análisis
          </h1>
          <p className="text-muted-foreground mt-1">
            {canAccessAllBranches()
              ? 'Analizá el rendimiento tomando la sucursal activa como contexto operativo y definiendo abajo el alcance del reporte.'
              : `Visualiza y analiza el rendimiento de ${activeBranchName}.`}
          </p>
        </div>
        <div className="flex space-x-2 mt-4 sm:mt-0">
          <Button variant="outline" onClick={() => handleExportReport("pdf")}>
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button onClick={() => handleExportReport("csv")}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="bg-card border border-border rounded-xl p-4">
        {canAccessAllBranches() && (
          <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Sucursal activa:</span> {activeBranchName}. Este selector local define el <span className="font-medium text-foreground">alcance analítico</span> del reporte, sin cambiar la sucursal operativa del sistema.
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-4">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                disabled={isCustomDateActive}
                className="px-3 py-2 border border-border rounded-lg bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reportPeriods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.startDate} - {period.endDate})
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted-foreground">
                {isCustomDateActive ? 'Período deshabilitado mientras haya una fecha puntual seleccionada' : activeRangeLabel}
              </span>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-background text-foreground"
              aria-label="Seleccionar fecha puntual"
            />
            {selectedDate && (
              <Button variant="outline" size="sm" onClick={() => setSelectedDate("")}>
                Limpiar fecha
              </Button>
            )}
            {canAccessAllBranches() && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Alcance del reporte
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  aria-label="Seleccionar alcance del reporte"
                >
                  <option value="all">Todas las sucursales</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!canAccessAllBranches() && activeBranchId && (
              <div className="px-3 py-2 border border-border rounded-lg bg-muted/40 text-sm text-foreground">
                Sucursal: {activeBranchName}
              </div>
            )}
          </div>
          <div className="flex space-x-2 mt-4 sm:mt-0">
            <Button 
              variant={reportType === "sales" ? "default" : "outline"}
              size="sm"
              onClick={() => setReportType("sales")}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Ventas
            </Button>
            <Button 
              variant={reportType === "products" ? "default" : "outline"}
              size="sm"
              onClick={() => setReportType("products")}
            >
              <Package className="w-4 h-4 mr-2" />
              Productos
            </Button>
            <Button 
              variant={reportType === "categories" ? "default" : "outline"}
              size="sm"
              onClick={() => setReportType("categories")}
            >
              <Package className="w-4 h-4 mr-2" />
              Categorías
            </Button>
            <Button 
              variant={reportType === "brands" ? "default" : "outline"}
              size="sm"
              onClick={() => setReportType("brands")}
            >
              <Package className="w-4 h-4 mr-2" />
              Marcas
            </Button>
            <Button 
              variant={reportType === "financial" ? "default" : "outline"}
              size="sm"
              onClick={() => setReportType("financial")}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Financiero
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reportSummaries.map((summary, index) => {
          const Icon = summary.icon;
          const ChangeIcon = getChangeIcon(summary.changeType);
          
          return (
            <div key={index} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">
                    {summary.title}
                  </p>
                  <p className="text-2xl font-bold text-foreground mb-2">
                    {summary.value}
                  </p>
                  <div className={`flex items-center text-sm ${getChangeColor(summary.changeType)}`}>
                    <ChangeIcon className="w-4 h-4 mr-1" />
                    <span>{Math.abs(summary.change)}%</span>
                    <span className="ml-1">{loading ? 'actualizando' : 'período actual'}</span>
                  </div>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Alcance actual del reporte: <span className="font-medium text-foreground">{selectedBranchLabel}</span>.
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(reportType === "sales" || reportType === "products") && (
          <>
            {/* Top Products */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Productos Más Vendidos
                </h3>
                <Package className="w-5 h-5 text-muted-foreground" />
              </div>
              
              <div className="space-y-3">
                {productRows.slice(0, 10).map((item) => (
                  <div key={item.productId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{item.productName}</div>
                      <div className="text-sm text-muted-foreground">{item.productSku}</div>
                      {item.categoryName && (
                        <div className="text-xs text-muted-foreground">{item.categoryName}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-foreground">{item.totalUnits} u</div>
                      <div className="text-sm text-muted-foreground">${item.totalRevenue.toLocaleString('es-AR')}</div>
                      {item.marginPercentage !== undefined && (
                        <div className={`text-xs ${item.marginPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {item.marginPercentage.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {salesData.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No hay datos de ventas para este período
                  </div>
                )}
              </div>
            </div>

            {/* Sales by Category */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Resumen por Categoría
                </h3>
                <PieChart className="w-5 h-5 text-muted-foreground" />
              </div>
              
              <div className="space-y-3">
                {Array.from(new Set(productRows.map((item) => item.categoryName).filter(Boolean)))
                  .slice(0, 8)
                  .map((categoryName) => {
                    const categoryData = productRows.filter((item) => item.categoryName === categoryName);
                    const totalUnits = categoryData.reduce((sum, item) => sum + item.totalUnits, 0);
                    const totalRevenue = categoryData.reduce((sum, item) => sum + item.totalRevenue, 0);
                    
                    return (
                      <div key={categoryName} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="font-medium text-foreground">{categoryName}</div>
                        <div className="text-right">
                          <div className="font-semibold text-foreground">{totalUnits} u</div>
                          <div className="text-sm text-muted-foreground">${totalRevenue.toLocaleString('es-AR')}</div>
                        </div>
                      </div>
                    );
                  })}
                {salesData.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No hay datos de ventas para este período
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {reportType === "categories" && (
          <>
            {/* Categories Chart */}
            <div className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Ventas por Categoría
                </h3>
                <PieChart className="w-5 h-5 text-muted-foreground" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryRows.map((item) => (
                  <div key={item.categoryId} className="p-4 bg-muted/30 rounded-lg">
                    <div className="font-medium text-foreground mb-2">{item.categoryName}</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Unidades:</span>
                        <span className="font-semibold">{item.totalUnits}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Ingresos:</span>
                        <span className="font-semibold">${item.totalRevenue.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pedidos:</span>
                        <span className="font-semibold">{item.ordersCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {salesData.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No hay datos de categorías para este período
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {reportType === "brands" && (
          <>
            {/* Brands Chart */}
            <div className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Ventas por Marca
                </h3>
                <BarChart3 className="w-5 h-5 text-muted-foreground" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brandRows.map((item) => (
                  <div key={item.brandId} className="p-4 bg-muted/30 rounded-lg">
                    <div className="font-medium text-foreground mb-2">{item.brandName}</div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Unidades:</span>
                        <span className="font-semibold">{item.totalUnits}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Ingresos:</span>
                        <span className="font-semibold">${item.totalRevenue.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Pedidos:</span>
                        <span className="font-semibold">{item.ordersCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {salesData.length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    No hay datos de marcas para este período
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {reportType === "financial" && (
          <>
            {/* Cash Flow */}
            <div className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Movimientos Financieros
                </h3>
                <DollarSign className="w-5 h-5 text-muted-foreground" />
              </div>
              
              <div className="space-y-3">
                {cashMovements.slice(0, 10).map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{movement.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(movement.createdAt).toLocaleDateString('es-AR')}
                      </div>
                      {movement.sellerName && (
                        <div className="text-xs text-muted-foreground">
                          Vendedor: {movement.sellerName}
                        </div>
                      )}
                    </div>
                    <div className={`font-semibold ${
                      movement.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {movement.type === 'income' ? '+' : '-'}${movement.amount.toLocaleString('es-AR')}
                    </div>
                  </div>
                ))}
                {cashMovements.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No hay movimientos financieros para este período
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Detailed Report Table */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">
            {reportType === "financial" ? "Detalle de Movimientos" : "Detalle de Ventas"}
          </h3>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtrar
            </Button>
            <Button variant="outline" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Ver Detalle
            </Button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              {reportType === "financial" ? (
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Fecha</th>
                  <th className="text-left p-3 font-medium text-foreground">Descripción</th>
                  <th className="text-left p-3 font-medium text-foreground">Tipo</th>
                  <th className="text-left p-3 font-medium text-foreground">Monto</th>
                  <th className="text-left p-3 font-medium text-foreground">Vendedor</th>
                </tr>
              ) : (
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Producto</th>
                  <th className="text-left p-3 font-medium text-foreground">SKU</th>
                  <th className="text-left p-3 font-medium text-foreground">Categoría</th>
                  <th className="text-left p-3 font-medium text-foreground">Marca</th>
                  <th className="text-left p-3 font-medium text-foreground">Unidades</th>
                  <th className="text-left p-3 font-medium text-foreground">Precio Unit.</th>
                  <th className="text-left p-3 font-medium text-foreground">Total</th>
                  <th className="text-left p-3 font-medium text-foreground">Margen</th>
                </tr>
              )}
            </thead>
            <tbody>
              {reportType === "financial" ? (
                cashMovements.slice(0, 20).map((movement) => (
                  <tr key={movement.id} className="border-t border-border hover:bg-muted/50">
                    <td className="p-3 text-muted-foreground">
                      {new Date(movement.createdAt).toLocaleDateString('es-AR')}
                    </td>
                    <td className="p-3 text-foreground">{movement.description}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        movement.type === 'income' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {movement.type === 'income' ? 'Ingreso' : 'Egreso'}
                      </span>
                    </td>
                    <td className={`p-3 font-semibold ${
                      movement.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {movement.type === 'income' ? '+' : '-'}${movement.amount.toLocaleString('es-AR')}
                    </td>
                    <td className="p-3 text-muted-foreground text-sm">
                      {movement.sellerName || '-'}
                    </td>
                  </tr>
                ))
              ) : (
                salesData.slice(0, 20).map((item) => (
                  <tr key={getSalesRowKey(item)} className="border-t border-border hover:bg-muted/50">
                    <td className="p-3 text-foreground font-medium">
                      {getSalesRowName(item)}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {getSalesRowSku(item)}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {getSalesRowCategoryLabel(item)}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {getSalesRowBrandLabel(item)}
                    </td>
                    <td className="p-3 text-foreground">
                      {item.totalUnits?.toLocaleString('es-AR') || '-'}
                    </td>
                    <td className="p-3 text-foreground">
                      ${item.averagePrice?.toLocaleString('es-AR') || '-'}
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      ${item.totalRevenue?.toLocaleString('es-AR') || '-'}
                    </td>
                    <td className="p-3">
                      {getSalesRowMargin(item) !== undefined ? (
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          (getSalesRowMargin(item) || 0) >= 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {(getSalesRowMargin(item) || 0).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
              {((reportType === "financial" ? cashMovements : salesData).length === 0) && (
                <tr className="border-t border-border">
                  <td colSpan={reportType === "financial" ? 5 : 8} className="p-6 text-center text-muted-foreground">
                    {loading ? 'Cargando datos...' : 'No hay datos para el período seleccionado'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
