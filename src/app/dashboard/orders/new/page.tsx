"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useAuth } from "@/components/auth/AuthContext";
import { ordersAPI, productsAPI } from "@/services/api";

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

interface OrderItemForm {
  variantId: string;
  quantity: number;
  price: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const { user, isSellerOnly } = useAuth();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [items, setItems] = useState<OrderItemForm[]>([{ variantId: "", quantity: 1, price: 0 }]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeBranchId = user?.activeBranchId || user?.branchId || "";

  useEffect(() => {
    if (isSellerOnly()) {
      router.replace("/dashboard/sales");
    }
  }, [isSellerOnly, router]);

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const data = await productsAPI.getAll();
        const normalized = (Array.isArray(data) ? data : []).map((product: any) => ({
          id: product.id,
          name: product.name || product.productBase?.name || `Variante ${product.id}`,
          price: Number(product.price || 0),
        }));
        setProducts(normalized);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, []);

  const updateItem = (index: number, patch: Partial<OrderItemForm>) => {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((current) => [...current, { variantId: "", quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  };

  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const validItems = items.filter((item) => item.variantId && item.quantity > 0 && item.price >= 0);
      const resolvedBranchId = activeBranchId;

      if (!user?.id) {
        throw new Error("No hay usuario autenticado");
      }

      if (!resolvedBranchId) {
        throw new Error("Seleccioná una sucursal activa desde la barra superior para registrar la venta");
      }

      if (!validItems.length) {
        throw new Error("Agregá al menos un producto válido");
      }

      if (!customerName.trim()) {
        throw new Error("Ingresá el nombre del cliente para generar el remito");
      }

      await ordersAPI.create({
        userId: user.id,
        branchId: resolvedBranchId,
        customerNameSnapshot: customerName.trim(),
        items: validItems,
      });

      setMessage("Venta creada correctamente. El cobro debe registrarse desde Caja.");

      setTimeout(() => router.push("/dashboard/orders"), 800);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "No se pudo crear la venta");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/dashboard/orders")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Nueva Venta</h1>
            <p className="text-muted-foreground mt-1">Registrá una orden en la sucursal activa</p>
          </div>
        </div>
      </div>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div>
          <Label>Sucursal de la venta</Label>
          <div className="mt-2 flex h-10 w-full items-center rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            {activeBranchId || "Seleccioná una sucursal activa en la barra superior"}
          </div>
        </div>

        <div>
          <Label htmlFor="order-customer">Cliente</Label>
          <Input
            id="order-customer"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Nombre del cliente"
            className="mt-2"
          />
        </div>

        <Alert>
          <AlertDescription>El cobro y futuras cuentas corrientes se registran desde Caja, no desde la creación de la venta.</AlertDescription>
        </Alert>

        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border border-border rounded-lg p-4">
              <div className="md:col-span-6">
                <Label>Producto</Label>
                <select
                  value={item.variantId}
                  onChange={(e) => {
                    const selected = products.find((product) => product.id === e.target.value);
                    updateItem(index, { variantId: e.target.value, price: selected?.price || 0 });
                  }}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">{loadingProducts ? "Cargando productos..." : "Seleccionar producto"}</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label>Cantidad</Label>
                <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <Label>Precio</Label>
                <Input type="number" min={0} value={item.price} onChange={(e) => updateItem(index, { price: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <Button variant="outline" onClick={() => removeItem(index)} className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Quitar
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <Button variant="outline" onClick={addItem}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar producto
          </Button>
          <div className="text-lg font-semibold text-foreground">Total: ${total.toLocaleString("es-AR")}</div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting || loadingProducts}>
            {submitting ? "Guardando..." : "Crear venta"}
          </Button>
        </div>
      </div>
    </div>
  );
}
