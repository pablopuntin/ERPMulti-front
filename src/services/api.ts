import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true, // ⭐ Importante: enviar cookies automáticamente
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token de autenticación
api.interceptors.request.use((config) => {
  console.log('🔍 [API] Request interceptada:', {
    url: config.url,
    method: config.method,
    headers: config.headers
  });
  
  const storedUser = localStorage.getItem('user');
  const parsedUser = storedUser ? JSON.parse(storedUser) : null;
  const token = localStorage.getItem('token') || parsedUser?.token;
  console.log('🔍 [API] Token en localStorage:', !!token);
  
  if (token) {
    // Enviar en headers (forma principal)
    config.headers.Authorization = `Bearer ${token}`;
    console.log("🔑 [API] Enviando token en headers:", config.headers.Authorization);
  } else {
    console.log("❌ [API] No hay token disponible");
  }
  
  console.log('🔍 [API] Headers finales:', config.headers);
  return config;
});

// Interceptor para manejar errores
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Auth Services
export const authAPI = {
  login: async (credentials: any) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  
  register: async (data: any) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  }
};

export const branchesAPI = {
  getAll: async () => {
    const response = await api.get('/branches');
    return response.data;
  },

  getSalesSettings: async (branchId: string) => {
    const response = await api.get(`/branches/${branchId}/sales-settings`);
    return response.data;
  },

  updateSalesSettings: async (
    branchId: string,
    data: { restrictSalesToBranchStock: boolean }
  ) => {
    const response = await api.patch(
      `/branches/${branchId}/sales-settings`,
      data
    );
    return response.data;
  }
};

export const usersAPI = {
  create: async (data: any) => {
    const response = await api.post('/users', data);
    return response.data;
  },
};

// Categories Services
export const categoriesAPI = {
  getAll: async () => {
    const response = await api.get('/categories');
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/categories', data);
    return response.data;
  },
  
  update: async (id: string, data: any) => {
    const response = await api.patch(`/categories/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  },
  
  getBrandsByCategory: async (id: string) => {
    const response = await api.get(`/categories/${id}/brands`);
    return response.data;
  }
};

export const brandsAPI = {
  getAll: async () => {
    const response = await api.get('/brands');
    return response.data;
  },
};

// Products Base Services
export const productsBaseAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/products-base', { params });
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/products-base/${id}`);
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/products-base', data);
    return response.data;
  },
  
  update: async (id: string, data: any) => {
    const response = await api.patch(`/products-base/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/products-base/${id}`);
    return response.data;
  },
  
  getVariants: async (id: string) => {
    const response = await api.get(`/products-base/${id}/variants`);
    return response.data;
  },

  previewImportFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/products-base/import/preview-file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  importFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/products-base/import/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }
};

// Product Variants Services (el backend usa product-variants, no products)
export const productsAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/product-variants', { params });
    return response.data;
  },

  getCatalog: async (params?: any) => {
    const response = await api.get('/product-variants/catalog', { params });
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/product-variants/${id}`);
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/product-variants', data);
    return response.data;
  },
  
  update: async (id: string, data: any) => {
    const response = await api.patch(`/product-variants/${id}`, data);
    return response.data;
  },

  bulkUpdatePrices: async (data: {
    variantIds: string[];
    mode: 'percentage' | 'fixed' | 'direct';
    base: 'salePrice' | 'purchasePrice';
    value: number;
  }) => {
    const response = await api.post('/product-variants/bulk-update-prices', data);
    return response.data;
  },

  bulkUpdateStock: async (data: {
    variantIds: string[];
    mode: 'increment' | 'set';
    locationType: 'branch' | 'warehouse' | 'transit';
    branchId: string;
    value: number;
    minStock?: number;
  }) => {
    const response = await api.post('/product-variants/bulk-update-stock', data);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/product-variants/${id}`);
    return response.data;
  },

  getStockByBranch: async (variantId: string) => {
    const response = await api.get(`/product-variants/${variantId}/stock-by-branch`);
    return response.data;
  }
};

// Orders Services
export const ordersAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/orders', { params });
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/orders', data);
    return response.data;
  },

  sendToCash: async (id: string) => {
    const response = await api.post(`/orders/${id}/send-to-cash`);
    return response.data;
  },

  getCashQueue: async (params?: any) => {
    const response = await api.get('/orders/cash/queue', { params });
    return response.data;
  },

  getPendingDeliveries: async (params?: any) => {
    const response = await api.get('/orders/cash/pending-deliveries', { params });
    return response.data;
  },

  reviewInCash: async (id: string, data: any) => {
    const response = await api.post(`/orders/${id}/review`, data);
    return response.data;
  },

  deliverInCash: async (id: string, data: any) => {
    const response = await api.post(`/orders/${id}/deliver`, data);
    return response.data;
  },

  finalizeInCash: async (id: string, data: any) => {
    const response = await api.post(`/orders/${id}/finalize`, data);
    return response.data;
  },

  getRemitoPdf: async (id: string) => {
    const response = await api.get(`/orders/${id}/remito-pdf`);
    return response.data;
  },

  getDeliveryEventRemitoPdf: async (id: string, deliveryEventId: string) => {
    const response = await api.get(`/orders/${id}/delivery-events/${deliveryEventId}/remito-pdf`);
    return response.data;
  },

  getSellerMetrics: async (params?: any) => {
    const response = await api.get('/orders/seller/metrics', { params });
    return response.data;
  },
  
  update: async (id: string, data: any) => {
    const response = await api.patch(`/orders/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/orders/${id}`);
    return response.data;
  }
};

export const customersAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/customers', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  getCreditSummary: async (id: string) => {
    const response = await api.get(`/customers/${id}/credit-summary`);
    return response.data;
  },

  getCreditDocuments: async (id: string) => {
    const response = await api.get(`/customers/${id}/credit-documents`);
    return response.data;
  },

  getCreditMovements: async (id: string) => {
    const response = await api.get(`/customers/${id}/credit-movements`);
    return response.data;
  },

  applyCreditPayment: async (id: string, data: any) => {
    const response = await api.post(`/customers/${id}/credit-payments/apply`, data);
    return response.data;
  },

  applyCreditAdjustment: async (id: string, data: any) => {
    const response = await api.post(`/customers/${id}/credit-adjustments`, data);
    return response.data;
  },

  getCreditReceiptPdf: async (id: string, receiptId: string) => {
    const response = await api.get(`/customers/${id}/credit-receipts/${receiptId}/pdf`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/customers', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/customers/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  }
};

// Payments Services
export const paymentsAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/payments', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/payments/${id}`);
    return response.data;
  },

  create: async (data: any) => {
    const response = await api.post('/payments', data);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/payments/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/payments/${id}`);
  }
};

// Stock Services
export const stockAPI = {
  getAll: async (params?: any) => {
    const response = await api.get('/stock', { params });
    return response.data;
  },
  
  getById: async (id: string) => {
    const response = await api.get(`/stock/${id}`);
    return response.data;
  },
  
  create: async (data: any) => {
    const response = await api.post('/stock', data);
    return response.data;
  },
  
  transfer: async (data: any) => {
    const response = await api.post('/stock/transfer', data);
    return response.data;
  },
  
  getTransfers: async () => {
    const response = await api.get('/stock/transfers');
    return response.data;
  },
  
  getTransferById: async (id: string) => {
    const response = await api.get(`/stock/transfers/${id}`);
    return response.data;
  },
  
  update: async (id: string, data: any) => {
    const response = await api.patch(`/stock/${id}`, data);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/stock/${id}`);
    return response.data;
  },
  
  getActiveAlerts: async () => {
    const response = await api.get('/stock/alerts/active');
    return response.data;
  },
  
  resolveAlert: async (variantId: string) => {
    const response = await api.patch(`/stock/alerts/resolve/${variantId}`);
    return response.data;
  }
};

// Cash Services
export const cashAPI = {
  getCurrentRegister: async (branchId?: string) => {
    const response = await api.get('/cash/current', { params: branchId ? { branchId } : {} });
    return response.data;
  },
  
  openRegister: async (openingBalance: number = 0, branchId?: string) => {
    const response = await api.post('/cash/open', { openingBalance, branchId });
    return response.data;
  },
  
  closeRegister: async (id: string, data: any) => {
    const response = await api.post(`/cash/close/${id}`, data);
    return response.data;
  },
  
  addMovement: async (data: any) => {
    const response = await api.post('/cash/movement', data);
    return response.data;
  }
};

// Expenses Services
export const expensesAPI = {
  getFixed: async (branchId?: string) => {
    const response = await api.get('/expenses/fixed', { params: branchId ? { branchId } : {} });
    return response.data;
  },
  
  getVariable: async (branchId?: string) => {
    const response = await api.get('/expenses/variable', { params: branchId ? { branchId } : {} });
    return response.data;
  },
  
  createFixed: async (data: any) => {
    const response = await api.post('/expenses/fixed', data);
    return response.data;
  },
  
  createVariable: async (data: any) => {
    const response = await api.post('/expenses/variable', data);
    return response.data;
  },
  
  deleteFixed: async (id: string) => {
    const response = await api.delete(`/expenses/fixed/${id}`);
    return response.data;
  },
  
  deleteVariable: async (id: string) => {
    const response = await api.delete(`/expenses/variable/${id}`);
    return response.data;
  },
  
  getAll: async (branchId?: string) => {
    const [fixed, variable] = await Promise.all([
      expensesAPI.getFixed(branchId),
      expensesAPI.getVariable(branchId)
    ]);
    return [...fixed, ...variable];
  }
};
export const reportsAPI = {
  getFinanceReport: async (params?: { from?: string; to?: string; branchId?: string }) => {
    const response = await api.get('/reports/finance', { params });
    return response.data;
  },
  
  getCashMovements: async (params?: { type?: string; from?: string; to?: string; branchId?: string }) => {
    const response = await api.get('/reports/cash-movements', { params });
    return response.data;
  },
  
  getProfitReport: async (params?: { from?: string; to?: string; branchId?: string }) => {
    const response = await api.get('/reports/profit', { params });
    return response.data;
  },

  getSalesByProducts: async (params?: { 
    categoryId?: string; 
    brandId?: string; 
    productId?: string; 
    search?: string; 
    from?: string; 
    to?: string; 
    branchId?: string 
  }) => {
    const response = await api.get('/reports/sales/products', { params });
    return response.data;
  },

  getSalesByCategories: async (params?: { 
    search?: string; 
    from?: string; 
    to?: string; 
    branchId?: string 
  }) => {
    const response = await api.get('/reports/sales/categories', { params });
    return response.data;
  },

  getSalesByBrands: async (params?: { 
    search?: string; 
    from?: string; 
    to?: string; 
    branchId?: string 
  }) => {
    const response = await api.get('/reports/sales/brands', { params });
    return response.data;
  },
  
  getDailySummary: async (date?: string, branchId?: string) => {
    const params = {
      ...(date ? { date } : {}),
      ...(branchId ? { branchId } : {}),
    };
    const response = await api.get('/reports/daily', { params });
    return response.data;
  },
  
  getPriceChanges: async (params?: { from?: string; to?: string }) => {
    const response = await api.get('/reports/price-changes', { params });
    return response.data;
  },
  
  getStockSummary: async (params?: {
    search?: string;
    order?: 'asc' | 'desc';
    branchId?: string;
  }) => {
    const response = await api.get('/reports/stock', { params });
    return response.data;
  }
};

// Dashboard Services (NO EXISTEN EN EL BACKEND - se eliminarán)
export const dashboardAPI = {
  // Estos endpoints no existen en el backend, se eliminarán
};

export default api;
