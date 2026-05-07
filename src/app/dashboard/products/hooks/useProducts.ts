import { useState, useEffect } from 'react';
import { productsAPI } from '@/services/api';

export interface StockByBranch {
  branchId: string | null;
  branchName: string | null;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  minStock?: number;
  isLowStock: boolean;
  locationType?: string;
  locationLabel?: string;
}

export interface ProductBase {
  id: string;
  name: string;
  description?: string;
  imgURL?: string;
  brandId: string;
  categoryId?: string;
  category?: ProductRelation;
  brand?: ProductRelation;
  createdAt: string;
  updatedAt: string;
  variants?: ProductVariant[];
}

export interface ProductRelation {
  id: string;
  name: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  purchasePrice?: number;
  stock: number;
  color?: string;
  size?: string;
  imgURL?: string;
  isActive: boolean;
  productBaseId: string;
  createdAt: string;
  updatedAt: string;
  productBase?: ProductBase;
  stockByBranch?: StockByBranch[];
  totalStock?: number;
  assignedBranchIds?: string[];
}

export interface ProductsCatalogMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  status: "active" | "inactive" | "low_stock";
  image?: string;
  description?: string;
  cost?: number;
  minStock?: number;
  barcode?: string;
  supplier?: string;
}

export const useProducts = (params?: any) => {
  const [products, setProducts] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ProductsCatalogMeta>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await productsAPI.getCatalog(params);
      setProducts(Array.isArray(data?.items) ? data.items : []);
      setMeta({
        page: Number(data?.meta?.page ?? params?.page ?? 1),
        limit: Number(data?.meta?.limit ?? params?.limit ?? 50),
        total: Number(data?.meta?.total ?? 0),
        totalPages: Number(data?.meta?.totalPages ?? 1),
        hasNextPage: Boolean(data?.meta?.hasNextPage),
        hasPreviousPage: Boolean(data?.meta?.hasPreviousPage),
      });
    } catch (err: any) {
      console.error('Error loading products:', err);
      setError('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async (productData: Partial<ProductVariant>) => {
    try {
      // Para crear una variante, necesitamos los campos correctos según el DTO
      const variantData = {
        name: productData.name,
        price: productData.price,
        stock: productData.stock || 0,
        color: productData.color,
        size: productData.size,
        imgURL: productData.imgURL,
        isActive: true,
        productBaseId: productData.productBaseId // Este campo es obligatorio
      };

      const newProduct = await productsAPI.create(variantData);
      setProducts(prev => [...prev, newProduct]);
      return newProduct;
    } catch (err: any) {
      console.error('Error creating product:', err);
      throw err;
    }
  };

  const updateProduct = async (id: string, productData: Partial<ProductVariant>) => {
    try {
      const updatedProduct = await productsAPI.update(id, productData);
      setProducts(prev => prev.map(p => p.id === id ? updatedProduct : p));
      return updatedProduct;
    } catch (err: any) {
      console.error('Error updating product:', err);
      throw err;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      await productsAPI.delete(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      console.error('Error deleting product:', err);
      throw err;
    }
  };

  useEffect(() => {
    loadProducts();
  }, [JSON.stringify(params)]);

  return {
    products,
    meta,
    loading,
    error,
    refreshProducts: loadProducts,
    createProduct,
    updateProduct,
    deleteProduct
  };
};
