"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Receipt,
  TrendingUp,
  TrendingDown,
  Filter,
  Calendar,
  DollarSign
} from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { useAuth } from "@/components/auth/AuthContext";
import { expensesAPI } from "@/services/api";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: "fixed" | "variable";
  subcategory: string;
  date: string;
  status: "paid" | "pending" | "overdue";
  paymentMethod?: string;
  provider?: string;
  frequency?: "monthly" | "quarterly" | "annual" | "once";
}

interface ExpenseFormState {
  category: "fixed" | "variable";
  name: string;
  amount: string;
  description: string;
  frequency: "monthly" | "quarterly" | "annual";
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "fixed" | "variable">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormState>({
    category: "variable",
    name: "",
    amount: "",
    description: "",
    frequency: "monthly",
  });
  const activeBranchId = user?.activeBranchId || user?.branchId || "";
  const branchId = activeBranchId || undefined;

  const loadExpenses = async () => {
    setLoading(true);

    try {
      const [fixed, variable] = await Promise.all([
        expensesAPI.getFixed(branchId),
        expensesAPI.getVariable(branchId),
      ]);

      const normalizedFixed = (Array.isArray(fixed) ? fixed : []).map((item: any) => ({
        id: item.id,
        description: item.name,
        amount: Number(item.amount || 0),
        category: "fixed" as const,
        subcategory: item.description || "Gasto fijo",
        date: item.createdAt,
        status: "paid" as const,
        provider: item.supplier?.name,
        frequency: item.frequency || "monthly",
      }));

      const normalizedVariable = (Array.isArray(variable) ? variable : []).map((item: any) => ({
        id: item.id,
        description: item.name,
        amount: Number(item.amount || 0),
        category: "variable" as const,
        subcategory: item.reason || "Gasto variable",
        date: item.createdAt,
        status: "paid" as const,
        provider: item.supplier?.name,
        paymentMethod: "cash",
        frequency: "once" as const,
      }));

      setExpenses([...normalizedFixed, ...normalizedVariable].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
      ));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [branchId, user?.hasAllBranchAccess]);

  const resetForm = () => {
    setForm({
      category: "variable",
      name: "",
      amount: "",
      description: "",
      frequency: "monthly",
    });
  };

  const handleCreateExpense = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const resolvedBranchId = activeBranchId;

      if (!resolvedBranchId) {
        throw new Error("Seleccioná una sucursal activa desde la barra superior para registrar el gasto");
      }

      if (!form.name.trim()) {
        throw new Error("Ingresá el nombre del gasto");
      }

      const parsedAmount = Number(form.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new Error("Ingresá un monto válido");
      }

      if (form.category === "fixed") {
        await expensesAPI.createFixed({
          name: form.name.trim(),
          amount: parsedAmount,
          description: form.description.trim() || undefined,
          frequency: form.frequency,
          branchId: resolvedBranchId,
        });
      } else {
        await expensesAPI.createVariable({
          name: form.name.trim(),
          amount: parsedAmount,
          reason: form.description.trim() || undefined,
          branchId: resolvedBranchId,
        });
      }

      setSubmitSuccess("Gasto guardado correctamente");
      resetForm();
      setShowCreateForm(false);
      await loadExpenses();
    } catch (error: any) {
      setSubmitError(error?.response?.data?.message || error?.message || "No se pudo guardar el gasto");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredExpenses = useMemo(() => expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.provider?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || expense.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  }), [expenses, searchTerm, categoryFilter, statusFilter]);

  const totalFixed = expenses.filter(e => e.category === "fixed").reduce((sum, e) => sum + e.amount, 0);
  const totalVariable = expenses.filter(e => e.category === "variable").reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = totalFixed + totalVariable;
  const pendingExpenses = expenses.filter(e => e.status === "pending").reduce((sum, e) => sum + e.amount, 0);

  const getStatusBadge = (status: Expense["status"]) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: Expense["status"]) => {
    switch (status) {
      case "paid":
        return "Pagado";
      case "pending":
        return "Pendiente";
      case "overdue":
        return "Vencido";
      default:
        return "Desconocido";
    }
  };

  const getCategoryText = (category: Expense["category"]) => {
    return category === "fixed" ? "Fijo" : "Variable";
  };

  const getFrequencyText = (frequency?: Expense["frequency"]) => {
    switch (frequency) {
      case "monthly":
        return "Mensual";
      case "quarterly":
        return "Trimestral";
      case "annual":
        return "Anual";
      case "once":
        return "Único";
      default:
        return "No especificado";
    }
  };

  return (
    <div className="w-full px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Gestión de Gastos
          </h1>
          <p className="text-muted-foreground mt-1">
            Controla los gastos fijos y variables de la sucursal activa
          </p>
        </div>
        <Button className="mt-4 sm:mt-0" onClick={() => setShowCreateForm((current) => !current)}>
          <Plus className="w-4 h-4 mr-2" />
          {showCreateForm ? "Ocultar Formulario" : "Nuevo Gasto"}
        </Button>
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

      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Mostrando y registrando gastos según la <span className="font-medium text-foreground">sucursal activa</span> seleccionada en la barra superior.
      </div>

      {showCreateForm && (
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Sucursal del gasto</Label>
              <div className="mt-2 flex h-10 w-full items-center rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                {activeBranchId || "Seleccioná una sucursal activa en la barra superior"}
              </div>
            </div>

            <div>
              <Label htmlFor="expense-category">Tipo de gasto</Label>
              <select
                id="expense-category"
                value={form.category}
                onChange={(e) => setForm((current) => ({ ...current, category: e.target.value as "fixed" | "variable" }))}
                className="mt-2 flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="variable">Variable</option>
                <option value="fixed">Fijo</option>
              </select>
            </div>

            <div>
              <Label htmlFor="expense-name">Nombre</Label>
              <Input
                id="expense-name"
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="Ej: Alquiler, Viáticos, Compra menor"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="expense-amount">Monto</Label>
              <Input
                id="expense-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))}
                placeholder="0.00"
                className="mt-2"
              />
            </div>

            {form.category === "fixed" && (
              <div>
                <Label htmlFor="expense-frequency">Frecuencia</Label>
                <select
                  id="expense-frequency"
                  value={form.frequency}
                  onChange={(e) => setForm((current) => ({ ...current, frequency: e.target.value as ExpenseFormState["frequency"] }))}
                  className="mt-2 flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="monthly">Mensual</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="annual">Anual</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="expense-description">{form.category === "fixed" ? "Descripción" : "Motivo"}</Label>
            <Textarea
              id="expense-description"
              value={form.description}
              onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
              placeholder={form.category === "fixed" ? "Detalle del gasto fijo" : "Motivo del gasto variable"}
              className="mt-2"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowCreateForm(false);
                setSubmitError(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateExpense} disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar Gasto"}
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Gastos</p>
              <p className="text-2xl font-bold text-foreground">
                ${totalExpenses.toLocaleString('es-AR')}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Gastos Fijos</p>
              <p className="text-2xl font-bold text-blue-600">
                ${totalFixed.toLocaleString('es-AR')}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Gastos Variables</p>
              <p className="text-2xl font-bold text-orange-600">
                ${totalVariable.toLocaleString('es-AR')}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-bold text-red-600">
                ${pendingExpenses.toLocaleString('es-AR')}
              </p>
            </div>
            <Calendar className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar gastos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground"
          >
            <option value="all">Todas las categorías</option>
            <option value="fixed">Fijos</option>
            <option value="variable">Variables</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground"
          >
            <option value="all">Todos los estados</option>
            <option value="paid">Pagados</option>
            <option value="pending">Pendientes</option>
            <option value="overdue">Vencidos</option>
          </select>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Más filtros
          </Button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-foreground">Descripción</th>
                <th className="text-left p-4 font-medium text-foreground">Categoría</th>
                <th className="text-left p-4 font-medium text-foreground">Proveedor</th>
                <th className="text-left p-4 font-medium text-foreground">Fecha</th>
                <th className="text-left p-4 font-medium text-foreground">Frecuencia</th>
                <th className="text-left p-4 font-medium text-foreground">Estado</th>
                <th className="text-left p-4 font-medium text-foreground">Monto</th>
                <th className="text-left p-4 font-medium text-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((expense) => (
                <tr key={expense.id} className="border-t border-border hover:bg-muted/50">
                  <td className="p-4">
                    <div>
                      <p className="font-medium text-foreground">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">{expense.subcategory}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      expense.category === "fixed" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
                    }`}>
                      {getCategoryText(expense.category)}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {expense.provider || "-"}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(expense.date).toLocaleDateString('es-AR')}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {getFrequencyText(expense.frequency)}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(expense.status)}`}>
                      {getStatusText(expense.status)}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-foreground">
                    ${expense.amount.toLocaleString('es-AR')}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredExpenses.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{loading ? 'Cargando gastos...' : 'No se encontraron gastos'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
