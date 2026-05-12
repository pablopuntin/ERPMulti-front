"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/AuthContext";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Filter,
  Eye,
  Wrench,
  History
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { useProducts } from "./hooks/useProducts";
import { StockDisplay } from "@/components/products/StockDisplay";
import { Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import { branchesAPI, brandsAPI, categoriesAPI, productsAPI, productsBaseAPI, stockAPI } from "@/services/api";
import CategoryModal from "@/app/components/categories/CategoryModal";

type FilterOption = {
  id: string;
  name: string;
};

type BulkActionType = "price" | "stock";
type BulkStockMode = "increment" | "set";
type BulkStockLocationType = "branch" | "warehouse" | "transit";

export default function ProductsPage() {
  const router = useRouter();
  const { user, canAccessAllBranches } = useAuth();
  const pagerRef = useRef<HTMLDivElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedProductBase, setSelectedProductBase] = useState("all");
  const [selectedVariant, setSelectedVariant] = useState("all");
  const [page, setPage] = useState(1);
  const [categoryOptions, setCategoryOptions] = useState<FilterOption[]>([]);
  const [brandOptions, setBrandOptions] = useState<FilterOption[]>([]);
  const [productBaseOptions, setProductBaseOptions] = useState<FilterOption[]>([]);
  const [branchOptions, setBranchOptions] = useState<FilterOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionType, setBulkActionType] = useState<BulkActionType>("price");
  const [bulkMode, setBulkMode] = useState<"percentage" | "fixed" | "direct">("percentage");
  const [bulkBase, setBulkBase] = useState<"salePrice" | "purchasePrice">("salePrice");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkStockMode, setBulkStockMode] = useState<BulkStockMode>("increment");
  const [bulkStockLocationType, setBulkStockLocationType] = useState<BulkStockLocationType>("branch");
  const [bulkStockBranchId, setBulkStockBranchId] = useState("");
  const [bulkStockMinStock, setBulkStockMinStock] = useState("");
  const [bulkTarget, setBulkTarget] = useState<"selected" | "filtered">("selected");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [floatingPager, setFloatingPager] = useState({
    visible: false,
    top: 0,
    left: 0,
    width: 0,
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    product: any | null;
  }>({ open: false, product: null });
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState<string | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState<Record<string, { newQuantity: string; reason: string }>>({});
  const [adjustmentHistoryDialogOpen, setAdjustmentHistoryDialogOpen] = useState(false);
  const [adjustmentHistory, setAdjustmentHistory] = useState<any[]>([]);
  const [adjustmentHistoryLoading, setAdjustmentHistoryLoading] = useState(false);
  const activeBranchId = user?.activeBranchId || user?.branchId || "";

  const queryParams = useMemo(() => ({
    page,
    limit: 50,
    ...(activeBranchId ? { branchId: activeBranchId } : {}),
    ...(debouncedSearchTerm.trim() ? { search: debouncedSearchTerm.trim() } : {}),
    ...(selectedCategory !== "all" ? { categoryId: selectedCategory } : {}),
    ...(selectedBrand !== "all" ? { brandId: selectedBrand } : {}),
    ...(selectedProductBase !== "all" ? { productBaseId: selectedProductBase } : {}),
    ...(selectedVariant !== "all" ? { variantId: selectedVariant } : {}),
  }), [page, activeBranchId, debouncedSearchTerm, selectedCategory, selectedBrand, selectedProductBase, selectedVariant]);

  const { 
    products,
    meta,
    loading, 
    error, 
    refreshProducts,
    deleteProduct 
  } = useProducts(queryParams);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [categories, brands, productBases, branches] = await Promise.all([
          categoriesAPI.getAll(),
          brandsAPI.getAll(),
          productsBaseAPI.getAll({ limit: 10000, ...(activeBranchId ? { branchId: activeBranchId } : {}) }),
          branchesAPI.getAll(),
        ]);

        setCategoryOptions(Array.isArray(categories) ? categories.map((item: any) => ({ id: item.id, name: item.name })) : []);
        setBrandOptions(Array.isArray(brands) ? brands.map((item: any) => ({ id: item.id, name: item.name })) : []);
        setProductBaseOptions(
          (Array.isArray(productBases?.items) ? productBases.items : Array.isArray(productBases) ? productBases : [])
            .map((item: any) => ({ id: item.id, name: item.name }))
            .filter((item: FilterOption) => Boolean(item.id && item.name))
            .sort((a: FilterOption, b: FilterOption) => a.name.localeCompare(b.name))
        );
        const mappedBranches = Array.isArray(branches) ? branches.map((item: any) => ({ id: item.id, name: item.name })) : [];
        setBranchOptions(mappedBranches);
        setBulkStockBranchId((current) => current || mappedBranches[0]?.id || "");
      } catch (filterError) {
        console.error('Error loading filter options:', filterError);
      }
    };

    loadFilterOptions();
  }, [activeBranchId]);

  const refreshCategoryOptions = async (preferredCategoryId?: string, preferredCategoryName?: string) => {
    try {
      const categories = await categoriesAPI.getAll();
      const mappedCategories = Array.isArray(categories) ? categories.map((item: any) => ({ id: item.id, name: item.name })) : [];
      setCategoryOptions(mappedCategories);

      const matchedCategory = mappedCategories.find((item) => item.id === preferredCategoryId)
        || mappedCategories.find((item) => item.name?.trim().toLowerCase() === preferredCategoryName?.trim().toLowerCase());

      if (matchedCategory) {
        setSelectedCategory(matchedCategory.id);
      }
    } catch (error) {
      console.error('Error refreshing categories:', error);
    }
  };

  const handleCategorySaved = async (savedCategory?: any) => {
    const preferredCategoryId = savedCategory?.id;
    const preferredCategoryName = savedCategory?.name || editingCategory?.name;
    await refreshCategoryOptions(preferredCategoryId, preferredCategoryName);
    setCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const variantOptions = useMemo(() => {
    return products.map((product) => ({ id: product.id, name: product.name }));
  }, [products]);

  const filteredProducts = products;

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.includes(product.id));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredProducts.some((product) => product.id === id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredProducts.map((product) => product.id)])));
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedIds((prev) => prev.includes(productId)
      ? prev.filter((id) => id !== productId)
      : [...prev, productId]);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setSelectedCategory("all");
    setSelectedBrand("all");
    setSelectedProductBase("all");
    setSelectedVariant("all");
    setPage(1);
    setSelectedIds([]);
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setPage(1);
  };

  const handleBrandChange = (value: string) => {
    setSelectedBrand(value);
    setPage(1);
  };

  const handleProductBaseChange = (value: string) => {
    setSelectedProductBase(value);
    setPage(1);
  };

  const handleVariantChange = (value: string) => {
    setSelectedVariant(value);
    setPage(1);
  };

  const canImportMassively = user?.role === "root" || user?.role === "gerente_general" || user?.role === "gerente_sucursal";
  const activeBranchName = useMemo(
    () => branchOptions.find((branch) => branch.id === activeBranchId)?.name || "Sucursal activa",
    [branchOptions, activeBranchId],
  );

  const handleExportImportTemplate = async () => {
    try {
      const blob = await productsBaseAPI.exportImportTemplateCsv(
        activeBranchId ? { branchId: activeBranchId } : undefined
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `productos-import-${activeBranchName.replace(/\s+/g, '-').toLowerCase()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setImportMessage('CSV exportado correctamente. Podés editarlo en Excel y reimportarlo desde otra sucursal activa.');
    } catch (exportError: any) {
      setImportMessage(exportError?.response?.data?.message || 'No se pudo exportar el CSV de productos.');
    }
  };
  const requiresGlobalBranchSelection = canAccessAllBranches() && !activeBranchId;
  const resolvedBulkStockBranchId = bulkStockLocationType === "branch" ? activeBranchId : bulkStockBranchId;
  const resolvedBulkStockLocationName = branchOptions.find((branch) => branch.id === resolvedBulkStockBranchId)?.name
    || (bulkStockLocationType === "branch" ? activeBranchName : "Sin selección");

  const targetProducts = useMemo(() => {
    return bulkTarget === "selected"
      ? filteredProducts.filter((product) => selectedIds.includes(product.id))
      : filteredProducts;
  }, [bulkTarget, filteredProducts, selectedIds]);

  const parsedBulkValue = Number(bulkValue);

  const previewRows = useMemo(() => {
    if (!Number.isFinite(parsedBulkValue)) {
      return [];
    }

    return targetProducts.map((product) => {
      const currentPrice = Number(product.price || 0);
      const purchasePrice = Number(product.purchasePrice || 0);
      const baseValue = bulkMode === "direct"
        ? currentPrice
        : bulkBase === "purchasePrice"
          ? purchasePrice
          : currentPrice;

      const nextPrice = bulkMode === "direct"
        ? parsedBulkValue
        : bulkMode === "percentage"
          ? baseValue + (baseValue * parsedBulkValue) / 100
          : baseValue + parsedBulkValue;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku || "Sin SKU",
        currentPrice,
        purchasePrice,
        nextPrice: Math.max(0, Number(nextPrice.toFixed(2))),
      };
    });
  }, [bulkBase, bulkMode, parsedBulkValue, targetProducts]);

  const openPreviewDialog = () => {
    if (bulkActionType === "stock") {
      if (!Number.isFinite(parsedBulkValue)) {
        setBulkMessage("Ingresá una cantidad válida para previsualizar el stock masivo.");
        return;
      }

      if (bulkStockLocationType === "branch" && !activeBranchId) {
        setBulkMessage("Seleccioná una sucursal activa desde la barra superior para actualizar stock por sucursal.");
        return;
      }

      if (!resolvedBulkStockBranchId) {
        setBulkMessage("Seleccioná una ubicación para actualizar stock.");
        return;
      }

      if (targetProducts.length === 0) {
        setBulkMessage("No hay variantes objetivo para actualizar stock.");
        return;
      }

      setBulkMessage(null);
      setPreviewDialogOpen(true);
      return;
    }

    if (!Number.isFinite(parsedBulkValue)) {
      setBulkMessage("Ingresá un valor válido para previsualizar el cambio masivo.");
      return;
    }

    if (targetProducts.length === 0) {
      setBulkMessage("No hay variantes objetivo para actualizar el precio.");
      return;
    }

    setBulkMessage(null);
    setPreviewDialogOpen(true);
  };

  const handleBulkPriceUpdate = async () => {
    if (!Number.isFinite(parsedBulkValue)) {
      setBulkMessage("Ingresá un valor válido para aplicar el cambio masivo.");
      return;
    }

    if (targetProducts.length === 0) {
      setBulkMessage("No hay variantes objetivo para actualizar el precio.");
      return;
    }

    setBulkLoading(true);
    setBulkMessage(null);

    try {
      const result = await productsAPI.bulkUpdatePrices({
        variantIds: targetProducts.map((product) => product.id),
        mode: bulkMode,
        base: bulkBase,
        value: parsedBulkValue,
      });

      setBulkMessage(`Se actualizaron ${result.updatedCount ?? targetProducts.length} variantes correctamente.`);
      setSelectedIds([]);
      setBulkValue("");
      setPreviewDialogOpen(false);
      refreshProducts();
    } catch (bulkError: any) {
      setBulkMessage(bulkError?.response?.data?.message || "No se pudieron actualizar los precios masivamente.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkStockUpdate = async () => {
    if (!Number.isFinite(parsedBulkValue)) {
      setBulkMessage("Ingresá una cantidad válida para aplicar el stock masivo.");
      return;
    }

    if (bulkStockLocationType === "branch" && !activeBranchId) {
      setBulkMessage("Seleccioná una sucursal activa desde la barra superior para actualizar stock por sucursal.");
      return;
    }

    if (!resolvedBulkStockBranchId) {
      setBulkMessage("Seleccioná una ubicación para actualizar stock.");
      return;
    }

    if (targetProducts.length === 0) {
      setBulkMessage("No hay variantes objetivo para actualizar stock.");
      return;
    }

    setBulkLoading(true);
    setBulkMessage(null);

    try {
      const result = await productsAPI.bulkUpdateStock({
        variantIds: targetProducts.map((product) => product.id),
        mode: bulkStockMode,
        locationType: bulkStockLocationType,
        branchId: resolvedBulkStockBranchId,
        value: parsedBulkValue,
        ...(bulkStockMinStock !== "" ? { minStock: Number(bulkStockMinStock) } : {}),
      });

      setBulkMessage(`Se actualizaron ${result.updatedCount ?? targetProducts.length} variantes en ${result.branchName ?? resolvedBulkStockLocationName}.`);
      setSelectedIds([]);
      setBulkValue("");
      setBulkStockMinStock("");
      setPreviewDialogOpen(false);
      refreshProducts();
    } catch (bulkError: any) {
      setBulkMessage(bulkError?.response?.data?.message || "No se pudo actualizar el stock masivamente.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePreviewImport = async () => {
    if (!importFile) {
      setImportMessage("Seleccioná un archivo Excel para previsualizar.");
      return;
    }

    if (!activeBranchId) {
      setImportMessage("Seleccioná una sucursal activa antes de importar productos. La importación asignará las variantes a esa sucursal.");
      return;
    }

    setImportLoading(true);
    setImportMessage(null);

    try {
      const result = await productsBaseAPI.previewImportFile(importFile);
      setImportPreview(result);
    } catch (previewError: any) {
      setImportPreview(null);
      setImportMessage(previewError?.response?.data?.message || "No se pudo generar el preview de importación.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importFile) {
      setImportMessage("Seleccioná un archivo Excel para importar.");
      return;
    }

    if (!activeBranchId) {
      setImportMessage("Seleccioná una sucursal activa antes de importar productos. La importación asignará las variantes a esa sucursal.");
      return;
    }

    setImportLoading(true);
    setImportMessage(null);

    try {
      const result = await productsBaseAPI.importFile(importFile);
      setImportMessage(result?.message || "Importación completada correctamente.");
      setImportPreview(null);
      setImportFile(null);
      setImportDialogOpen(false);
      refreshProducts();
    } catch (importError: any) {
      const backendMessage = importError?.response?.data?.message;
      const resolvedMessage = Array.isArray(backendMessage)
        ? backendMessage.join(" | ")
        : backendMessage || "No se pudo completar la importación.";
      setImportMessage(resolvedMessage);
    } finally {
      setImportLoading(false);
    }
  };

  const handleDelete = async (product: any) => {
    setDeleteDialog({ open: true, product });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.product) return;

    try {
      await deleteProduct(deleteDialog.product.id);
      setDeleteDialog({ open: false, product: null });
      refreshProducts();
    } catch (err) {
      alert("Error al eliminar el producto");
    }
  };

  const handleAdjustmentOpen = () => {
    if (selectedIds.length === 0) {
      setAdjustmentMessage("Seleccioná al menos un producto para ajustar.");
      setAdjustmentDialogOpen(true);
      return;
    }

    if (!activeBranchId) {
      setAdjustmentMessage("Seleccioná una sucursal activa para hacer ajustes.");
      setAdjustmentDialogOpen(true);
      return;
    }

    // Inicializar formulario con los productos seleccionados
    const initialForm: Record<string, { newQuantity: string; reason: string }> = {};
    selectedIds.forEach(id => {
      initialForm[id] = { newQuantity: "", reason: "" };
    });
    setAdjustmentForm(initialForm);
    setAdjustmentMessage(null);
    setAdjustmentDialogOpen(true);
  };

  const handleAdjustmentSubmit = async () => {
    if (!activeBranchId) {
      setAdjustmentMessage("Seleccioná una sucursal activa para hacer ajustes.");
      return;
    }

    // Validar que todos los productos tengan cantidad y motivo
    const invalidProducts = selectedIds.filter(id => {
      const form = adjustmentForm[id];
      return !form || !form.newQuantity || !form.reason;
    });

    if (invalidProducts.length > 0) {
      setAdjustmentMessage("Completá la nueva cantidad y el motivo para todos los productos seleccionados.");
      return;
    }

    setAdjustmentLoading(true);
    setAdjustmentMessage(null);

    try {
      const results = await Promise.all(
        selectedIds.map(async (variantId) => {
          const form = adjustmentForm[variantId];
          const newQuantity = Number(form.newQuantity);

          if (newQuantity < 0) {
            return { variantId, error: "La cantidad no puede ser negativa" };
          }

          try {
            const result = await stockAPI.createAdjustment({
              variantId,
              branchId: activeBranchId,
              newQuantity,
              reason: form.reason,
            });
            return { variantId, success: true, result };
          } catch (error: any) {
            return { variantId, error: error?.response?.data?.message || "Error al ajustar" };
          }
        })
      );

      const errors = results.filter(r => r.error);
      const successes = results.filter(r => r.success);

      if (errors.length === 0) {
        setAdjustmentMessage(`✅ Se ajustaron ${successes.length} productos correctamente.`);
        setSelectedIds([]);
        setAdjustmentForm({});
        setTimeout(() => {
          setAdjustmentDialogOpen(false);
          refreshProducts();
        }, 2000);
      } else {
        setAdjustmentMessage(`⚠️ ${successes.length} ajustados, ${errors.length} con errores. Revisá los detalles.`);
      }
    } catch (error: any) {
      setAdjustmentMessage(error?.response?.data?.message || "Error al realizar ajustes.");
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const handleAdjustmentHistoryOpen = async () => {
    setAdjustmentHistoryDialogOpen(true);
    setAdjustmentHistoryLoading(true);
    try {
      const history = await stockAPI.getAdjustmentHistory();
      setAdjustmentHistory(history);
    } catch (error: any) {
      console.error("Error loading adjustment history:", error);
    } finally {
      setAdjustmentHistoryLoading(false);
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

  if (error) {
    return (
      <div className="w-full px-4 py-6 space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error de Conexión</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={refreshProducts}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full px-4 py-6 space-y-6">
      {typeof document !== 'undefined' && floatingPager.visible && createPortal(
        <div
          className="fixed z-[100]"
          style={{
            top: `${floatingPager.top}px`,
            left: `${floatingPager.left}px`,
            width: `${floatingPager.width}px`,
          }}
        >
          <div className="flex max-w-full flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Página <strong>{meta.page}</strong> de <strong>{meta.totalPages}</strong>
              {' '}| Mostrando <strong>{products.length}</strong> registros de <strong>{meta.total.toLocaleString()}</strong>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={!meta.hasPreviousPage || loading}>
                Anterior
              </Button>
              <Button variant="outline" onClick={() => setPage((prev) => prev + 1)} disabled={!meta.hasNextPage || loading}>
                Siguiente
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Gestión de Productos
          </h1>
          <p className="text-muted-foreground mt-1">
            {activeBranchId
              ? `Administrá el catálogo asignado a ${activeBranchName} (${meta.total.toLocaleString()} variantes).`
              : `Seleccioná una sucursal activa para operar productos (${meta.total.toLocaleString()} variantes visibles).`}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportImportTemplate}
            disabled={!activeBranchId}
          >
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEditingCategory(null);
              setCategoryModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva categoría
          </Button>
          {selectedCategory !== "all" && (
            <Button
              variant="outline"
              onClick={() => {
                setEditingCategory(
                  categoryOptions.find((category) => category.id === selectedCategory) || null
                );
                setCategoryModalOpen(true);
              }}
            >
              <Edit className="w-4 h-4 mr-2" />
              Editar categoría
            </Button>
          )}
          {canImportMassively && (
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Package className="w-4 h-4 mr-2" />
              Importar masivo
            </Button>
          )}
          <Button onClick={() => router.push("/dashboard/products/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <CategoryModal
          open={categoryModalOpen}
          onClose={() => {
            setCategoryModalOpen(false);
            setEditingCategory(null);
          }}
          category={editingCategory || undefined}
          onSaved={handleCategorySaved}
        />

        <div className="flex flex-col xl:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nombre, SKU, producto base, marca o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10"
              />
            </div>
          </div>
          <div className="flex gap-2 xl:self-stretch">
            <Button variant="outline" onClick={clearFilters} className="h-10 whitespace-nowrap">
              <Filter className="w-4 h-4 mr-2" />
              Limpiar filtros
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="all">Todas las categorías</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <select
            value={selectedBrand}
            onChange={(e) => handleBrandChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="all">Todas las marcas</option>
            {brandOptions.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>

          <select
            value={selectedProductBase}
            onChange={(e) => handleProductBaseChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="all">Todos los productos base</option>
            {productBaseOptions.map((productBase) => (
              <option key={productBase.id} value={productBase.id}>{productBase.name}</option>
            ))}
          </select>

          <select
            value={selectedVariant}
            onChange={(e) => handleVariantChange(e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="all">Todas las variantes</option>
            {variantOptions.map((variant) => (
              <option key={variant.id} value={variant.id}>{variant.name}</option>
            ))}
          </select>
        </div>

        <div className="border border-border rounded-xl p-3 space-y-3 bg-card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Acción masiva</label>
              <select
                value={bulkActionType}
                onChange={(e) => setBulkActionType(e.target.value as BulkActionType)}
                className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                <option value="price">Precio</option>
                <option value="stock">Stock</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Ajustes de inventario</label>
              <div className="flex gap-2">
                <Button
                  onClick={handleAdjustmentOpen}
                  disabled={selectedIds.length === 0}
                  className="flex-1 h-9"
                  variant="outline"
                >
                  <Wrench className="w-4 h-4 mr-2" />
                  Ajuste ({selectedIds.length})
                </Button>
                <Button
                  onClick={handleAdjustmentHistoryOpen}
                  className="flex-1 h-9"
                  variant="outline"
                >
                  <History className="w-4 h-4 mr-2" />
                  Historial
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col 2xl:flex-row 2xl:items-end gap-3">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {bulkActionType === "price" ? (
                <>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Modo de ajuste</label>
                <select
                  value={bulkMode}
                  onChange={(e) => setBulkMode(e.target.value as "percentage" | "fixed" | "direct")}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="percentage">Por porcentaje</option>
                  <option value="fixed">Por monto fijo</option>
                  <option value="direct">Reemplazar precio</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Base de cálculo</label>
                <select
                  value={bulkBase}
                  onChange={(e) => setBulkBase(e.target.value as "salePrice" | "purchasePrice")}
                  disabled={bulkMode === "direct"}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="salePrice">Precio actual de venta</option>
                  <option value="purchasePrice">Precio de compra</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Valor</label>
                <Input
                  type="number"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder={bulkMode === "percentage" ? "Ej: 10 o -5" : bulkMode === "fixed" ? "Ej: 1500 o -500" : "Ej: 17500"}
                  className="h-9"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Aplicar sobre</label>
                <select
                  value={bulkTarget}
                  onChange={(e) => setBulkTarget(e.target.value as "selected" | "filtered")}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                >
                  <option value="selected">Solo seleccionados</option>
                  <option value="filtered">Todos los filtrados</option>
                </select>
              </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Modo de stock</label>
                    <select
                      value={bulkStockMode}
                      onChange={(e) => setBulkStockMode(e.target.value as BulkStockMode)}
                      className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="increment">Sumar / restar</option>
                      <option value="set">Reemplazar stock</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Tipo de ubicación</label>
                    <select
                      value={bulkStockLocationType}
                      onChange={(e) => setBulkStockLocationType(e.target.value as BulkStockLocationType)}
                      className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="branch">Sucursal</option>
                      <option value="warehouse">Depósito</option>
                      <option value="transit">Tránsito</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Ubicación</label>
                    {bulkStockLocationType === "branch" ? (
                      <div className="flex h-9 w-full items-center rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-900">
                        {activeBranchId ? activeBranchName : "Seleccionar sucursal activa en la barra superior"}
                      </div>
                    ) : (
                      <select
                        value={bulkStockBranchId}
                        onChange={(e) => setBulkStockBranchId(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      >
                        <option value="">Seleccionar ubicación</option>
                        {branchOptions.map((branch) => (
                          <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Cantidad</label>
                    <Input
                      type="number"
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      placeholder={bulkStockMode === "increment" ? "Ej: 10 o -2" : "Ej: 25"}
                      className="h-9"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Stock mínimo</label>
                    <Input
                      type="number"
                      min="0"
                      value={bulkStockMinStock}
                      onChange={(e) => setBulkStockMinStock(e.target.value)}
                      placeholder="Opcional"
                      className="h-9"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">Aplicar sobre</label>
                    <select
                      value={bulkTarget}
                      onChange={(e) => setBulkTarget(e.target.value as "selected" | "filtered")}
                      className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    >
                      <option value="selected">Solo seleccionados</option>
                      <option value="filtered">Todos los filtrados</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <Button onClick={openPreviewDialog} disabled={bulkLoading} className="h-9 whitespace-nowrap">
              <Package className="w-4 h-4 mr-2" />
              {bulkLoading ? "Actualizando..." : "Previsualizar cambio"}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            {bulkTarget === "selected"
              ? `Seleccionados: ${selectedIds.length}`
              : `Filtrados en página: ${filteredProducts.length} de ${meta.total}`}
          </div>

          <div className="text-xs text-muted-foreground">
            {bulkActionType === "price"
              ? bulkMode === "direct"
                ? 'Se reemplazará directamente el precio de venta actual por el valor indicado y se persistirá en la variante y sus stocks.'
                : bulkBase === "purchasePrice"
                  ? 'El nuevo precio de venta se recalcula usando el precio de compra como base y se persiste en la variante y en sus stocks.'
                  : 'El nuevo precio de venta se recalcula usando el precio actual como base y se persiste en la variante y en sus stocks.'
              : bulkStockMode === "set"
                ? `Se reemplazará el stock disponible de ${bulkStockLocationType === "branch" ? activeBranchName : resolvedBulkStockLocationName} para todas las variantes objetivo.`
                : `Se sumará o restará stock sobre ${bulkStockLocationType === "branch" ? activeBranchName : resolvedBulkStockLocationName} para todas las variantes objetivo.`}
          </div>

          {(bulkActionType === "price" || bulkActionType === "stock") && (
            <div className="text-xs text-foreground bg-muted rounded-lg px-3 py-2">
              <strong>Resumen:</strong>{" "}
              {bulkActionType === "price"
                ? `Cambio de precio sobre ${bulkTarget === "selected" ? "las variantes seleccionadas" : "las variantes filtradas"}.`
                : `Cambio de stock tipo ${bulkStockMode === "set" ? "reemplazo" : "ajuste incremental"} sobre ${bulkStockLocationType === "branch" ? activeBranchName : resolvedBulkStockLocationName}.`}
            </div>
          )}

          {requiresGlobalBranchSelection && bulkActionType === "stock" && bulkStockLocationType === "branch" && (
            <div className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">
              Seleccioná una sucursal activa desde la barra superior para operar stock por sucursal.
            </div>
          )}

          {bulkActionType === "price" && previewRows.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Vista previa rápida: {previewRows.slice(0, 2).map((row) => `${row.name}: $${row.currentPrice.toLocaleString()} → $${row.nextPrice.toLocaleString()}`).join(' | ')}
              {previewRows.length > 2 ? ` | +${previewRows.length - 2} más` : ''}
            </div>
          )}

          {bulkMessage && (
            <div className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">
              {bulkMessage}
            </div>
          )}
        </div>
      </div>

      <div ref={pagerRef} className="flex max-w-full flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Página <strong>{meta.page}</strong> de <strong>{meta.totalPages}</strong>
          {' '}| Mostrando <strong>{products.length}</strong> registros de <strong>{meta.total.toLocaleString()}</strong>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={!meta.hasPreviousPage || loading}>
            Anterior
          </Button>
          <Button variant="outline" onClick={() => setPage((prev) => prev + 1)} disabled={!meta.hasNextPage || loading}>
            Siguiente
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="max-w-full">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="sticky left-0 z-20 bg-muted/50 text-left px-2 py-2 font-medium text-foreground w-[92px] align-top">
                  Acciones
                </th>
                <th className="text-left px-1 py-2 font-medium text-foreground w-[30px] align-top">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                  />
                </th>
                <th className="text-left px-2 py-2 font-medium text-foreground w-[24%] align-top">Variante</th>
                <th className="text-left px-2 py-2 font-medium text-foreground w-[13%] align-top">Producto base</th>
                <th className="text-left px-2 py-2 font-medium text-foreground w-[10%] align-top">Categoría</th>
                <th className="text-left px-2 py-2 font-medium text-foreground w-[10%] align-top">Marca</th>
                <th className="text-left px-2 py-2 font-medium text-foreground w-[6%] align-top">Color</th>
                <th className="text-left px-2 py-2 font-medium text-foreground w-[6%] align-top">Tamaño</th>
                <th className="text-left px-2 py-2 font-medium text-foreground w-[8%] align-top">Precio venta</th>
                <th className="text-left px-2 py-2 font-medium text-foreground w-[8%] align-top">Precio compra</th>
                <th className="text-left px-2 py-2 font-medium text-foreground w-[10%] align-top">Stock por sucursal</th>
                <th className="text-left px-2 py-2 font-medium text-foreground w-[7%] align-top">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-t border-border hover:bg-muted/50">
                  <td className="sticky left-0 z-10 bg-card px-1.5 py-2 align-top w-[92px]">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => router.push(`/dashboard/products/edit/${product.id}`)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                        onClick={() => handleDelete(product)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-1 py-2 align-top w-[30px]">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={() => toggleSelectProduct(product.id)}
                    />
                  </td>
                  <td className="px-2 py-2 align-top break-words leading-tight">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground break-words leading-tight">{product.name}</div>
                        <div className="text-[11px] text-muted-foreground break-all">{product.sku || 'Sin SKU'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground align-top break-words leading-tight">{product.productBase?.name || '-'}</td>
                  <td className="px-2 py-2 text-muted-foreground align-top break-words leading-tight">{product.productBase?.category?.name || '-'}</td>
                  <td className="px-2 py-2 text-muted-foreground align-top break-words leading-tight">{product.productBase?.brand?.name || '-'}</td>
                  <td className="px-2 py-2 text-muted-foreground align-top break-words leading-tight">{product.color || '-'}</td>
                  <td className="px-2 py-2 text-muted-foreground align-top break-words leading-tight">{product.size || '-'}</td>
                  <td className="px-2 py-2 font-medium text-foreground align-top break-words leading-tight">
                    ${product.price.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 font-medium text-foreground align-top break-words leading-tight">
                    ${(product.purchasePrice || 0).toLocaleString()}
                  </td>
                  <td className="px-2 py-2 align-top break-words leading-tight">
                    {product.stockByBranch && product.stockByBranch.length > 0 ? (
                      <StockDisplay stocks={product.stockByBranch} compact={true} />
                    ) : (
                      <span className="text-muted-foreground">Sin stock</span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}>
                      {product.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No se encontraron productos</p>
            <Button 
              className="mt-4"
              onClick={() => router.push("/dashboard/products/new")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear Primer Producto
            </Button>
          </div>
        )}
      </div>

      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Importación masiva de productos</DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-2">
            <Input
              type="file"
              accept=".xlsx,.xls"
              disabled={!activeBranchId}
              onChange={(e) => {
                const nextFile = e.target.files?.[0] || null;
                setImportFile(nextFile);
                setImportPreview(null);
                setImportMessage(null);
              }}
            />

            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
              <strong>Sucursal destino:</strong> {activeBranchId ? activeBranchName : 'Seleccionar sucursal activa en la barra superior'}
              <div className="text-xs text-muted-foreground mt-1">
                Al confirmar, las variantes importadas quedarán asignadas comercialmente a esta sucursal.
              </div>
            </div>

            {canImportMassively && (
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <strong>gerente_sucursal</strong>, <strong>gerente_general</strong> y <strong>root</strong> pueden usar esta carga masiva para replicar catálogo o stock desde un CSV exportado de otra sucursal, siempre respetando la sucursal activa.
              </div>
            )}

            {importPreview?.summary && (
              <div className="border border-border rounded-lg p-4 space-y-2 text-sm">
                <div><strong>Total filas:</strong> {importPreview.summary.totalRows}</div>
                <div><strong>Filas válidas:</strong> {importPreview.summary.validRows}</div>
                <div><strong>Filas con error:</strong> {importPreview.summary.errorRows}</div>
                <div><strong>Categorías a crear:</strong> {importPreview.summary.createCategories}</div>
                <div><strong>Marcas a crear:</strong> {importPreview.summary.createBrands}</div>
                <div><strong>Productos base a crear:</strong> {importPreview.summary.createProductBases}</div>
                <div><strong>Variantes a crear:</strong> {importPreview.summary.createVariants}</div>
                <div><strong>Variantes a actualizar:</strong> {importPreview.summary.updateVariants}</div>
                <div><strong>Sucursal asignada:</strong> {importPreview.summary.assignedBranchName || activeBranchName}</div>
              </div>
            )}

            {importPreview?.errors?.length > 0 && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-4 space-y-2 text-sm text-red-700 max-h-56 overflow-y-auto">
                {importPreview.errors.map((error: any) => (
                  <div key={error.rowNumber}>
                    <strong>Fila {error.rowNumber}:</strong> {error.messages.join(' | ')}
                  </div>
                ))}
              </div>
            )}

            {importMessage && (
              <div className="text-sm text-foreground bg-muted rounded-lg px-3 py-2">
                {importMessage}
              </div>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
            Cerrar
          </Button>
          <Button variant="outline" onClick={handlePreviewImport} disabled={importLoading || !importFile || !activeBranchId}>
            {importLoading ? 'Procesando...' : 'Preview'}
          </Button>
          <Button onClick={handleConfirmImport} disabled={importLoading || !importFile || !importPreview || importPreview?.errors?.length > 0 || !activeBranchId}>
            {importLoading ? 'Importando...' : 'Importar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={previewDialogOpen} onClose={() => setPreviewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{bulkActionType === "price" ? 'Confirmar actualización masiva de precios' : 'Confirmar actualización masiva de stock'}</DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-2">
            <p>
              Se actualizarán <strong>{previewRows.length}</strong> variantes.
            </p>
            {bulkActionType === "price" ? (
            <div className="max-h-80 overflow-y-auto border border-border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-medium">Variante</th>
                    <th className="text-left p-3 font-medium">SKU</th>
                    <th className="text-left p-3 font-medium">Costo</th>
                    <th className="text-left p-3 font-medium">Actual</th>
                    <th className="text-left p-3 font-medium">Nuevo</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="p-3">{row.name}</td>
                      <td className="p-3 text-muted-foreground">{row.sku}</td>
                      <td className="p-3">${row.purchasePrice.toLocaleString()}</td>
                      <td className="p-3">${row.currentPrice.toLocaleString()}</td>
                      <td className="p-3 font-semibold">${row.nextPrice.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-foreground space-y-2">
                <div><strong>Variantes objetivo:</strong> {targetProducts.length}</div>
                <div><strong>Modo:</strong> {bulkStockMode === "set" ? 'Reemplazar stock' : 'Sumar / restar stock'}</div>
                <div><strong>Tipo:</strong> {bulkStockLocationType === "warehouse" ? 'Depósito' : bulkStockLocationType === "transit" ? 'Tránsito' : 'Sucursal'}</div>
                <div><strong>Ubicación:</strong> {resolvedBulkStockLocationName}</div>
                <div><strong>Cantidad:</strong> {parsedBulkValue}</div>
                {bulkStockMinStock !== "" && <div><strong>Stock mínimo:</strong> {bulkStockMinStock}</div>}
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              {bulkActionType === "price" && bulkMode === "percentage" && bulkBase === "purchasePrice" && 'Esto actúa como margen sobre costo.'}
              {bulkActionType === "price" && bulkMode === "percentage" && bulkBase === "salePrice" && 'Esto ajusta el precio actual por porcentaje.'}
              {bulkActionType === "price" && bulkMode === "fixed" && bulkBase === "purchasePrice" && 'Esto suma/resta un monto fijo tomando el costo como base.'}
              {bulkActionType === "price" && bulkMode === "fixed" && bulkBase === "salePrice" && 'Esto suma/resta un monto fijo sobre el precio actual.'}
              {bulkActionType === "price" && bulkMode === "direct" && 'Esto reemplaza el precio de venta directamente.'}
              {bulkActionType === "stock" && bulkStockMode === "set" && 'Esto reemplaza el stock actual en la ubicación elegida.'}
              {bulkActionType === "stock" && bulkStockMode === "increment" && 'Esto suma o resta stock sobre la ubicación elegida.'}
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={bulkActionType === "price" ? handleBulkPriceUpdate : handleBulkStockUpdate} disabled={bulkLoading}>
            {bulkLoading ? 'Aplicando...' : 'Confirmar y aplicar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, product: null })}>
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          <p>
            ¿Estás seguro de eliminar la variante "{deleteDialog.product?.name}"?
          </p>
          {deleteDialog.product?.stockByBranch && deleteDialog.product.stockByBranch.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p><strong>Stock afectado:</strong></p>
              {deleteDialog.product.stockByBranch.map((stock: any) => (
                <p key={stock.branchId} style={{ margin: '4px 0', fontSize: '14px' }}>
                  • {stock.branchName}: {stock.availableQuantity} unidades
                </p>
              ))}
            </div>
          )}
          <p style={{ marginTop: 16, color: '#d32f2f', fontSize: '14px' }}>
            ⚠️ Esta acción desactivará el producto (soft delete). Podrás restaurarlo más tarde si es necesario.
          </p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, product: null })}>
            Cancelar
          </Button>
          <Button onClick={confirmDelete} variant="destructive">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={adjustmentDialogOpen} onClose={() => setAdjustmentDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Ajuste de Inventario (Batch)</DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-2">
            {adjustmentMessage && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                {adjustmentMessage}
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
              <strong>Sucursal:</strong> {activeBranchName}
              <div className="text-xs text-muted-foreground mt-1">
                Todos los ajustes se aplican a la sucursal activa. No se permite ajustar stock de otras sucursales.
              </div>
            </div>

            {selectedIds.length > 0 && (
              <div className="max-h-[400px] overflow-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Producto</th>
                      <th className="text-left p-3 font-medium">SKU</th>
                      <th className="text-left p-3 font-medium">Nueva Cantidad</th>
                      <th className="text-left p-3 font-medium">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts
                      .filter(p => selectedIds.includes(p.id))
                      .map((product) => (
                        <tr key={product.id} className="border-t border-border">
                          <td className="p-3 font-medium text-foreground">{product.name}</td>
                          <td className="p-3 text-muted-foreground">{product.sku || 'Sin SKU'}</td>
                          <td className="p-3">
                            <Input
                              type="number"
                              min="0"
                              value={adjustmentForm[product.id]?.newQuantity || ''}
                              onChange={(e) => setAdjustmentForm(prev => ({
                                ...prev,
                                [product.id]: {
                                  ...prev[product.id],
                                  newQuantity: e.target.value
                                }
                              }))}
                              placeholder="Nueva cantidad"
                              className="h-8"
                            />
                          </td>
                          <td className="p-3">
                            <Input
                              value={adjustmentForm[product.id]?.reason || ''}
                              onChange={(e) => setAdjustmentForm(prev => ({
                                ...prev,
                                [product.id]: {
                                  ...prev[product.id],
                                  reason: e.target.value
                                }
                              }))}
                              placeholder="Motivo obligatorio"
                              className="h-8"
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Solo root y gerente_general pueden realizar ajustes. Motivo obligatorio para cada producto.
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outline" onClick={() => setAdjustmentDialogOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAdjustmentSubmit} disabled={adjustmentLoading || selectedIds.length === 0}>
            {adjustmentLoading ? 'Procesando...' : 'Confirmar Ajustes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={adjustmentHistoryDialogOpen} onClose={() => setAdjustmentHistoryDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Historial de Ajustes de Inventario</DialogTitle>
        <DialogContent>
          <div className="space-y-4 pt-2">
            {adjustmentHistoryLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando historial...</div>
            ) : adjustmentHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No hay ajustes registrados</div>
            ) : (
              <div className="max-h-[500px] overflow-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Fecha</th>
                      <th className="text-left p-3 font-medium">Producto</th>
                      <th className="text-left p-3 font-medium">Anterior</th>
                      <th className="text-left p-3 font-medium">Nueva</th>
                      <th className="text-left p-3 font-medium">Diferencia</th>
                      <th className="text-left p-3 font-medium">Motivo</th>
                      <th className="text-left p-3 font-medium">Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustmentHistory.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="p-3 text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString('es-AR')}
                        </td>
                        <td className="p-3 font-medium text-foreground">{item.variantName}</td>
                        <td className="p-3 font-semibold text-foreground">{item.previousQuantity ?? '-'}</td>
                        <td className="p-3 font-semibold text-foreground">{item.newQuantity ?? '-'}</td>
                        <td className="p-3">
                          <span className={item.quantity >= 0 ? "text-green-600" : "text-red-600"}>
                            {item.quantity >= 0 ? '+' : ''}{item.quantity}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{item.reason}</td>
                        <td className="p-3 text-muted-foreground">{item.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="outline" onClick={() => setAdjustmentHistoryDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
