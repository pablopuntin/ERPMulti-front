# Frontend ELECTROTEC

Panel administrativo del ERP/POS multi-sucursal construido con Next.js.

---

## Stack

- **Next.js 16**
- **React 19**
- **TypeScript**
- **Axios**
- **Tailwind CSS**
- **shadcn/ui**
- **Lucide React**
- **MUI** en algunos diálogos y piezas legacy

---

## Scripts

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

---

## Variable de entorno obligatoria

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

### Importante

- la app usa **`NEXT_PUBLIC_API_URL`**
- `REACT_APP_API_URL` no corresponde a Next.js
- el backend local responde con prefijo global **`/api`**
- si la URL del backend es incorrecta, vas a ver `ERR_CONNECTION_REFUSED`, `Network Error` o `401` si la sesión no viaja bien

---

## Setup local

```bash
npm install
npm run dev
```

URLs por defecto:

- **Frontend**: `http://localhost:3000`
- **Backend esperado**: `http://localhost:4000/api`

---

## Arquitectura actual

### Carpetas principales

```text
src/
├── app/
│   ├── dashboard/
│   ├── login/
│   └── components/
├── components/
│   ├── auth/
│   └── products/
└── services/
```

### Piezas clave

- **`components/auth/AuthContext.tsx`**
  - mantiene usuario, token y permisos
  - expone `login`, `logout`, `switchBranch`
  - restaura sesión desde `localStorage`

- **`services/api.ts`**
  - instancia Axios
  - agrega token vía interceptor
  - centraliza acceso a endpoints del backend

- **`app/dashboard/*`**
  - módulos operativos del panel administrativo

- **`app/dashboard/products/hooks/useProducts.ts`**
  - carga catálogo paginado desde backend
  - opera por `activeBranchId` para traer solo variantes asignadas comercialmente a la sucursal activa
  - expone `products`, `meta`, `refreshProducts`

- **`app/dashboard/hooks/useDashboardData.ts`**
  - alimenta KPIs, actividad reciente, alertas operativas y resumen del home
  - usa endpoints reales para caja, reportes y pendientes, aunque el gráfico semanal todavía conserva datos simulados

---

## Modelo de sesión

El frontend persiste en `localStorage`:

- **`token`**
- **`user`**

El objeto `user` incluye al menos:

```json
{
  "id": "user-id",
  "email": "user@email.com",
  "name": "Usuario",
  "role": "manager",
  "branchId": "branch-id",
  "activeBranchId": "branch-id",
  "allowedBranchIds": ["branch-id"],
  "hasAllBranchAccess": false,
  "canCreateUsers": ["cashier", "seller"],
  "permissions": ["operate_branch", "manage_products"]
}
```

La capa API intenta adjuntar `Authorization: Bearer <token>` a cada request.

---

## Módulos reales del dashboard

Pantallas detectadas actualmente:

- **Inicio**
- **Clientes** (`/dashboard/categories`)
- **Productos**
- **Transferencias** (`/dashboard/stock`)
- **Ventas**
- **Caja**
- **Gastos**
- **Reportes**
- **Usuarios**
- **Configuración**

### Navegación visible actual

- **Vendedor**
  - solo **Ventas**

- **Cajero**
  - **Clientes**
  - **Inicio**
  - **Transferencias**
  - **Ventas**
  - **Caja**

- **Gerentes / Root**
  - **Clientes**
  - **Inicio**
  - **Productos**
  - **Transferencias**
  - **Ventas**
  - **Caja**
  - **Gastos**
  - **Reportes**
  - **Usuarios** según permisos
  - **Configuración** para `root` y `gerente_general`

---

## Estado funcional actual

### Implementado

- autenticación y restauración de sesión desde `localStorage`
- navegación del dashboard por rol
- logout visible en topbar
- catálogo de productos con filtros y acciones masivas
- importación de productos desde archivo con confirmación explícita de la sucursal activa destino
- exportación CSV de productos en formato reutilizable para reimportar desde otra sucursal activa
- módulo dedicado de transferencias en `/dashboard/stock`
- caja con apertura, cierre, movimientos y cola operativa
- gastos fijos y variables
- reportes financieros
- Home operativo con:
  - ventas del día
  - caja actual
  - stock crítico
  - pendientes de entrega
  - actividad reciente
  - alertas operativas
- selector de sucursal en el Home para usuarios globales sin sucursal activa
- gestión visual de cuenta corriente en Clientes:
  - resumen
  - comprobantes
  - movimientos
  - ver detalle de orden/remito
  - ver PDF de remito

### En revisión

- eliminación de datos simulados residuales en el gráfico semanal del Home
- limpieza de logs de depuración y notas legacy en la capa API
- unificación visual entre componentes `shadcn/ui` y MUI
- mejora de UX final de cuenta corriente para cobros posteriores y gestión operativa

---

## Home operativo actual

El inicio fue rediseñado para responder rápido cuatro preguntas:

- **¿Cómo viene la venta hoy?**
- **¿Cómo está la caja?**
- **¿Hay problemas de stock?**
- **¿Qué tengo pendiente ahora?**

### Estructura actual

- **Fila 1**
  - Ventas del día
  - Caja actual
  - Stock crítico
  - Pendientes de entrega

- **Fila 2**
  - gráfico semanal de ventas

- **Fila 3**
  - Actividad reciente
  - Alertas operativas

### Nota actual

Los KPIs y alertas usan datos reales, pero el gráfico semanal todavía no está completamente alineado a backend definitivo.

---

## Clientes y cuenta corriente

La pantalla visible hoy sigue estando en la ruta histórica **`/dashboard/categories`**, pero funcionalmente corresponde a **Clientes**.

Actualmente permite:

- alta/edición de clientes
- habilitar cliente para cuenta corriente
- configurar plazo de pago
- consultar resumen de cuenta corriente del cliente
- ver comprobantes y movimientos históricos
- abrir detalle de la orden/remito asociada
- abrir PDF acumulado del remito

Esto ya da una base operativa de trazabilidad, aunque todavía no constituye una gestión completa de cobros posteriores.

---

## Stock y transferencias

La operación diaria del catálogo y stock se apoya en la **sucursal activa**:

- la lista de productos muestra solo variantes asignadas a esa sucursal
- la alta manual crea stock inicial solo sobre la sucursal activa
- la importación masiva asigna variantes a la sucursal activa confirmada por el usuario
- `gerente_sucursal` también puede exportar e importar CSV dentro de su sucursal activa
- el stock visible sigue viniendo por ubicación (`branch`, `warehouse`, `transit`)
- usuarios globales también trabajan por sucursal activa en operación diaria

El módulo `/dashboard/stock` centraliza:

- creación de transferencias entre:
  - `branch`
  - `warehouse`
  - `transit`
- historial de transferencias
- visualización de stock por ubicación
- filtros de variantes con búsqueda

Actualmente el frontend consume:

- `POST /stock/transfer`
- `GET /stock/transfers`
- `GET /product-variants/catalog`
- `GET /product-variants/:id/stock-by-branch`

## Nota importante

Aunque el endpoint se llama `stock-by-branch`, hoy ya se usa para obtener stock real por ubicación y no solo por sucursal.

---

## Reglas multi-sucursal en UI

### Principio general

Los módulos operativos deben trabajar con una sucursal resuelta antes de crear o consultar datos estrictamente operativos.

### Regla de formularios y vistas

- si el usuario tiene **`activeBranchId`**, se usa automáticamente cuando aplica
- si el usuario tiene acceso global y no hay sucursal activa, la UI debe pedir o enviar `branchId` según el flujo
- el Home operativo no debe consultar caja actual sin una sucursal resuelta
- el frontend debe mantener coherencia con la sucursal activa del JWT o con la sucursal elegida explícitamente

### Módulos donde esto importa especialmente

- **Inicio**
- **Ventas**
- **Pagos**
- **Caja**
- **Gastos**
- **Reportes**
- **Transferencias / stock**

---

## Recomendaciones operativas

- iniciar backend primero en `http://localhost:4000`
- iniciar frontend luego en `http://localhost:3000`
- si hay `401`, revisar:
  - `localStorage.token`
  - `localStorage.user`
  - `NEXT_PUBLIC_API_URL`
  - respuesta de `/auth/login`

---

## Observaciones de auditoría

- `services/api.ts` todavía contiene logs de depuración en interceptores
- el Home del dashboard ya usa datos reales para KPIs y alertas, pero aún mezcla datos simulados en el gráfico semanal
- conviven componentes de distintas librerías UI
- algunos flujos usan `fetch` manual y otros usan la capa Axios común
- el frontend ya está preparado para seguir refactorizando layout sin romper la integración principal con backend
