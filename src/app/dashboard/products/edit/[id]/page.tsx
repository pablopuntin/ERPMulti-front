"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from "next/navigation";
import CategoryModal from "@/app/components/categories/CategoryModal";
import { ArrowLeft, Plus, Trash2, Search } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";

interface ProductBase {
  id?: string;
  name: string;
  description?: string;
  categoryId: string;
  brandId: string;
}

interface ProductVariant {
  id: string | number;
  name: string;
  price: number;
  purchasePrice?: number;
  sku?: string;
  minStock?: number;
  stocks: StockLocation[];
}

interface StockLocation {
  id: string;
  branchId?: string;
  branchName?: string;
  quantity: number;
  locationType: 'branch' | 'transit' | 'warehouse';
  minStock?: number;
}

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

const resolvePreferredBranch = (branches: Branch[], activeBranchId?: string | null) => {
  if (activeBranchId) {
    const activeBranch = branches.find((branch) => branch.id === activeBranchId);
    if (activeBranch) {
      return activeBranch;
    }
  }

  return branches[0];
};

const getStoredActiveBranchId = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const userData = JSON.parse(localStorage.getItem('user') || '{}');
  return userData.activeBranchId || userData.branchId || null;
};

export default function EditProductPage() {
  const params = useParams<{ id: string | string[] }>();
  const router = useRouter();
  const variantId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [editingVariant, setEditingVariant] = useState<string | number | null>(null);
  
  const [formData, setFormData] = useState({
    productBase: {
      name: '',
      description: '',
      categoryId: '',
      brandId: ''
    } as ProductBase,
    variants: [{
      id: Date.now(),
      name: '',
      price: 0,
      purchasePrice: 0,
      sku: '',
      minStock: 5,
      stocks: [{
        id: Date.now().toString(),
        branchId: '',
        branchName: '',
        quantity: 0,
        locationType: 'branch' as const,
        minStock: 5
      }]
    }] as ProductVariant[],
    existingProduct: undefined as ProductBase | undefined
  });

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (typeof variantId === 'string' && variantId && categories.length > 0 && brands.length > 0 && branches.length > 0) {
      loadProductForEdit(variantId);
    }
  }, [variantId, categories, brands, branches]);

  const loadReferenceData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const categoriesResponse = await fetch(`${API_BASE}/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const categoriesData = await categoriesResponse.json();
      setCategories(categoriesData);

      const brandsResponse = await fetch(`${API_BASE}/brands`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const brandsData = await brandsResponse.json();
      setBrands(brandsData);

      const branchesResponse = await fetch(`${API_BASE}/branches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const branchesData = await branchesResponse.json();
      setBranches(branchesData);

      const preferredBranch = resolvePreferredBranch(branchesData, getStoredActiveBranchId());

      if (preferredBranch) {
        setFormData(prev => ({
          ...prev,
          variants: prev.variants.map(v => ({
            ...v,
            stocks: v.stocks.map(s => ({
              ...s,
              branchId: s.branchId || preferredBranch.id,
              branchName: s.branchName || preferredBranch.name
            }))
          }))
        }));
      }
    } catch (err) {
      setError('Error cargando datos de referencia');
    }
  };

  const refreshCategories = async (preferredCategoryId?: string, preferredCategoryName?: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      const response = await fetch(`${API_BASE}/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('No se pudieron recargar las categorías');
      }

      const categoriesData = await response.json();
      setCategories(categoriesData);

      const matchedCategory = categoriesData.find((item: Category) => item.id === preferredCategoryId)
        || categoriesData.find((item: Category) => item.name?.trim().toLowerCase() === preferredCategoryName?.trim().toLowerCase());

      if (matchedCategory) {
        setFormData(prev => ({
          ...prev,
          productBase: { ...prev.productBase, categoryId: matchedCategory.id }
        }));
      }
    } catch (err: any) {
      setError(err.message || 'No se pudieron actualizar las categorías.');
    }
  };

  const handleCategorySaved = async (savedCategory?: any) => {
    const preferredCategoryId = savedCategory?.id;
    const preferredCategoryName = savedCategory?.name || editingCategory?.name;
    await refreshCategories(preferredCategoryId, preferredCategoryName);
    setEditingCategory(null);
    setShowCategoryForm(false);
    setSuccess(editingCategory ? 'Categoría actualizada correctamente' : 'Categoría creada correctamente');
    setTimeout(() => setSuccess(null), 3000);
  };

  const loadProductForEdit = async (variantId: string) => {
    try {
      const token = localStorage.getItem('token');
      
      const variantResponse = await fetch(`${API_BASE}/product-variants/${variantId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!variantResponse.ok) {
        setError('Error cargando variante para edición');
        return;
      }

      const variant = await variantResponse.json();
      console.log('🔍 DEBUG - Datos de la variante:', variant);
      const productBaseId = variant.productBase?.id;

      if (!productBaseId) {
        setError('La variante no tiene un producto base asociado');
        return;
      }

      const productResponse = await fetch(`${API_BASE}/products-base/${productBaseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!productResponse.ok) {
        setError('Error cargando producto base para edición');
        return;
      }

      const product = await productResponse.json();
      console.log('🔍 DEBUG - Datos del producto base:', product);

      const hydratedVariant = product?.variants?.find((item: any) => item.id === variant.id) || variant;

      const normalizedStocks = (hydratedVariant.stockLocations || variant.stockLocations || []).map((stock: any) => ({
        id: stock.id || stock.branchId || `${hydratedVariant.id}-${stock.locationType || 'branch'}`,
        branchId: stock.branch?.id || stock.branchId,
        branchName: stock.branch?.name || stock.branchName,
        quantity: Number(stock.quantity || 0),
        availableQuantity: stock.availableQuantity,
        locationType: stock.locationType || 'branch',
        minStock: Number(stock.minStock || hydratedVariant.minStock || variant.minStock || 5)
      }));

      const selectedVariant = {
        id: hydratedVariant.id,
        name: hydratedVariant.name,
        price: Number(hydratedVariant.price ?? 0),
        purchasePrice: Number(hydratedVariant.purchasePrice ?? 0),
        sku: hydratedVariant.sku || '',
        minStock: Number(hydratedVariant.minStock || variant.minStock || 5),
        stocks: normalizedStocks.length > 0
          ? normalizedStocks
          : [{
              id: `${hydratedVariant.id}-default-stock`,
              branchId: resolvePreferredBranch(branches, getStoredActiveBranchId())?.id || '',
              branchName: resolvePreferredBranch(branches, getStoredActiveBranchId())?.name || '',
              quantity: 0,
              locationType: 'branch' as const,
              minStock: Number(hydratedVariant.minStock || variant.minStock || 5)
            }]
      };

      setFormData(prev => ({
        ...prev,
        productBase: {
          name: product.name || variant.productBase?.name,
          description: product.description || '',
          categoryId: product.category?.id || product.categoryId || variant.category?.id || '',
          brandId: product.brand?.id || product.brandId || variant.brand?.id || ''
        },
        existingProduct: product,
        variants: [selectedVariant],
        searchProduct: ''
      }));

      setEditingVariant(selectedVariant.id);

      setSuccess(`✅ Producto "${product.name || variant.productBase?.name}" cargado para edición`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      setError(err.message || 'Error cargando producto para edición');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const currentBranchId = getStoredActiveBranchId();
      if (!token) {
        router.push('/login');
        return;
      }

      // 1. Actualizar producto base (si es necesario)
      if (formData.productBase.name || formData.productBase.description || formData.productBase.categoryId || formData.productBase.brandId) {
        const productData = {
          name: formData.productBase.name,
          description: formData.productBase.description,
          categoryId: formData.productBase.categoryId,
          brandId: formData.productBase.brandId,
        };

        const productResponse = await fetch(`${API_BASE}/products-base/${formData.existingProduct?.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(productData)
        });

        if (!productResponse.ok) {
          throw new Error('Error guardando producto base');
        }
      }

      const resolveVariantName = (variantName: string, productBaseName: string) => {
        const normalizedVariantName = variantName.trim();
        const normalizedProductBaseName = productBaseName.trim();
        return normalizedVariantName || normalizedProductBaseName;
      };

      // 2. Actualizar variantes usando el endpoint existente
      for (const variant of formData.variants) {
        const resolvedVariantName = resolveVariantName(variant.name, formData.productBase.name);
        const variantData = {
          name: resolvedVariantName,
          price: variant.price,
          purchasePrice: variant.purchasePrice || 0,
          sku: variant.sku || `${formData.productBase.name.replace(/\s+/g, '-').toUpperCase()}-${resolvedVariantName.replace(/\s+/g, '-').toUpperCase()}`,
          minStock: variant.minStock,
          stocks: variant.stocks.map((stock) => ({
            branchId: stock.locationType === 'branch' ? (stock.branchId || currentBranchId || undefined) : undefined,
            locationType: stock.locationType,
            quantity: Number(stock.quantity || 0),
            minStock: Number(stock.minStock ?? variant.minStock ?? 5),
          })),
        };

        const variantResponse = await fetch(`${API_BASE}/product-variants/${variant.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(currentBranchId ? { 'X-Branch-ID': currentBranchId } : {})
          },
          body: JSON.stringify(variantData)
        });

        if (!variantResponse.ok) {
          throw new Error(`Error actualizando variante ${resolvedVariantName}`);
        }
      }

      setSuccess('✅ Producto actualizado correctamente');
      setTimeout(() => {
        router.push('/dashboard/products');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Error guardando producto');
    } finally {
      setLoading(false);
    }
  };

  // Resto del código del formulario (igual que new/page.tsx)
  // ... [continuará en el siguiente mensaje por límite de caracteres]

  return (
    <div className="w-full px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/products')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        
        <h1 className="text-2xl font-bold text-gray-900">📦 Editar producto</h1>
      </div>

      {/* Formulario */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📦 Datos del producto base</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryModal
            open={showCategoryForm}
            onClose={() => {
              setShowCategoryForm(false);
              setEditingCategory(null);
            }}
            category={editingCategory || undefined}
            onSaved={handleCategorySaved}
          />

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campos del producto base */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="productName">Nombre del Producto *</Label>
                <Input
                  id="productName"
                  value={formData.productBase.name}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    productBase: { ...prev.productBase, name: e.target.value }
                  }))}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="category">Categoría *</Label>
                <div className="flex gap-2">
                  <select
                    value={formData.productBase.categoryId}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      productBase: { ...prev.productBase, categoryId: e.target.value }
                    }))}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="" className="text-gray-500">🏷️ Seleccionar categoría</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id} className="text-gray-900">{cat.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingCategory(null);
                      setShowCategoryForm(true);
                    }}
                    className="whitespace-nowrap"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Nueva
                  </Button>
                  {formData.productBase.categoryId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCategory(
                          categories.find((category) => category.id === formData.productBase.categoryId) || null
                        );
                        setShowCategoryForm(true);
                      }}
                      className="whitespace-nowrap"
                    >
                      Editar
                    </Button>
                  )}
                </div>
              </div>
              
              <div>
                <Label htmlFor="brand">Marca *</Label>
                <select
                  id="brand"
                  value={formData.productBase.brandId}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    productBase: { ...prev.productBase, brandId: e.target.value }
                  }))}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" className="text-gray-500">🏢 Seleccionar marca</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id} className="text-gray-900">{brand.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.productBase.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  productBase: { ...prev.productBase, description: e.target.value }
                }))}
                rows={3}
              />
            </div>

            {/* Variantes */}
            <div>
              <h3 className="text-lg font-semibold mb-4">🏷️ Variantes del producto</h3>
              {formData.variants.map((variant, index) => (
                <Card key={variant.id} className="mb-4">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium">
                        {variant.name?.trim() || formData.productBase.name || `Variante ${index + 1}`}
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingVariant(editingVariant === variant.id ? null : variant.id)}
                        >
                          {editingVariant === variant.id ? 'Cancelar' : 'Editar'}
                        </Button>
                        {formData.variants.length > 1 && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              variants: prev.variants.filter(v => v.id !== variant.id)
                            }))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Nombre de Variante</Label>
                        <Input
                          value={variant.name}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            variants: prev.variants.map(v => 
                              v.id === variant.id ? { ...v, name: e.target.value } : v
                            )
                          }))}
                          placeholder={formData.productBase.name ? `💡 Si lo dejas vacío se guardará como "${formData.productBase.name}"` : '💡 Si lo dejas vacío se usará el nombre del producto base'}
                          disabled={editingVariant !== variant.id}
                          className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                        />
                      </div>
                      
                      <div>
                        <Label>SKU (opcional)</Label>
                        <Input
                          value={variant.sku}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            variants: prev.variants.map(v => 
                              v.id === variant.id ? { ...v, sku: e.target.value } : v
                            )
                          }))}
                          placeholder="🏷️ Código único de variante (opcional)"
                          disabled={editingVariant !== variant.id}
                          className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                        />
                      </div>
                      
                      <div>
                        <Label>Precio</Label>
                        <Input
                          type="number"
                          value={variant.price}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            variants: prev.variants.map(v => 
                              v.id === variant.id ? { ...v, price: parseFloat(e.target.value) || 0 } : v
                            )
                          }))}
                          placeholder="💰 $0.00"
                          disabled={editingVariant !== variant.id}
                          className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <Label>Precio de compra</Label>
                        <Input
                          type="number"
                          value={variant.purchasePrice ?? 0}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            variants: prev.variants.map(v => 
                              v.id === variant.id ? { ...v, purchasePrice: parseFloat(e.target.value) || 0 } : v
                            )
                          }))}
                          placeholder="💸 $0.00"
                          disabled={editingVariant !== variant.id}
                          className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                        />
                      </div>

                      <div>
                        <Label>Stock mínimo global</Label>
                        <Input
                          type="number"
                          value={variant.minStock || 5}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            variants: prev.variants.map(v => 
                              v.id === variant.id ? { ...v, minStock: parseInt(e.target.value) || 5 } : v
                            )
                          }))}
                          placeholder="⚠️ 5"
                          disabled={editingVariant !== variant.id}
                          className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                        />
                      </div>
                    </div>

                    {/* Stocks por sucursal */}
                    <div className="mt-6">
                      <h5 className="font-medium mb-4">📦 Stocks por Ubicación</h5>
                      {variant.stocks.map((stock, stockIndex) => (
                        <div key={stock.id} className="border rounded-lg p-4 mb-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label>Ubicación</Label>
                              <select
                                value={stock.locationType}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  variants: prev.variants.map(v => 
                                    v.id === variant.id ? {
                                      ...v,
                                      stocks: v.stocks.map(s => 
                                        s.id === stock.id ? { ...s, locationType: e.target.value as 'branch' | 'transit' | 'warehouse' } : s
                                      )
                                    } : v
                                  )
                                }))}
                                className="w-full p-2 border rounded-md"
                                disabled={editingVariant !== variant.id}
                              >
                                <option value="branch">🏪 Sucursal</option>
                                <option value="transit">🚚 En Tránsito</option>
                                <option value="warehouse">🏭 Depósito</option>
                              </select>
                            </div>
                            
                            {stock.locationType === 'branch' && (
                              <>
                                <div>
                                  <Label>Sucursal</Label>
                                  <select
                                value={stock.branchId}
                                onChange={(e) => {
                                  const selectedBranch = branches.find(b => b.id === e.target.value);
                                  setFormData(prev => ({
                                    ...prev,
                                    variants: prev.variants.map(v => 
                                      v.id === variant.id ? {
                                        ...v,
                                        stocks: v.stocks.map(s => 
                                          s.id === stock.id ? { 
                                            ...s, 
                                            branchId: e.target.value,
                                            branchName: selectedBranch?.name || ''
                                          } : s
                                        )
                                      } : v
                                    )
                                  }));
                                }}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900"
                                disabled={editingVariant !== variant.id}
                              >
                                <option value="" className="text-gray-500">🏪 Seleccionar sucursal</option>
                                {branches.map(branch => (
                                  <option key={branch.id} value={branch.id} className="text-gray-900">{branch.name}</option>
                                ))}
                              </select>
                                </div>
                              </>
                            )}
                            
                            <div>
                              <Label>Cantidad</Label>
                              <Input
                                type="number"
                                value={stock.quantity}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  variants: prev.variants.map(v => 
                                    v.id === variant.id ? {
                                      ...v,
                                      stocks: v.stocks.map(s => 
                                        s.id === stock.id ? { ...s, quantity: parseInt(e.target.value) || 0 } : s
                                      )
                                    } : v
                                  )
                                }))}
                                placeholder="📊 0 (unidades disponibles)"
                                disabled={editingVariant !== variant.id}
                                className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                              />
                            </div>
                            
                            <div>
                              <Label>Stock Mínimo</Label>
                              <Input
                                type="number"
                                value={stock.minStock || 5}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  variants: prev.variants.map(v => 
                                    v.id === variant.id ? {
                                      ...v,
                                      stocks: v.stocks.map(s => 
                                        s.id === stock.id ? { ...s, minStock: parseInt(e.target.value) || 5 } : s
                                      )
                                    } : v
                                  )
                                }))}
                                placeholder="⚠️ 5 (alerta por sucursal)"
                                disabled={editingVariant !== variant.id}
                                className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                              />
                            </div>
                          </div>
                          
                          {variant.stocks.length > 1 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                variants: prev.variants.map(v => 
                                  v.id === variant.id ? {
                                    ...v,
                                    stocks: v.stocks.filter(s => s.id !== stock.id)
                                  } : v
                                )
                              }))}
                              className="mt-2"
                              disabled={editingVariant !== variant.id}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Eliminar Ubicación
                            </Button>
                          )}
                        </div>
                      ))}
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData(prev => ({
                          ...(() => {
                            const userData = JSON.parse(localStorage.getItem('user') || '{}');
                            const activeBranchId = userData.activeBranchId || userData.branchId;
                            const preferredBranch = branches.find(branch => branch.id === activeBranchId) || branches[0];
                            return {
                              ...prev,
                              variants: prev.variants.map(v => 
                                v.id === variant.id ? {
                                  ...v,
                                  stocks: [...v.stocks, {
                                    id: Date.now().toString() + Math.random(),
                                    branchId: preferredBranch?.id || '',
                                    branchName: preferredBranch?.name || '',
                                    quantity: 0,
                                    locationType: 'branch' as const,
                                    minStock: 5
                                  }]
                                } : v
                              )
                            };
                          })()
                        }))}
                        className="mt-2"
                        disabled={editingVariant !== variant.id}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Ubicación
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const nextVariantId = Date.now();
                  const preferredBranch = resolvePreferredBranch(branches, getStoredActiveBranchId());

                  setEditingVariant(nextVariantId);
                  setFormData(prev => ({
                    ...prev,
                    variants: [...prev.variants, {
                      id: nextVariantId,
                      name: '',
                      price: 0,
                      purchasePrice: 0,
                      sku: '',
                      minStock: 5,
                      stocks: [{
                        id: Date.now().toString() + Math.random(),
                        branchId: preferredBranch?.id || '',
                        branchName: preferredBranch?.name || '',
                        quantity: 0,
                        locationType: 'branch' as const,
                        minStock: 5
                      }]
                    }]
                  }));
                }}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar variante
              </Button>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/products')}
              >
                Cancelar
              </Button>
              
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Actualizando...' : 'Actualizar Producto'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">
            {success}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
