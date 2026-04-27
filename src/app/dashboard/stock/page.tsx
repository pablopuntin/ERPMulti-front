"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, History, Package, RefreshCw, Truck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { productsAPI, stockAPI } from "@/services/api";
import { useAuth } from "@/components/auth/AuthContext";

type BranchOption = {
  id: string;
  name: string;
};

type VariantOption = {
  id: string;
  name: string;
  sku?: string;
  stock?: number;
  totalStock?: number;
  stockByBranch?: Array<{
    id?: string;
    locationType?: string;
    branchId: string | null;
    branchName: string | null;
    locationLabel?: string;
    availableQuantity: number;
    quantity: number;
    reservedQuantity: number;
    isLowStock: boolean;
    minStock?: number;
  }>;
};

type TransferHistoryItem = {
  id: string;
  status: string;
  fromLocationType: string;
  toLocationType: string;
  quantity: number;
  reason?: string | null;
  createdAt: string;
  variant?: {
    id: string;
    name: string;
    sku?: string;
  };
  fromBranch?: {
    id: string;
    name: string;
  } | null;
  toBranch?: {
    id: string;
    name: string;
  } | null;
};

type ViewMode = "stock" | "transit" | "history";

export default function StockPage() {
  const { user } = useAuth();
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [transferHistory, setTransferHistory] = useState<TransferHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("stock");
  const [variantFilter, setVariantFilter] = useState("all");
  const [variantFilterSearch, setVariantFilterSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [variantSearch, setVariantSearch] = useState("");
  const [transferForm, setTransferForm] = useState({
    variantId: "",
    fromLocationType: "branch",
    fromBranchId: "",
    toLocationType: "warehouse",
    toBranchId: "",
    quantity: "1",
    reason: "",
  });
  const activeBranchId = user?.activeBranchId || user?.branchId || "";

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === transferForm.variantId) || null,
    [transferForm.variantId, variants]
  );

  const filteredVariantOptions = useMemo(() => {
    const query = variantSearch.trim().toLowerCase();

    if (!query) {
      return variants;
    }

    return variants.filter((variant) => {
      const searchableText = `${variant.name || ""} ${variant.sku || ""}`.toLowerCase();
      return searchableText.includes(query);
    });
  }, [variantSearch, variants]);

  const variantsWithStock = useMemo(() => {
    return variants.filter((variant) => {
      const branchAvailable = (variant.stockByBranch || []).reduce(
        (sum, item) => sum + Number(item.availableQuantity || 0),
        0
      );

      return branchAvailable > 0 || Number(variant.stock || 0) > 0 || Number(variant.totalStock || 0) > 0;
    });
  }, [variants]);

  const variantsInTransit = useMemo(() => {
    return variants.filter((variant) =>
      (variant.stockByBranch || []).some(
        (location) => location.locationType === "transit" && Number(location.availableQuantity || 0) > 0
      )
    );
  }, [variants]);

  const viewVariantOptions = useMemo(() => {
    if (viewMode === "stock") {
      return variantsWithStock;
    }

    if (viewMode === "transit") {
      return variantsInTransit;
    }

    return variants;
  }, [variants, variantsInTransit, variantsWithStock, viewMode]);

  const searchableViewVariantOptions = useMemo(() => {
    const query = variantFilterSearch.trim().toLowerCase();

    if (!query) {
      return viewVariantOptions;
    }

    return viewVariantOptions.filter((variant) => {
      const searchableText = `${variant.name || ""} ${variant.sku || ""}`.toLowerCase();
      return searchableText.includes(query);
    });
  }, [variantFilterSearch, viewVariantOptions]);

  const filteredStockRows = useMemo(() => {
    const source = viewMode === "transit" ? variantsInTransit : variantsWithStock;

    return source.filter((variant) => variantFilter === "all" || variant.id === variantFilter);
  }, [variantFilter, variantsInTransit, variantsWithStock, viewMode]);

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return transferHistory.filter((item) => {
      const matchesVariant = variantFilter === "all" || item.variant?.id === variantFilter;
      if (!matchesVariant) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        item.variant?.name,
        item.variant?.sku,
        item.fromBranch?.name,
        item.toBranch?.name,
        item.fromLocationType,
        item.toLocationType,
        item.status,
        item.reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [historySearch, transferHistory, variantFilter]);

  const loadTransferHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await stockAPI.getTransfers();
      setTransferHistory(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "No se pudo cargar el historial de transferencias.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const enrichVariantsWithLocations = async (catalogItems: VariantOption[]) => {
    const items = Array.isArray(catalogItems) ? catalogItems : [];
    if (items.length === 0) {
      return [];
    }

    const locationsPerVariant: Array<[string, NonNullable<VariantOption["stockByBranch"]>]> = await Promise.all(
      items.map(async (variant) => {
        try {
          const locations = await productsAPI.getStockByBranch(variant.id);
          return [variant.id, Array.isArray(locations) ? (locations as NonNullable<VariantOption["stockByBranch"]>) : []];
        } catch {
          return [variant.id, []];
        }
      })
    );

    const locationMap = new Map(locationsPerVariant);

    return items.map((variant) => {
      const locations = locationMap.get(variant.id) || [];
      const totalAvailable = locations.reduce(
        (sum, location) => sum + Number(location.availableQuantity || 0),
        0
      );

      return {
        ...variant,
        stockByBranch: locations,
        totalStock: totalAvailable,
        stock: totalAvailable,
      };
    });
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [catalog, transfers] = await Promise.all([
          productsAPI.getCatalog({ page: 1, limit: 100, ...(activeBranchId ? { branchId: activeBranchId } : {}) }),
          stockAPI.getTransfers(),
        ]);

        const enrichedVariants = await enrichVariantsWithLocations(Array.isArray(catalog?.items) ? catalog.items : []);
        setVariants(enrichedVariants);
        setTransferHistory(Array.isArray(transfers) ? transfers : []);

        const token = localStorage.getItem("token");
        if (token) {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/branches`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const branchData = await response.json();
            setBranches(Array.isArray(branchData) ? branchData : []);
          }
        }
      } catch (error: any) {
        setMessage(error?.response?.data?.message || "No se pudo cargar el módulo de transferencias.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeBranchId]);

  useEffect(() => {
    if (!transferForm.variantId && variants.length > 0) {
      setTransferForm((prev) => ({
        ...prev,
        variantId: variants[0].id,
      }));
    }
  }, [transferForm.variantId, variants]);

  const handleTransferSubmit = async () => {
    if (!transferForm.variantId) {
      setMessage("Seleccioná una variante para transferir.");
      return;
    }

    const quantity = Number(transferForm.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage("Ingresá una cantidad válida mayor a cero.");
      return;
    }

    if (transferForm.fromLocationType === "branch" && !transferForm.fromBranchId) {
      setMessage("Seleccioná la sucursal de origen.");
      return;
    }

    if (transferForm.toLocationType === "branch" && !transferForm.toBranchId) {
      setMessage("Seleccioná la sucursal de destino.");
      return;
    }

    setTransferLoading(true);
    setMessage(null);

    try {
      const storedUser = localStorage.getItem("user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const userId = parsedUser?.userId || parsedUser?.id;

      const result = await stockAPI.transfer({
        variantId: transferForm.variantId,
        from: {
          locationType: transferForm.fromLocationType,
          ...(transferForm.fromLocationType === "branch" ? { branchId: transferForm.fromBranchId } : {}),
        },
        to: {
          locationType: transferForm.toLocationType,
          ...(transferForm.toLocationType === "branch" ? { branchId: transferForm.toBranchId } : {}),
        },
        quantity,
        reason: transferForm.reason || undefined,
        ...(userId ? { userId } : {}),
      });

      setMessage(result?.message || "Transferencia realizada correctamente.");
      setTransferForm((prev) => ({
        ...prev,
        quantity: "1",
        reason: "",
      }));

      const [catalog, transfers] = await Promise.all([
        productsAPI.getCatalog({ page: 1, limit: 100, ...(activeBranchId ? { branchId: activeBranchId } : {}) }),
        stockAPI.getTransfers(),
      ]);

      const enrichedVariants = await enrichVariantsWithLocations(Array.isArray(catalog?.items) ? catalog.items : []);
      setVariants(enrichedVariants);
      setTransferHistory(Array.isArray(transfers) ? transfers : []);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || "No se pudo realizar la transferencia.");
    } finally {
      setTransferLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 py-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Transferencias de stock</h1>
          <p className="text-muted-foreground mt-1">
            Gestioná transferencias entre sucursales, depósito y tránsito desde un módulo dedicado.
          </p>
        </div>
        <Button variant="outline" onClick={loadTransferHistory} disabled={historyLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${historyLoading ? "animate-spin" : ""}`} />
          Actualizar historial
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Nueva transferencia</h2>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Variante</label>
            <Input
              value={variantSearch}
              onChange={(e) => setVariantSearch(e.target.value)}
              placeholder="Buscar por nombre o SKU"
              className="mb-2"
            />
            <select
              value={transferForm.variantId}
              onChange={(e) => setTransferForm((prev) => ({ ...prev, variantId: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="">Seleccionar variante</option>
              {filteredVariantOptions.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name} ({variant.sku || "Sin SKU"})
                </option>
              ))}
            </select>
            {variantSearch.trim() && filteredVariantOptions.length === 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                No se encontraron variantes para esa búsqueda.
              </div>
            )}
          </div>

          {selectedVariant && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
              <div className="text-sm font-medium text-foreground">Stock real por ubicación</div>
              {selectedVariant.stockByBranch && selectedVariant.stockByBranch.length > 0 ? (
                <div className="space-y-2">
                  {selectedVariant.stockByBranch.map((stock) => (
                    <div key={`${stock.locationType}-${stock.branchId || stock.locationLabel || "location"}`} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{stock.locationLabel || stock.branchName || stock.locationType}</span>
                      <span className="font-medium text-foreground">{stock.availableQuantity} disponibles</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No hay stock cargado por ubicación para esta variante.</div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Origen</label>
              <select
                value={transferForm.fromLocationType}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, fromLocationType: e.target.value, fromBranchId: e.target.value === "branch" ? prev.fromBranchId : "" }))}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="branch">Sucursal</option>
                <option value="warehouse">Depósito</option>
                <option value="transit">Tránsito</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Destino</label>
              <select
                value={transferForm.toLocationType}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, toLocationType: e.target.value, toBranchId: e.target.value === "branch" ? prev.toBranchId : "" }))}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="branch">Sucursal</option>
                <option value="warehouse">Depósito</option>
                <option value="transit">Tránsito</option>
              </select>
            </div>
          </div>

          {transferForm.fromLocationType === "branch" && (
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Sucursal origen</label>
              <select
                value={transferForm.fromBranchId}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, fromBranchId: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Seleccionar sucursal</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          )}

          {transferForm.toLocationType === "branch" && (
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Sucursal destino</label>
              <select
                value={transferForm.toBranchId}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, toBranchId: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="">Seleccionar sucursal</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Cantidad</label>
              <Input
                type="number"
                min="1"
                value={transferForm.quantity}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Motivo</label>
              <Input
                value={transferForm.reason}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Redistribución interna"
              />
            </div>
          </div>

          {message && (
            <div className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">
              {message}
            </div>
          )}

          <Button onClick={handleTransferSubmit} disabled={transferLoading} className="w-full">
            {transferLoading ? "Transfiriendo..." : "Confirmar transferencia"}
          </Button>
        </div>

        <div className="xl:col-span-3 bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button variant={viewMode === "stock" ? "default" : "outline"} onClick={() => setViewMode("stock")}>
                <Package className="w-4 h-4 mr-2" />
                Con stock
              </Button>
              <Button variant={viewMode === "transit" ? "default" : "outline"} onClick={() => setViewMode("transit")}>
                <Truck className="w-4 h-4 mr-2" />
                En tránsito
              </Button>
              <Button variant={viewMode === "history" ? "default" : "outline"} onClick={() => setViewMode("history")}>
                <History className="w-4 h-4 mr-2" />
                Historial
              </Button>
            </div>
            <div className="w-full md:w-72">
              <Input
                value={variantFilterSearch}
                onChange={(e) => setVariantFilterSearch(e.target.value)}
                placeholder="Buscar variante para filtrar"
                className="mb-2"
              />
              <select
                value={variantFilter}
                onChange={(e) => setVariantFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="all">Todas las variantes</option>
                {searchableViewVariantOptions.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.name} ({variant.sku || "Sin SKU"})
                  </option>
                ))}
              </select>
              {variantFilterSearch.trim() && searchableViewVariantOptions.length === 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  No hay variantes que coincidan con ese filtro.
                </div>
              )}
            </div>
          </div>

          {viewMode === "history" ? (
            <>
              <div className="w-full md:w-80">
                <Input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Buscar por variante, SKU u origen/destino"
                />
              </div>

              <div className="max-h-[620px] overflow-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Fecha</th>
                      <th className="text-left p-3 font-medium">Variante</th>
                      <th className="text-left p-3 font-medium">Origen</th>
                      <th className="text-left p-3 font-medium">Destino</th>
                      <th className="text-left p-3 font-medium">Cantidad</th>
                      <th className="text-left p-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyLoading ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">Cargando historial...</td>
                      </tr>
                    ) : filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">No hay transferencias para mostrar.</td>
                      </tr>
                    ) : (
                      filteredHistory.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="p-3">{new Date(item.createdAt).toLocaleString()}</td>
                          <td className="p-3">
                            <div className="font-medium text-foreground">{item.variant?.name || "Variante"}</div>
                            <div className="text-xs text-muted-foreground">{item.variant?.sku || "Sin SKU"}</div>
                          </td>
                          <td className="p-3">{item.fromBranch?.name || item.fromLocationType}</td>
                          <td className="p-3">{item.toBranch?.name || item.toLocationType}</td>
                          <td className="p-3">{item.quantity}</td>
                          <td className="p-3">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="max-h-[620px] overflow-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium">Variante</th>
                    <th className="text-left p-3 font-medium">SKU</th>
                    <th className="text-left p-3 font-medium">Stock visible</th>
                    <th className="text-left p-3 font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStockRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        {viewMode === "transit" ? "No hay variantes en tránsito para mostrar." : "No hay variantes con stock para mostrar."}
                      </td>
                    </tr>
                  ) : (
                    filteredStockRows.map((variant) => {
                      const visibleLocations = (variant.stockByBranch || []).filter((location) => {
                        if (viewMode === "transit") {
                          return location.locationType === "transit" && Number(location.availableQuantity || 0) > 0;
                        }

                        return Number(location.availableQuantity || 0) > 0;
                      });

                      const visibleStock = visibleLocations.reduce(
                        (sum, item) => sum + Number(item.availableQuantity || 0),
                        0
                      );

                      return (
                        <tr key={variant.id} className="border-t border-border align-top">
                          <td className="p-3 font-medium text-foreground">{variant.name}</td>
                          <td className="p-3 text-muted-foreground">{variant.sku || "Sin SKU"}</td>
                          <td className="p-3">{visibleStock}</td>
                          <td className="p-3">
                            <div className="space-y-1">
                              {visibleLocations.length > 0 ? (
                                visibleLocations.map((stock) => (
                                  <div key={`${stock.locationType}-${stock.branchId || stock.locationLabel || "location"}`} className="text-xs text-muted-foreground">
                                    {(stock.locationLabel || stock.branchName || stock.locationType)}: {stock.availableQuantity} disponibles
                                  </div>
                                ))
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  {viewMode === "transit" ? "Sin stock disponible actualmente en tránsito." : "Sin stock disponible por ubicación."}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Package className="w-4 h-4" />
            Elegí si querés ver variantes con stock, variantes en tránsito o el historial de transferencias.
          </div>
        </div>
      </div>
    </div>
  );
}
