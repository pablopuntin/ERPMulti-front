"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Search, 
  Eye, 
  Package,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  Send
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useAuth } from "@/components/auth/AuthContext";
import { branchesAPI, ordersAPI } from "@/services/api";

interface Order {
  id: string;
  orderNumber: string;
  customer: string;
  seller: string;
  date: string;
  total: number;
  status: "pending" | "paid" | "draft" | "sent_to_cash" | "partially_approved" | "approved" | "rejected" | "completed" | "cancelled";
  paymentStatus: string;
  fulfillmentStatus: string;
  items: number;
}

interface BranchOption {
  id: string;
  name: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, canAccessAllBranches } = useAuth();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const activeBranchId = user?.activeBranchId || user?.branchId || "";
  const activeBranchName = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId)?.name || "Sucursal activa",
    [branches, activeBranchId],
  );

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

  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);

      try {
        const branchId = activeBranchId || (canAccessAllBranches() ? undefined : undefined);

        const data = await ordersAPI.getAll(branchId ? { branchId } : undefined);
        const normalizedOrders: Order[] = (Array.isArray(data) ? data : []).map((order: any) => ({
          id: order.id,
          orderNumber: order.remitoNumber || (order.id?.slice(0, 8) ? `ORD-${order.id.slice(0, 8).toUpperCase()}` : "ORD-SIN-ID"),
          customer: order.customerNameSnapshot || order.customer?.fullName || "Cliente sin identificar",
          seller: [order.user?.firstname, order.user?.lastname].filter(Boolean).join(" ") || order.user?.name || "Sin vendedor",
          date: order.createdAt,
          total: Number(order.total || 0),
          status: (order.status || "draft") as Order["status"],
          paymentStatus: order.paymentStatus || "unpaid",
          fulfillmentStatus: order.fulfillmentStatus || "pending",
          items: Array.isArray(order.items) ? order.items.length : 0,
        }));

        setOrders(normalizedOrders);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [user?.activeBranchId, user?.branchId, user?.hasAllBranchAccess]);

  const filteredOrders = useMemo(() => orders.filter(order => {
    const matchesSearch = order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  }), [orders, searchTerm, statusFilter]);

  const draftCount = orders.filter((order) => order.status === "draft").length;
  const legacyPendingCount = orders.filter((order) => order.status === "pending").length;
  const sentToCashCount = orders.filter((order) => order.status === "sent_to_cash").length;
  const approvedCount = orders.filter((order) => ["approved", "partially_approved"].includes(order.status)).length;
  const completedCount = orders.filter((order) => ["completed", "paid"].includes(order.status)).length;

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "pending":
      case "draft":
        return "bg-yellow-100 text-yellow-800";
      case "sent_to_cash":
        return "bg-blue-100 text-blue-800";
      case "partially_approved":
        return "bg-amber-100 text-amber-800";
      case "paid":
      case "approved":
        return "bg-purple-100 text-purple-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: Order["status"]) => {
    switch (status) {
      case "pending":
      case "draft":
        return Clock;
      case "sent_to_cash":
        return Send;
      case "partially_approved":
      case "paid":
      case "approved":
        return Package;
      case "completed":
        return CheckCircle;
      case "cancelled":
      case "rejected":
        return XCircle;
      default:
        return Clock;
    }
  };

  const getStatusText = (status: Order["status"]) => {
    switch (status) {
      case "pending":
        return "Pendiente legado";
      case "draft":
        return "Borrador";
      case "sent_to_cash":
        return "Enviado a caja";
      case "partially_approved":
        return "Aprobado parcial";
      case "paid":
        return "Pagado legado";
      case "approved":
        return "Aprobado";
      case "completed":
        return "Completado";
      case "rejected":
        return "Rechazado";
      case "cancelled":
        return "Cancelado";
      default:
        return "Desconocido";
    }
  };

  return (
    <div className="w-full px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Gestión de Pedidos
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeBranchId
              ? `Administra las ventas y pedidos de clientes de ${activeBranchName}.`
              : "Administra las ventas y pedidos de clientes."}
          </p>
        </div>
        <Button className="mt-4 sm:mt-0" onClick={() => router.push("/dashboard/orders/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Venta
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Borradores</p>
              <p className="text-2xl font-bold text-yellow-600">{draftCount + legacyPendingCount}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">En caja</p>
              <p className="text-2xl font-bold text-blue-600">{sentToCashCount}</p>
            </div>
            <Send className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Aprobados</p>
              <p className="text-2xl font-bold text-purple-600">{approvedCount}</p>
            </div>
            <Package className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completados</p>
              <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por número de pedido o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-lg bg-background text-foreground"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes legado</option>
            <option value="draft">Borradores</option>
            <option value="sent_to_cash">En caja</option>
            <option value="partially_approved">Aprobados parciales</option>
            <option value="paid">Pagados legado</option>
            <option value="approved">Aprobados</option>
            <option value="completed">Completados</option>
            <option value="rejected">Rechazados</option>
            <option value="cancelled">Cancelados</option>
          </select>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Más filtros
          </Button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-foreground">Pedido</th>
                <th className="text-left p-4 font-medium text-foreground">Vendedor</th>
                <th className="text-left p-4 font-medium text-foreground">Cliente</th>
                <th className="text-left p-4 font-medium text-foreground">Fecha</th>
                <th className="text-left p-4 font-medium text-foreground">Items</th>
                <th className="text-left p-4 font-medium text-foreground">Total</th>
                <th className="text-left p-4 font-medium text-foreground">Pago / Entrega</th>
                <th className="text-left p-4 font-medium text-foreground">Estado</th>
                <th className="text-left p-4 font-medium text-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const StatusIcon = getStatusIcon(order.status);
                
                return (
                  <tr key={order.id} className="border-t border-border hover:bg-muted/50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-foreground">{order.orderNumber}</p>
                        <p className="text-sm text-muted-foreground">ID: {order.id}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-foreground">{order.seller}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-foreground">{order.customer}</p>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(order.date).toLocaleDateString('es-AR')}
                    </td>
                    <td className="p-4">
                      <span className="bg-muted px-2 py-1 rounded text-sm">
                        {order.items} productos
                      </span>
                    </td>
                    <td className="p-4 font-medium text-foreground">
                      ${order.total.toLocaleString('es-AR')}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 text-sm">
                        <Badge variant="outline" className="w-fit">{order.paymentStatus}</Badge>
                        <Badge variant="outline" className="w-fit">{order.fulfillmentStatus}</Badge>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(order.status)}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{loading ? 'Cargando pedidos...' : 'No se encontraron pedidos'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
