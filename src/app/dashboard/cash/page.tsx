"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Plus,
  Search,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  BanknoteIcon
} from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/components/auth/AuthContext";
import { branchesAPI, cashAPI, ordersAPI } from "@/services/api";
import CashQueuePanel, { CashQueueOrder } from "./components/CashQueuePanel";

interface BranchOption {
  id: string;
  name: string;
}

interface CashMovement {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  paymentMethod: "cash" | "transfer" | "card" | "mercadopago";
  category: string;
  date: string;
  reference?: string;
  sellerName?: string;
  customerName?: string;
}

interface CashRegister {
  id: string;
  date: string;
  openingBalance: number;
  closingBalance?: number;
  totalIncome: number;
  totalExpense: number;
  status: "open" | "closed";
  movements: CashMovement[];
}

interface OpenRegisterFormState {
  openingBalance: string;
}

interface CashMovementFormState {
  type: "income" | "expense";
  amount: string;
  reason: string;
}

export default function CashPage() {
  const { user, canAccessAllBranches } = useAuth();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null);
  const [cashQueue, setCashQueue] = useState<CashQueueOrder[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<CashQueueOrder[]>([]);
  const [pendingDeliveriesSearch, setPendingDeliveriesSearch] = useState("");
  const [queueError, setQueueError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [loading, setLoading] = useState(true);
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openForm, setOpenForm] = useState<OpenRegisterFormState>({ openingBalance: "0" });
  const [movementForm, setMovementForm] = useState<CashMovementFormState>({
    type: "income",
    amount: "",
    reason: "",
  });
  const activeBranchId = user?.activeBranchId || user?.branchId;
  const branchId = activeBranchId || (canAccessAllBranches() ? undefined : undefined);
  const activeBranchName = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId)?.name || "Sucursal activa",
    [branches, activeBranchId],
  );
  const safeCashRegister: CashRegister = cashRegister || {
    id: "no-register",
    date: new Date().toISOString(),
    openingBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    status: "open",
    movements: [],
  };

  useEffect(() => {
    const loadBranches = async () => {
      if (!activeBranchId) {
        setBranches([]);
        return;
      }

      try {
        const data = await branchesAPI.getAll();
        setBranches(
          Array.isArray(data)
            ? data.map((branch: any) => ({ id: branch.id, name: branch.name || branch.id }))
            : [],
        );
      } catch {
        setBranches([]);
      }
    };

    loadBranches();
  }, [activeBranchId]);

  const mapOrderToCashQueueOrder = (order: any): CashQueueOrder => ({
    id: order.id,
    remitoNumber: order.remitoNumber || order.id?.slice(0, 8)?.toUpperCase() || "SIN-REMITO",
    sellerName: [order.user?.firstname, order.user?.lastname].filter(Boolean).join(" ") || order.user?.name || "Sin vendedor",
    customerId: order.customerId || order.customer?.id,
    customerName: order.customerNameSnapshot || order.customer?.fullName || "Cliente sin identificar",
    creditEnabled: Boolean(order.customer?.isCreditEnabled),
    submittedAt: order.submittedAt || order.createdAt,
    total: Number(order.total || 0),
    approvedTotal: Number(order.approvedTotal || 0),
    amountPaid: Number(order.amountPaid || 0),
    paymentStatus: order.paymentStatus || "unpaid",
    fulfillmentStatus: order.fulfillmentStatus || "pending",
    status: order.status || "draft",
    restrictSalesToBranchStock: Boolean(order.branch?.restrictSalesToBranchStock),
    itemsCount: Array.isArray(order.items) ? order.items.length : 0,
    notes: order.notes,
    items: Array.isArray(order.items) ? order.items.map((item: any) => ({
      id: item.id,
      quantity: Number(item.quantity || 0),
      approvedQuantity: Number(item.approvedQuantity || 0),
      reservedQuantity: Number(item.reservedQuantity || 0),
      availableQuantity: Number(item.availableQuantity || 0),
      deliveredQuantity: Number(item.deliveredQuantity || 0),
      price: Number(item.price || 0),
      status: item.status,
      notes: item.notes,
      variant: item.variant ? {
        id: item.variant.id,
        name: item.variant.name,
        sku: item.variant.sku,
      } : undefined,
    })) : [],
  });

  const loadCashSnapshot = async () => {
    setQueueError(null);

    const [registerResult, queueResult, pendingDeliveriesResult] = await Promise.allSettled([
      branchId ? cashAPI.getCurrentRegister(branchId) : Promise.resolve(null),
      ordersAPI.getCashQueue(branchId ? { branchId } : undefined),
      ordersAPI.getPendingDeliveries(branchId ? { branchId } : undefined),
    ]);

    const register = registerResult.status === "fulfilled" ? registerResult.value : null;
    const queue = queueResult.status === "fulfilled" ? queueResult.value : [];
    const pendingDeliveryOrders = pendingDeliveriesResult.status === "fulfilled" ? pendingDeliveriesResult.value : [];

    if (queueResult.status === "rejected" || pendingDeliveriesResult.status === "rejected") {
      const queueErrorMessage = queueResult.status === "rejected"
        ? (queueResult.reason as any)?.response?.data?.message || (queueResult.reason as any)?.message || "No se pudo cargar la cola de remitos de caja"
        : null;
      const pendingDeliveriesErrorMessage = pendingDeliveriesResult.status === "rejected"
        ? (pendingDeliveriesResult.reason as any)?.response?.data?.message || (pendingDeliveriesResult.reason as any)?.message || "No se pudieron cargar las entregas pendientes"
        : null;
      const message = queueErrorMessage || pendingDeliveriesErrorMessage;
      setQueueError(message);
    }

    const registerMovements = Array.isArray(register?.movements) ? register.movements : [];

    const normalizedMovements: CashMovement[] = registerMovements.map((movement: any) => ({
      id: movement.id,
      type: movement.type === "income" ? "income" : "expense",
      description: movement.description || movement.reason || "Movimiento de caja",
      amount: Number(movement.amount || 0),
      paymentMethod: movement.paymentMethod || "cash",
      category: movement.type === "income" ? "Ingreso" : "Egreso",
      date: movement.createdAt,
      reference: movement.referenceLabel || register?.id,
      sellerName: movement.sellerName,
      customerName: movement.customerName,
    }));

    const totalIncome = normalizedMovements
      .filter((movement) => movement.type === "income")
      .reduce((sum, movement) => sum + movement.amount, 0);

    const totalExpense = normalizedMovements
      .filter((movement) => movement.type === "expense")
      .reduce((sum, movement) => sum + movement.amount, 0);

    setCashRegister({
      id: register?.id || "no-register",
      date: register?.openedAt || new Date().toISOString(),
      openingBalance: Number(register?.openingBalance || 0),
      closingBalance: register?.closingBalance ? Number(register.closingBalance) : undefined,
      totalIncome,
      totalExpense,
      status: register?.isClosed ? "closed" : "open",
      movements: normalizedMovements,
    });

    setCashQueue((Array.isArray(queue) ? queue : []).map(mapOrderToCashQueueOrder));
    setPendingDeliveries((Array.isArray(pendingDeliveryOrders) ? pendingDeliveryOrders : []).map(mapOrderToCashQueueOrder));
  };

  useEffect(() => {
    const loadCashData = async () => {
      setLoading(true);

      try {
        await loadCashSnapshot();
      } finally {
        setLoading(false);
      }
    };

    loadCashData();
  }, [branchId, user?.hasAllBranchAccess]);

  const reloadCashData = async () => {
    setLoading(true);
    try {
      await loadCashSnapshot();
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRegister = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const parsedOpeningBalance = Number(openForm.openingBalance || 0);
      if (!Number.isFinite(parsedOpeningBalance) || parsedOpeningBalance < 0) {
        throw new Error("Ingresá un saldo inicial válido");
      }

      await cashAPI.openRegister(parsedOpeningBalance, branchId);
      setSubmitSuccess("Caja abierta correctamente");
      setShowOpenForm(false);
      setOpenForm({ openingBalance: "0" });
      await reloadCashData();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || error?.message || "No se pudo abrir la caja");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseRegister = async () => {
    if (!cashRegister || cashRegister.id === "no-register") return;

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await cashAPI.closeRegister(cashRegister.id, {});
      setSubmitSuccess("Caja cerrada correctamente");
      await reloadCashData();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || error?.message || "No se pudo cerrar la caja");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMovement = async () => {
    if (!cashRegister || cashRegister.id === "no-register") {
      setShowOpenForm(true);
      setShowMovementForm(false);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const parsedAmount = Number(movementForm.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Ingresá un monto válido para el movimiento");
      }

      await cashAPI.addMovement({
        registerId: cashRegister.id,
        type: movementForm.type,
        amount: parsedAmount,
        reason: movementForm.reason.trim() || undefined,
      });

      setSubmitSuccess("Movimiento registrado correctamente");
      setShowMovementForm(false);
      setMovementForm({ type: "income", amount: "", reason: "" });
      await reloadCashData();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || error?.message || "No se pudo registrar el movimiento");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMovements = useMemo(() => (cashRegister?.movements || []).filter(movement => {
    const matchesSearch = movement.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || movement.type === filterType;
    return matchesSearch && matchesType;
  }), [cashRegister, searchTerm, filterType]);

  const filteredPendingDeliveries = useMemo(() => pendingDeliveries.filter((order) => {
    const normalizedSearch = pendingDeliveriesSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return true;
    }

    return order.customerName.toLowerCase().includes(normalizedSearch)
      || order.remitoNumber.toLowerCase().includes(normalizedSearch);
  }), [pendingDeliveries, pendingDeliveriesSearch]);

  const currentBalance = safeCashRegister.openingBalance + safeCashRegister.totalIncome - safeCashRegister.totalExpense;
  const netCashFlow = safeCashRegister.totalIncome - safeCashRegister.totalExpense;

  const getPaymentIcon = (method: CashMovement["paymentMethod"]) => {
    switch (method) {
      case "cash":
        return BanknoteIcon;
      case "card":
        return CreditCard;
      case "mercadopago":
        return CreditCard;
      default:
        return Wallet;
    }
  };

  const getPaymentText = (method: CashMovement["paymentMethod"]) => {
    switch (method) {
      case "cash":
        return "Efectivo";
      case "card":
        return "Tarjeta";
      case "mercadopago":
        return "MercadoPago";
      case "transfer":
        return "Transferencia";
      default:
        return "Otro";
    }
  };

  return (
    <div className="w-full px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Gestión de Caja
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeBranchId
              ? `Controla los movimientos de dinero y cierres de caja en ${activeBranchName}.`
              : "Controla los movimientos de dinero y cierres de caja."}
          </p>
        </div>
        <div className="flex space-x-2 mt-4 sm:mt-0">
          <Button variant="outline" onClick={handleCloseRegister} disabled={submitting || safeCashRegister.id === "no-register"}>
            <Calendar className="w-4 h-4 mr-2" />
            Cierre de Caja
          </Button>
          <Button onClick={() => setShowMovementForm((current) => !current)}>
            <Plus className="w-4 h-4 mr-2" />
            {showMovementForm ? "Ocultar Movimiento" : "Nuevo Movimiento"}
          </Button>
          {safeCashRegister.id === "no-register" && (
            <Button variant="secondary" onClick={() => setShowOpenForm((current) => !current)}>
              Abrir Caja
            </Button>
          )}
        </div>
      </div>

      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {submitSuccess && (
        <Alert>
          <AlertDescription>{submitSuccess}</AlertDescription>
        </Alert>
      )}

      {queueError && (
        <Alert variant="destructive">
          <AlertDescription>{queueError}</AlertDescription>
        </Alert>
      )}

      {showOpenForm && safeCashRegister.id === "no-register" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div>
            <Label htmlFor="opening-balance">Saldo inicial</Label>
            <Input
              id="opening-balance"
              type="number"
              min="0"
              step="0.01"
              value={openForm.openingBalance}
              onChange={(e) => setOpenForm({ openingBalance: e.target.value })}
              className="mt-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowOpenForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleOpenRegister} disabled={submitting}>
              {submitting ? "Abriendo..." : "Abrir Caja"}
            </Button>
          </div>
        </div>
      )}

      {showMovementForm && safeCashRegister.id !== "no-register" && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="movement-type">Tipo</Label>
              <select
                id="movement-type"
                value={movementForm.type}
                onChange={(e) => setMovementForm((current) => ({ ...current, type: e.target.value as "income" | "expense" }))}
                className="mt-2 flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="income">Ingreso</option>
                <option value="expense">Egreso</option>
              </select>
            </div>
            <div>
              <Label htmlFor="movement-amount">Monto</Label>
              <Input
                id="movement-amount"
                type="number"
                min="0"
                step="0.01"
                value={movementForm.amount}
                onChange={(e) => setMovementForm((current) => ({ ...current, amount: e.target.value }))}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="movement-reason">Motivo</Label>
              <Input
                id="movement-reason"
                value={movementForm.reason}
                onChange={(e) => setMovementForm((current) => ({ ...current, reason: e.target.value }))}
                placeholder="Detalle del movimiento"
                className="mt-2"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowMovementForm(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddMovement} disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar Movimiento"}
            </Button>
          </div>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saldo Inicial</p>
              <p className="text-2xl font-bold text-foreground">
                ${safeCashRegister.openingBalance.toLocaleString('es-AR')}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Ingresos</p>
              <p className="text-2xl font-bold text-green-600">
                ${safeCashRegister.totalIncome.toLocaleString('es-AR')}
              </p>
            </div>
            <ArrowUpRight className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Egresos</p>
              <p className="text-2xl font-bold text-red-600">
                ${safeCashRegister.totalExpense.toLocaleString('es-AR')}
              </p>
            </div>
            <ArrowDownRight className="w-8 h-8 text-red-600" />
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Saldo Actual</p>
              <p className="text-2xl font-bold text-blue-600">
                ${currentBalance.toLocaleString('es-AR')}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      <CashQueuePanel
        orders={cashQueue}
        onReload={reloadCashData}
        title="Cola de remitos por finalizar"
        description="Acá se muestran solo las transacciones pendientes de procesar en caja. Al finalizar, salen de esta cola."
        emptyMessage="No hay remitos pendientes de procesar en caja."
      />

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Buscador de entregas pendientes</h3>
            <p className="text-sm text-muted-foreground">Buscá por cliente o número de remito para ubicar entregas pendientes.</p>
          </div>
          <div className="w-full md:w-80">
            <Input
              placeholder="Buscar por cliente o remito..."
              value={pendingDeliveriesSearch}
              onChange={(e) => setPendingDeliveriesSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <CashQueuePanel
        orders={filteredPendingDeliveries}
        onReload={reloadCashData}
        title="Entregas pendientes"
        description="Estos remitos ya fueron cerrados en caja, pero todavía tienen mercadería pendiente de entrega o reimpresión acumulada."
        emptyMessage="No hay remitos con entrega pendiente."
      />

      {/* Cash Flow Summary */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Resumen del Flujo de Caja
          </h3>
          <div className="flex items-center space-x-2">
            {netCashFlow >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
            <span className={`font-medium ${
              netCashFlow >= 0 ? "text-green-600" : "text-red-600"
            }`}>
              Flujo Neto: ${Math.abs(netCashFlow).toLocaleString('es-AR')}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Apertura</p>
            <p className="text-lg font-semibold text-foreground">
              {new Date(safeCashRegister.date).toLocaleDateString('es-AR')}
            </p>
            <p className="text-sm text-muted-foreground">
              ${safeCashRegister.openingBalance.toLocaleString('es-AR')}
            </p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Movimientos</p>
            <p className="text-lg font-semibold text-foreground">
              {safeCashRegister.movements.length}
            </p>
            <p className="text-sm text-muted-foreground">
              {safeCashRegister.movements.filter(m => m.type === "income").length} ingresos, {" "}
              {safeCashRegister.movements.filter(m => m.type === "expense").length} egresos
            </p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="text-lg font-semibold text-foreground">
              {safeCashRegister.status === "open" ? "Abierta" : "Cerrada"}
            </p>
            <p className="text-sm text-muted-foreground">
              Saldo: ${currentBalance.toLocaleString('es-AR')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar movimientos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={filterType === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("all")}
          >
            Todos
          </Button>
          <Button 
            variant={filterType === "income" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("income")}
          >
            Ingresos
          </Button>
          <Button 
            variant={filterType === "expense" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("expense")}
          >
            Egresos
          </Button>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-foreground">Fecha/Hora</th>
                <th className="text-left p-4 font-medium text-foreground">Descripción</th>
                <th className="text-left p-4 font-medium text-foreground">Categoría</th>
                <th className="text-left p-4 font-medium text-foreground">Método</th>
                <th className="text-left p-4 font-medium text-foreground">Referencia</th>
                <th className="text-left p-4 font-medium text-foreground">Monto</th>
                <th className="text-left p-4 font-medium text-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((movement) => {
                const PaymentIcon = getPaymentIcon(movement.paymentMethod);
                
                return (
                  <tr key={movement.id} className="border-t border-border hover:bg-muted/50">
                    <td className="p-4 text-muted-foreground">
                      {new Date(movement.date).toLocaleString('es-AR')}
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-foreground">{movement.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {movement.type === "income" ? "Ingreso" : "Egreso"}
                        </p>
                        {(movement.sellerName || movement.customerName) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {movement.sellerName ? `Vendedor: ${movement.sellerName}` : ""}
                            {movement.sellerName && movement.customerName ? " · " : ""}
                            {movement.customerName ? `Cliente: ${movement.customerName}` : ""}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {movement.category}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <PaymentIcon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{getPaymentText(movement.paymentMethod)}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {movement.reference || "-"}
                    </td>
                    <td className="p-4">
                      <span className={`font-bold ${
                        movement.type === "income" ? "text-green-600" : "text-red-600"
                      }`}>
                        {movement.type === "income" ? "+" : "-"}${movement.amount.toLocaleString('es-AR')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm">
                          Editar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredMovements.length === 0 && (
          <div className="text-center py-12">
            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{loading ? 'Cargando movimientos...' : 'No se encontraron movimientos'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
