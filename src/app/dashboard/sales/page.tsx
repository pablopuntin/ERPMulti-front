"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Send, ShoppingCart } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { StockDisplay } from "@/components/products/StockDisplay";
import { useAuth } from "@/components/auth/AuthContext";
import { branchesAPI, brandsAPI, categoriesAPI, customersAPI, ordersAPI, productsAPI, productsBaseAPI } from "@/services/api";
import type { ProductVariant, ProductsCatalogMeta } from "@/app/dashboard/products/hooks/useProducts";

interface FilterOption {
  id: string;
  name: string;
}

interface CustomerOption {
  id: string;
  fullName: string;
}

interface SellerMetric {
  sellerUserId?: string;
  sellerName: string;
  totalOrders: number;
  totalAmount: number;
}

interface RemitoItem {
  variantId: string;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  localAvailable?: number;
}

interface BranchOption {
  id: string;
  name: string;
}

const SALES_PAGE_LIMIT = 50;

const getLocationBuckets = (product: ProductVariant, branchId?: string) => {
  const stocks = Array.isArray(product.stockByBranch) ? product.stockByBranch : [];
  const local = stocks.filter((stock) => stock.locationType === "branch" && stock.branchId === branchId);
  const transit = stocks.filter((stock) => stock.locationType === "transit" && Number(stock.availableQuantity || 0) > 0);
  const otherBranches = stocks.filter((stock) => stock.locationType === "branch" && stock.branchId !== branchId && Number(stock.availableQuantity || 0) > 0);
  const localAvailable = local.reduce((sum, stock) => sum + Number(stock.availableQuantity || 0), 0);
  return { localAvailable, transit, otherBranches };
};

export default function SalesPage() {
  const { user, canAccessAllBranches } = useAuth();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [products, setProducts] = useState<ProductVariant[]>([]);
  const [productBaseOptions, setProductBaseOptions] = useState<FilterOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [brands, setBrands] = useState<FilterOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedProductBase, setSelectedProductBase] = useState("all");
  const [selectedVariant, setSelectedVariant] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerFreeName, setCustomerFreeName] = useState("");
  const [sellerMetric, setSellerMetric] = useState<SellerMetric | null>(null);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<RemitoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strictStockEnabled, setStrictStockEnabled] = useState(false);
  const [customerWarningOpen, setCustomerWarningOpen] = useState(false);
  const [meta, setMeta] = useState<ProductsCatalogMeta>({
    page: 1,
    limit: SALES_PAGE_LIMIT,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const activeBranchId = user?.activeBranchId || user?.branchId || "";
  const branchId = activeBranchId || (canAccessAllBranches() ? undefined : undefined);
  const activeBranchName = useMemo(
    () => branches.find((branch) => branch.id === activeBranchId)?.name || "Sucursal activa",
    [branches, activeBranchId],
  );

  const variantOptions = useMemo(() => products.map((product) => ({ id: product.id, name: product.name })), [products]);
  const customerInputValue = selectedCustomerId
    ? customers.find((customer) => customer.id === selectedCustomerId)?.fullName || customerFreeName
    : customerFreeName;

  useEffect(() => {
    const loadBranches = async () => {
      if (!activeBranchId) {
        setBranches([]);
        setStrictStockEnabled(false);
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

      try {
        const settings = await branchesAPI.getSalesSettings(activeBranchId);
        setStrictStockEnabled(Boolean(settings?.restrictSalesToBranchStock));
      } catch {
        setStrictStockEnabled(false);
      }
    };

    loadBranches();
  }, [activeBranchId]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = !debouncedSearchTerm.trim() || [product.name, product.sku, product.productBase?.name, product.brand?.name, product.category?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === "all" || product.category?.id === selectedCategory;
      const matchesBrand = selectedBrand === "all" || product.brand?.id === selectedBrand;
      const matchesProductBase = selectedProductBase === "all" || product.productBase?.id === selectedProductBase;
      const matchesVariant = selectedVariant === "all" || product.id === selectedVariant;
      return matchesSearch && matchesCategory && matchesBrand && matchesProductBase && matchesVariant;
    });
  }, [products, debouncedSearchTerm, selectedCategory, selectedBrand, selectedProductBase, selectedVariant]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.price, 0), [items]);

  const productLocalStockMap = useMemo(() => {
    return new Map(
      products.map((product) => [product.id, getLocationBuckets(product, activeBranchId).localAvailable])
    );
  }, [products, activeBranchId]);

  const loadSalesData = async () => {
    const [catalog, categoriesData, brandsData, productBasesData, customersData, metricsData] = await Promise.all([
      productsAPI.getCatalog({
        page,
        limit: SALES_PAGE_LIMIT,
        ...(debouncedSearchTerm.trim() ? { search: debouncedSearchTerm.trim() } : {}),
        ...(selectedCategory !== "all" ? { categoryId: selectedCategory } : {}),
        ...(selectedBrand !== "all" ? { brandId: selectedBrand } : {}),
        ...(selectedProductBase !== "all" ? { productBaseId: selectedProductBase } : {}),
        ...(selectedVariant !== "all" ? { variantId: selectedVariant } : {}),
        ...(branchId ? { branchId } : {}),
      }),
      categoriesAPI.getAll(),
      brandsAPI.getAll(),
      productsBaseAPI.getAll({ limit: 10000, ...(branchId ? { branchId } : {}) }),
      customersAPI.getAll(branchId ? { branchId } : undefined),
      user?.id ? ordersAPI.getSellerMetrics({ sellerUserId: user.id, ...(branchId ? { branchId } : {}) }) : Promise.resolve([]),
    ]);

    setProducts(Array.isArray(catalog?.items) ? catalog.items : []);
    setMeta({
      page: Number(catalog?.meta?.page ?? page),
      limit: Number(catalog?.meta?.limit ?? SALES_PAGE_LIMIT),
      total: Number(catalog?.meta?.total ?? 0),
      totalPages: Number(catalog?.meta?.totalPages ?? 1),
      hasNextPage: Boolean(catalog?.meta?.hasNextPage),
      hasPreviousPage: Boolean(catalog?.meta?.hasPreviousPage),
    });
    setCategories(Array.isArray(categoriesData) ? categoriesData.map((item: any) => ({ id: item.id, name: item.name })) : []);
    setBrands(Array.isArray(brandsData) ? brandsData.map((item: any) => ({ id: item.id, name: item.name })) : []);
    setProductBaseOptions(
      (Array.isArray(productBasesData?.items) ? productBasesData.items : Array.isArray(productBasesData) ? productBasesData : [])
        .map((item: any) => ({ id: item.id, name: item.name }))
        .filter((item: FilterOption) => Boolean(item.id && item.name))
        .sort((a: FilterOption, b: FilterOption) => a.name.localeCompare(b.name))
    );
    setCustomers(Array.isArray(customersData) ? customersData.map((customer: any) => ({ id: customer.id, fullName: customer.fullName })) : []);
    setSellerMetric(Array.isArray(metricsData) && metricsData.length > 0 ? metricsData[0] : null);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, selectedBrand, selectedProductBase, selectedVariant]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await loadSalesData();
      } catch (loadError: any) {
        setError(loadError?.response?.data?.message || "No se pudo cargar la pantalla de ventas.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [branchId, user?.id, page, debouncedSearchTerm, selectedCategory, selectedBrand, selectedProductBase, selectedVariant]);

  const addItem = (product: ProductVariant) => {
    const localAvailable = getLocationBuckets(product, activeBranchId).localAvailable;

    if (strictStockEnabled && localAvailable <= 0) {
      setError(`La sucursal ${activeBranchName} no tiene stock local disponible para ${product.name}.`);
      return;
    }

    setItems((current) => {
      const existing = current.find((item) => item.variantId === product.id);
      if (existing) {
        return current.map((item) => {
          if (item.variantId !== product.id) {
            return item;
          }

          const nextQuantity = strictStockEnabled
            ? Math.min(item.quantity + 1, Math.max(0, localAvailable))
            : item.quantity + 1;

          return {
            ...item,
            quantity: Math.max(1, nextQuantity),
            localAvailable,
          };
        });
      }
      return [...current, {
        variantId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        price: Number(product.price || 0),
        localAvailable,
      }];
    });

    setError(null);
  };

  const updateItem = (variantId: string, patch: Partial<RemitoItem>) => {
    setItems((current) =>
      current.map((item) => {
        if (item.variantId !== variantId) {
          return item;
        }

        const localAvailable = productLocalStockMap.get(variantId) ?? item.localAvailable ?? 0;
        const requestedQuantity =
          typeof patch.quantity === "number" ? patch.quantity : item.quantity;
        const safeQuantity = strictStockEnabled
          ? Math.min(Math.max(1, requestedQuantity), Math.max(1, localAvailable))
          : Math.max(1, requestedQuantity);

        return {
          ...item,
          ...patch,
          quantity: safeQuantity,
          localAvailable,
        };
      })
    );
  };

  const removeItem = (variantId: string) => {
    setItems((current) => current.filter((item) => item.variantId !== variantId));
  };

  const handleCustomerInputChange = (value: string) => {
    const matchedCustomer = customers.find(
      (customer) => customer.fullName.toLowerCase() === value.trim().toLowerCase()
    );

    if (matchedCustomer) {
      setSelectedCustomerId(matchedCustomer.id);
      setCustomerFreeName("");
      return;
    }

    setSelectedCustomerId("");
    setCustomerFreeName(value);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      if (!user?.id) {
        throw new Error("No hay usuario autenticado.");
      }

      if (!activeBranchId) {
        throw new Error("No hay sucursal activa para generar el remito.");
      }

      if (items.length === 0) {
        throw new Error("Agregá al menos un producto al remito.");
      }

      if (strictStockEnabled) {
        const invalidItem = items.find((item) => {
          const localAvailable = productLocalStockMap.get(item.variantId) ?? item.localAvailable ?? 0;
          return item.quantity > localAvailable;
        });

        if (invalidItem) {
          const localAvailable = productLocalStockMap.get(invalidItem.variantId) ?? invalidItem.localAvailable ?? 0;
          throw new Error(
            `La sucursal ${activeBranchName} solo dispone de ${localAvailable} unidad(es) para ${invalidItem.name}.`
          );
        }
      }

      if (!selectedCustomerId && !customerFreeName.trim()) {
        setCustomerWarningOpen(true);
        setSubmitting(false);
        return;
      }

      const createdOrder = await ordersAPI.create({
        userId: user.id,
        branchId: activeBranchId,
        customerId: selectedCustomerId || undefined,
        customerNameSnapshot: customerFreeName.trim() || undefined,
        notes: notes.trim() || undefined,
        items: items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      await ordersAPI.sendToCash(createdOrder.id);
      await loadSalesData();

      setMessage(`Remito ${createdOrder.remitoNumber || "generado"} enviado a caja correctamente.`);
      setItems([]);
      setSelectedCustomerId("");
      setCustomerFreeName("");
      setNotes("");
    } catch (submitError: any) {
      setError(submitError?.response?.data?.message || submitError?.message || "No se pudo enviar el remito a caja.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="w-full px-4 py-6">Cargando ventas...</div>;
  }

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Ventas</h1>
        <p className="text-muted-foreground mt-1">
          {activeBranchId
            ? `Armá el remito y envialo a caja para su revisión, cobro y entrega en ${activeBranchName}. Operando como ${user?.name || "usuario"}.`
            : "Armá el remito y envialo a caja para su revisión, cobro y entrega."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Vendedor</div>
          <div className="mt-1 text-lg font-semibold text-foreground">{sellerMetric?.sellerName || user?.name || "Sin datos"}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Ventas cerradas</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{sellerMetric?.totalOrders || 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Remitos entregados y pagados</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm text-muted-foreground">Monto efectivo</div>
          <div className="mt-1 text-2xl font-bold text-foreground">${Number(sellerMetric?.totalAmount || 0).toLocaleString("es-AR")}</div>
          <div className="text-xs text-muted-foreground mt-1">Base para seguimiento de comisión</div>
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

      {strictStockEnabled && (
        <Alert>
          <AlertDescription>
            Modo estricto activo en {activeBranchName}: solo podés cargar al remito cantidades disponibles en el stock local de esta sucursal.
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={customerWarningOpen} onOpenChange={setCustomerWarningOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cliente requerido</DialogTitle>
            <DialogDescription>
              Para generar el remito necesitás indicar un cliente. Podés seleccionar un cliente interno o escribir un nombre libre.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setCustomerWarningOpen(false)}>
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <div className="xl:col-span-2">
                <Label>Buscar producto</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Nombre, SKU, marca..." className="pl-10" />
                </div>
              </div>

              <div>
                <Label>Categoría</Label>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="mt-2 flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                  <option value="all">Todas</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>

              <div>
                <Label>Marca</Label>
                <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className="mt-2 flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                  <option value="all">Todas</option>
                  {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                </select>
              </div>

              <div>
                <Label>Producto base</Label>
                <select value={selectedProductBase} onChange={(e) => setSelectedProductBase(e.target.value)} className="mt-2 flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                  <option value="all">Todos</option>
                  {productBaseOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>Variante</Label>
              <select value={selectedVariant} onChange={(e) => setSelectedVariant(e.target.value)} className="mt-2 flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
                <option value="all">Todas</option>
                {variantOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            {filteredProducts.map((product) => {
              const buckets = getLocationBuckets(product, activeBranchId);
              const itemInCart = items.find((item) => item.variantId === product.id);
              const disableAddButton = strictStockEnabled && buckets.localAvailable <= 0;
              const reachedLocalLimit =
                strictStockEnabled &&
                (itemInCart?.quantity ?? 0) >= buckets.localAvailable &&
                buckets.localAvailable > 0;
              const statusTone = buckets.localAvailable > 0
                ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/30"
                : buckets.transit.length > 0
                  ? "bg-blue-500/10 text-blue-200 border-blue-500/30"
                  : buckets.otherBranches.length > 0
                    ? "bg-amber-500/10 text-amber-200 border-amber-500/30"
                    : "bg-red-500/10 text-red-200 border-red-500/30";
              const statusLabel = buckets.localAvailable > 0
                ? `Stock sucursal: ${buckets.localAvailable}`
                : buckets.transit.length > 0
                  ? "En tránsito"
                  : buckets.otherBranches.length > 0
                    ? "Stock en otra sucursal"
                    : "Sin stock";

              return (
                <div key={product.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-foreground">{product.name}</div>
                        <Badge variant="outline" className={statusTone}>{statusLabel}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {product.sku || "Sin SKU"}
                        {product.productBase?.name ? ` · ${product.productBase.name}` : ""}
                        {product.brand?.name ? ` · ${product.brand.name}` : ""}
                        {product.category?.name ? ` · ${product.category.name}` : ""}
                      </div>
                      <div className="text-lg font-semibold text-foreground">${Number(product.price || 0).toLocaleString("es-AR")}</div>
                      <StockDisplay stocks={product.stockByBranch || []} compact />
                    </div>
                    <div className="w-full lg:w-52 space-y-2">
                      {buckets.otherBranches.length > 0 && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          Otras sucursales: {buckets.otherBranches.map((stock) => `${stock.branchName || stock.locationLabel}: ${stock.availableQuantity}`).join(" · ")}
                        </div>
                      )}
                      {strictStockEnabled && (
                        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          Límite local para venta inmediata: {buckets.localAvailable}
                        </div>
                      )}
                      <Button
                        onClick={() => addItem(product)}
                        className="w-full"
                        disabled={disableAddButton || reachedLocalLimit}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {disableAddButton
                          ? "Sin stock local"
                          : reachedLocalLimit
                            ? "Límite alcanzado"
                            : "Agregar al remito"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground">
                No hay productos para los filtros elegidos.
              </div>
            )}
          </div>

          <div className="flex max-w-full flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Página <strong>{meta.page}</strong> de <strong>{meta.totalPages}</strong>
              {" "}| Mostrando <strong>{products.length}</strong> registros de <strong>{meta.total.toLocaleString()}</strong>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={!meta.hasPreviousPage || loading}>
                Anterior
              </Button>
              <Button variant="outline" onClick={() => setPage((current) => current + 1)} disabled={!meta.hasNextPage || loading}>
                Siguiente
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="sticky top-4 rounded-xl border border-border bg-card">
            <div className="grid h-[calc(100dvh-7rem)] min-h-[28rem] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 overflow-hidden p-4">
              <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold text-foreground">Remito</h2>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Cliente</Label>
                  <Input
                    list="sales-customers"
                    value={customerInputValue}
                    onChange={(e) => handleCustomerInputChange(e.target.value)}
                    placeholder="Buscar cliente o escribir nombre libre"
                    className="mt-2"
                  />
                  <datalist id="sales-customers">
                    {customers.map((customer) => <option key={customer.id} value={customer.fullName} />)}
                  </datalist>
                </div>

                <div>
                  <Label>Notas para caja</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones del cliente o de caja" className="mt-2" />
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto pr-1">
                <div className="space-y-3">
                  {items.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      Todavía no agregaste productos al remito.
                    </div>
                  ) : items.map((item) => (
                    <div key={item.variantId} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">{item.name}</div>
                          <div className="text-xs text-muted-foreground">{item.sku || "Sin SKU"}</div>
                        </div>
                        <Button variant="outline" onClick={() => removeItem(item.variantId)}>Quitar</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            min="1"
                            max={strictStockEnabled ? Math.max(1, productLocalStockMap.get(item.variantId) ?? item.localAvailable ?? 1) : undefined}
                            value={item.quantity}
                            onChange={(e) => updateItem(item.variantId, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                            className="mt-2"
                          />
                          {strictStockEnabled && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Máximo disponible local: {productLocalStockMap.get(item.variantId) ?? item.localAvailable ?? 0}
                            </div>
                          )}
                        </div>
                        <div>
                          <Label>Precio venta</Label>
                          <Input type="number" min="0" value={item.price} onChange={(e) => updateItem(item.variantId, { price: Math.max(0, Number(e.target.value) || 0) })} className="mt-2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border bg-card pt-3">
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Total de ítems</span>
                    <span>{items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-lg font-semibold text-foreground">
                    <span>Total</span>
                    <span>${total.toLocaleString("es-AR")}</span>
                  </div>
                </div>

                <Button onClick={handleSubmit} disabled={submitting || items.length === 0} className="mt-3 h-11 w-full">
                  <Send className="w-4 h-4 mr-2" />
                  {submitting ? "Enviando..." : "Crear y enviar a caja"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
