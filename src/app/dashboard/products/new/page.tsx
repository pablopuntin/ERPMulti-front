"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from "next/navigation";
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
  id: number;
  name: string;
  price: number;
  purchasePrice?: number;
  sku?: string; // SKU autogenerado
  minStock?: number;
  stocks: StockLocation[];
}

interface StockLocation {
  id: string;
  branchId?: string; // Opcional si es tránsito
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

const initialVariantId = Date.now();

function NewProductContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editProductId = searchParams?.get('edit');
  
  console.log('🔍 DEBUG - editProductId:', editProductId);
  console.log('🔍 DEBUG - searchParams:', searchParams);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  
  // Estados para formularios adicionales
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  
  // Estado para controlar edición de variantes
  const [editingVariant, setEditingVariant] = useState<number | null>(initialVariantId);
  
  const [formData, setFormData] = useState({
    productBase: {
      name: '',
      description: '',
      categoryId: '',
      brandId: ''
    } as ProductBase,
    variants: [{
      id: initialVariantId,
      name: '',
      price: 0,
      purchasePrice: 0,
      sku: '', // Se autogenerará
      minStock: 5,
      stocks: [{
        id: Date.now().toString(),
        branchId: branches[0]?.id || '',
        branchName: branches[0]?.name || '',
        quantity: 0,
        locationType: 'branch' as const,
        minStock: 5
      }]
    } as ProductVariant],
    searchProduct: '',
    existingProduct: undefined as ProductBase | undefined
  });

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  const getActiveBranchId = () => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    return userData.activeBranchId || userData.branchId || null;
  };

  const preferredBranch = resolvePreferredBranch(branches, getActiveBranchId());

  useEffect(() => {
    loadReferenceData();
  }, []);

  useEffect(() => {
    console.log('🔍 DEBUG - useEffect triggered:', {
      editProductId,
      categoriesLength: categories.length,
      brandsLength: brands.length,
      branchesLength: branches.length
    });
    if (editProductId && categories.length > 0 && brands.length > 0 && branches.length > 0) {
      console.log('🔍 DEBUG - Llamando a loadProductForEdit');
      loadProductForEdit(editProductId);
    }
  }, [editProductId, categories, brands, branches]);

  const loadReferenceData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const [categoriesRes, brandsRes, branchesRes] = await Promise.all([
        fetch(`${API_BASE}/categories`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/brands`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/branches`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const categoriesData = await categoriesRes.json();
      const brandsData = await brandsRes.json();
      const branchesData = await branchesRes.json();

      setCategories(categoriesData);
      setBrands(brandsData);
      setBranches(branchesData);
      
      const preferredBranch = resolvePreferredBranch(branchesData, getActiveBranchId());

      if (preferredBranch) {
        setFormData(prev => ({
          ...prev,
          variants: prev.variants.map(v => ({
            ...v,
            stocks: (v.stocks || []).map(stock => ({
              ...stock,
              branchId: stock.branchId || preferredBranch.id,
              branchName: stock.branchName || preferredBranch.name,
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
    setSuccess(editingCategory ? 'Categoría actualizada exitosamente' : 'Categoría creada exitosamente');
    setTimeout(() => setSuccess(null), 3000);
  };

  const loadProductForEdit = async (variantId: string) => {
    try {
      // Primero cargar la variante para obtener el productBaseId
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

      // Cargar datos completos del producto base
      const productResponse = await fetch(`${API_BASE}/products-base/${productBaseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!productResponse.ok) {
        setError('Error cargando producto base para edición');
        return;
      }

      const product = await productResponse.json();
      console.log('🔍 DEBUG - Datos del producto base:', product);

      // Cargar todas las variantes del producto base
      const variantsResponse = await fetch(`${API_BASE}/product-variants`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!variantsResponse.ok) {
        setError('Error cargando variantes del producto');
        return;
      }

      const allVariants = await variantsResponse.json();
      console.log('🔍 DEBUG - Todas las variantes:', allVariants);
      
      // Filtrar variantes que pertenecen a este producto base
      const productVariants = allVariants.filter((v: any) => v.productBase?.id === productBaseId);

      // Actualizar el formulario con todos los datos
      setFormData(prev => ({
        ...prev,
        productBase: {
          name: product.name || variant.productBase?.name,
          description: product.description || '',
          categoryId: product.categoryId || variant.productBase?.category?.id || '',
          brandId: product.brandId || variant.productBase?.brand?.id || ''
        },
        existingProduct: product,
        variants: productVariants.map((v: any) => ({
          id: v.id,
          name: v.name,
          price: parseFloat(v.price),
          sku: v.sku || '',
          minStock: v.minStock || 5,
          stocks: v.stockLocations?.map((stock: any) => ({
            id: stock.id || stock.branchId,
            branchId: stock.branchId,
            branchName: stock.branchName,
            quantity: stock.quantity || 0,
            availableQuantity: stock.availableQuantity,
            locationType: stock.locationType || 'branch',
            minStock: stock.minStock || v.minStock || 5
          })) || []
        })),
        searchProduct: ''
      }));

      setSuccess(`✅ Producto "${product.name || variant.productBase?.name}" cargado para edición`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      setError(err.message || 'Error cargando producto para edición');
    }
  };

  const searchProduct = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/products-base?search=${encodeURIComponent(searchTerm)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Error buscando producto');

      const products = await response.json();
      
      if (products.length === 0) {
        setError('No se encontraron productos');
        return;
      }
    } catch (err) {
      setError('Error buscando producto');
    }
  };

  const addVariant = () => {
    const preferredBranch = resolvePreferredBranch(branches, getActiveBranchId());
    const nextVariantId = Date.now();

    setEditingVariant(nextVariantId);

    setFormData(prev => ({
      ...prev,
      variants: [...prev.variants, {
        id: nextVariantId,
        name: '',
        price: 0,
        purchasePrice: 0,
        sku: '', // Se autogenerará
        minStock: 5,
        stocks: [{
          id: Date.now().toString(),
          branchId: preferredBranch?.id || '',
          branchName: preferredBranch?.name || '',
          quantity: 0,
          locationType: 'branch' as const,
          minStock: 5
        }]
      }]
    }));
  };

  const removeVariant = (variantId: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter(v => v.id !== variantId)
    }));
  };

  const updateVariant = (variantId: number, field: keyof ProductVariant, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => 
        v.id === variantId ? { ...v, [field]: value } : v
      )
    }));
  };

  const updateStock = (variantId: number, stockId: string, field: keyof StockLocation, value: any) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.map(v => 
        v.id === variantId
          ? {
              ...v,
              stocks: v.stocks?.map(s =>
                s.id === stockId ? { ...s, [field]: value } : s
              ) || []
            }
          : v
      )
    }));
  };

  // Funciones para edición de variantes
  const toggleEditVariant = (variantId: number) => {
    setEditingVariant(editingVariant === variantId ? null : variantId);
  };

  const saveVariant = (variantId: number) => {
    // Aquí podrías agregar validaciones antes de guardar
    setEditingVariant(null);
    setSuccess('Variante guardada exitosamente');
    setTimeout(() => setSuccess(null), 2000);
  };

  const resolveVariantName = (variantName: string, productBaseName: string) => {
    const normalizedVariantName = variantName.trim();
    const normalizedProductBaseName = productBaseName.trim();
    return normalizedVariantName || normalizedProductBaseName;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('token');
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const currentBranch = userData.activeBranchId || userData.branchId || resolvePreferredBranch(branches, userData.activeBranchId || userData.branchId)?.id;

      if (editProductId) {
        // Modo edición: actualizar variantes existentes
        for (const variant of formData.variants) {
          const resolvedVariantName = resolveVariantName(variant.name, formData.productBase.name);
          const variantData = {
            name: resolvedVariantName,
            price: variant.price,
            purchasePrice: variant.purchasePrice || 0,
            sku: variant.sku,
            minStock: variant.minStock || 5
          };

          await fetch(`${API_BASE}/product-variants/${variant.id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Branch-ID': currentBranch,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(variantData)
          });
        }
        setSuccess('✅ Variantes actualizadas exitosamente');
      } else if (formData.existingProduct) {
        // Modo agregar variantes a producto existente
        const existingProduct = formData.existingProduct; // Variable local para TypeScript
        
        for (const variant of formData.variants) {
          const resolvedVariantName = resolveVariantName(variant.name, existingProduct.name || formData.productBase.name);
          const variantData = {
            name: resolvedVariantName,
            price: variant.price,
            purchasePrice: variant.purchasePrice || 0,
            sku: variant.sku, // Opcional, se genera automáticamente
            minStock: variant.minStock || 5,
            stocks: variant.stocks.map(stock => ({
              branchId: stock.branchId,
              locationType: stock.locationType,
              quantity: stock.quantity,
              minStock: stock.minStock || variant.minStock || 5
            }))
          };

          await fetch(`${API_BASE}/products-base/${existingProduct.id}/add-variant-with-stocks`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Branch-ID': currentBranch,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(variantData)
          });
        }
        setSuccess('Variantes con stocks múltiples agregadas exitosamente');
      } else {
        // Validar datos básicos
        if (!formData.productBase.name || !formData.productBase.categoryId || !formData.productBase.brandId) {
          throw new Error('Por favor complete todos los campos requeridos del producto base');
        }

        // Crear producto base primero
        const productResponse = await fetch(`${API_BASE}/products-base/create-simple`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Branch-ID': currentBranch,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData.productBase)
        });

        const newProduct = await productResponse.json();

        // Agregar variantes con stocks múltiples
        for (const variant of formData.variants) {
          const resolvedVariantName = resolveVariantName(variant.name, formData.productBase.name);
          const variantData = {
            name: resolvedVariantName,
            price: variant.price,
            purchasePrice: variant.purchasePrice || 0,
            sku: variant.sku, // Opcional, se genera automáticamente
            minStock: variant.minStock || 5,
            stocks: variant.stocks.map(stock => ({
              branchId: stock.branchId,
              locationType: stock.locationType,
              quantity: stock.quantity,
              minStock: stock.minStock || variant.minStock || 5
            }))
          };

          await fetch(`${API_BASE}/products-base/${newProduct.id}/add-variant-with-stocks`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Branch-ID': currentBranch,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(variantData)
          });
        }
        
        setSuccess('Producto y variantes con stocks múltiples creados exitosamente');
      }

      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push('/dashboard/products');
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Error guardando producto');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBrand = async () => {
    if (!newBrandName.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const currentBranch = userData.activeBranchId || userData.branchId || resolvePreferredBranch(branches, userData.activeBranchId || userData.branchId)?.id;

      const response = await fetch(`${API_BASE}/brands`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Branch-ID': currentBranch,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newBrandName.trim(),
          description: '',
          categoryId: formData.productBase.categoryId || null
        })
      });

      if (!response.ok) {
        throw new Error('Error creando la marca');
      }

      const newBrand = await response.json();
      
      // Agregar la nueva marca a la lista
      setBrands(prev => [...prev, newBrand]);
      
      // Seleccionar automáticamente la nueva marca
      setFormData(prev => ({
        ...prev,
        productBase: { ...prev.productBase, brandId: newBrand.id }
      }));

      // Cerrar modal y limpiar formulario
      setShowBrandForm(false);
      setNewBrandName('');
      setSuccess('Marca creada exitosamente');
      
      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      setError(err.message || 'Error creando la marca');
    }
  };

  const resetForm = () => {
    const preferredBranch = resolvePreferredBranch(branches, getActiveBranchId());
    const initialVariantId = Date.now();

    setEditingVariant(initialVariantId);

    setFormData({
      productBase: {
        name: '',
        description: '',
        categoryId: '',
        brandId: ''
      },
      variants: [{
        id: initialVariantId,
        name: '',
        price: 0,
        purchasePrice: 0,
        sku: '', // Se autogenerará
        minStock: 5,
        stocks: [{
          id: Date.now().toString(),
          branchId: preferredBranch?.id || '',
          branchName: preferredBranch?.name || '',
          quantity: 0,
          locationType: 'branch' as const,
          minStock: 5
        }]
      }],
      searchProduct: '',
      existingProduct: undefined
    });
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard/products')}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold">🏦 Gestión de Productos</h1>
      </div>

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            ❌ {error}
          </AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">
            ✅ {success}
          </AlertDescription>
        </Alert>
      )}

      <Alert className="mb-4 border-blue-200 bg-blue-50">
        <AlertDescription className="text-blue-900">
          La sucursal activa es <strong>{resolvePreferredBranch(branches, getActiveBranchId())?.name || 'no definida'}</strong>. Las variantes nuevas se asignarán automáticamente a esa sucursal.
        </AlertDescription>
      </Alert>

      <Alert className="mb-4 border-slate-200 bg-slate-50">
        <AlertDescription className="text-slate-900">
          El stock inicial de cada variante se creará sobre la sucursal activa. Si después necesitás replicar el producto en otra sucursal, podés usar la exportación CSV desde Productos y luego hacer una carga masiva desde la otra sucursal activa.
        </AlertDescription>
      </Alert>

      {/* Búsqueda de Producto Existente */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            🔍 Buscar Producto Existente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="🔍 Buscar producto existente..."
              value={formData.searchProduct}
              onChange={(e) => setFormData(prev => ({ ...prev, searchProduct: e.target.value }))}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  searchProduct(formData.searchProduct);
                }
              }}
              className="flex-1"
            />
            <Button onClick={() => searchProduct(formData.searchProduct)}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Nuevo Producto
            </Button>
          </div>

          {formData.existingProduct && (
            <Badge className="bg-green-100 text-green-800">
              ✅ Producto encontrado: {formData.existingProduct.name}
            </Badge>
          )}
        </CardContent>
      </Card>

      <CategoryModal
        open={showCategoryForm}
        onClose={() => {
          setShowCategoryForm(false);
          setEditingCategory(null);
        }}
        category={editingCategory || undefined}
        onSaved={handleCategorySaved}
      />

      {/* Formulario de Producto Base */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            📦 {formData.existingProduct ? 'Producto Existente' : 'Nuevo Producto Base'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="productName">Nombre del Producto *</Label>
              <Input
                id="productName"
                value={formData.productBase.name}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  productBase: { ...prev.productBase, name: e.target.value }
                }))}
                disabled={!!formData.existingProduct}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="productCategory">Categoría *</Label>
              <div className="flex gap-2">
                <select
                  id="productCategory"
                  value={formData.productBase.categoryId}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    productBase: { ...prev.productBase, categoryId: e.target.value }
                  }))}
                  disabled={!!formData.existingProduct}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" className="text-gray-500">🏷️ Seleccionar categoría</option>
                  {categories?.map((category) => (
                    <option key={category.id} value={category.id} className="text-gray-900">
                      {category.name}
                    </option>
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
                  disabled={!!formData.existingProduct}
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
                    disabled={!!formData.existingProduct}
                    className="whitespace-nowrap"
                  >
                    Editar
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="productBrand">Marca *</Label>
              <div className="flex gap-2">
                <select
                  id="productBrand"
                  value={formData.productBase.brandId}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    productBase: { ...prev.productBase, brandId: e.target.value }
                  }))}
                  disabled={!!formData.existingProduct}
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" className="text-gray-500">🏢 Seleccionar marca</option>
                  {brands?.map((brand) => (
                    <option key={brand.id} value={brand.id} className="text-gray-900">
                      {brand.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBrandForm(true)}
                  disabled={!!formData.existingProduct}
                  className="whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  Nueva
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="productDescription">Descripción</Label>
            <Textarea
              id="productDescription"
              value={formData.productBase.description}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                productBase: { ...prev.productBase, description: e.target.value }
              }))}
              disabled={!!formData.existingProduct}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Variantes */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>🏷️ Variantes del Producto</CardTitle>
            <Button onClick={addVariant}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Variante
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {formData.variants.map((variant, index) => (
            <Card key={variant.id} className="mb-4">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">
                    {formData.existingProduct 
                      ? `${formData.existingProduct.name} - ${variant.name || formData.existingProduct.name || `Variante ${index + 1}`}`
                      : `${formData.productBase.name || 'Nuevo Producto'} - ${variant.name || formData.productBase.name || `Variante ${index + 1}`}`
                    }
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleEditVariant(variant.id)}
                    >
                      {editingVariant === variant.id ? 'Cancelar' : 'Editar'}
                    </Button>
                    
                    {editingVariant === variant.id && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => saveVariant(variant.id)}
                      >
                        Guardar
                      </Button>
                    )}
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeVariant(variant.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor={`variant-name-${variant.id}`}>Nombre de Variante</Label>
                    <Input
                      id={`variant-name-${variant.id}`}
                      value={variant.name}
                      onChange={(e) => updateVariant(variant.id, 'name', e.target.value)}
                      placeholder={formData.productBase.name ? `💡 Si lo dejas vacío se guardará como "${formData.productBase.name}"` : '💡 Si lo dejas vacío se usará el nombre del producto base'}
                      disabled={editingVariant !== variant.id}
                      className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`variant-sku-${variant.id}`}>SKU (opcional)</Label>
                    <Input
                      id={`variant-sku-${variant.id}`}
                      value={variant.sku}
                      onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                      placeholder="🏷️ Código único de variante (opcional)"
                      disabled={editingVariant !== variant.id}
                      className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label htmlFor={`variant-price-${variant.id}`}>Precio</Label>
                    <Input
                      id={`variant-price-${variant.id}`}
                      type="number"
                      value={variant.price}
                      onChange={(e) => updateVariant(variant.id, 'price', parseFloat(e.target.value))}
                      placeholder="💰 $0.00"
                      disabled={editingVariant !== variant.id}
                      className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`variant-purchase-price-${variant.id}`}>Precio de compra</Label>
                    <Input
                      id={`variant-purchase-price-${variant.id}`}
                      type="number"
                      value={variant.purchasePrice ?? 0}
                      onChange={(e) => updateVariant(variant.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                      placeholder="💸 $0.00"
                      disabled={editingVariant !== variant.id}
                      className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                    />
                  </div>

                  <div>
                    <Label htmlFor={`variant-minstock-${variant.id}`}>Stock Mínimo Global</Label>
                    <Input
                      id={`variant-minstock-${variant.id}`}
                      type="number"
                      value={variant.minStock}
                      onChange={(e) => updateVariant(variant.id, 'minStock', parseInt(e.target.value))}
                      placeholder="⚠️ 5 (alerta cuando quede menos)"
                      disabled={editingVariant !== variant.id}
                      className={editingVariant !== variant.id ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-900'}
                    />
                  </div>
                </div>

                {/* 📦 Stock Inicial */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-gray-700">
                    📦 Stock Inicial
                  </Label>

                  {variant.stocks!.slice(0, 1).map((stock) => (
                    <div key={stock.id} className="flex gap-4 mb-4">
                      <div className="flex-1">
                        <Label>Sucursal activa</Label>
                        <div className="flex h-10 w-full items-center rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-900">
                          {preferredBranch?.name || 'Seleccionar sucursal activa'}
                        </div>
                      </div>

                      <div className="flex-1">
                        <Label>Cantidad</Label>
                        <Input
                          type="number"
                          value={stock.quantity}
                          onChange={(e) => updateStock(variant.id, stock.id, 'quantity', parseInt(e.target.value) || 0)}
                          placeholder="📊 0 (unidades disponibles)"
                          className="bg-white text-gray-900"
                          disabled={editingVariant !== variant.id}
                        />
                      </div>

                      <div className="flex-1">
                        <Label>Stock Mínimo</Label>
                        <Input
                          type="number"
                          value={stock.minStock || ''}
                          onChange={(e) => updateStock(variant.id, stock.id, 'minStock', parseInt(e.target.value) || undefined)}
                          placeholder="⚠️ 5 (alerta en sucursal activa)"
                          className="bg-white text-gray-900"
                          disabled={editingVariant !== variant.id}
                        />
                      </div>
                    </div>
                  ))}

                  {(!variant.stocks || variant.stocks.length === 0) && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No hay stock inicial configurado
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Botones de Acción */}
      <div className="flex justify-center gap-4">
        <Button variant="outline" onClick={resetForm}>
          Cancelar
        </Button>
        
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Guardando...' : (formData.existingProduct ? 'Agregar Variantes' : 'Crear Producto')}
        </Button>
      </div>

      {/* Modal para Crear Nueva Marca */}
      {showBrandForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-lg">Crear Nueva Marca</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="newBrandName">Nombre de la Marca *</Label>
                <Input
                  id="newBrandName"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="🏢 Ej: MiMarca Empresa"
                  className="border-gray-300 bg-white text-gray-900"
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBrandForm(false);
                    setNewBrandName('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateBrand}
                  disabled={!newBrandName.trim()}
                >
                  Crear Marca
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function NewProductPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <NewProductContent />
    </Suspense>
  );
}
