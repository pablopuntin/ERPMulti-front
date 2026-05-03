# Frontend ELECTROTEC

Panel administrativo del ERP/POS multi-sucursal construido con Next.js.

El frontend está orientado a operación diaria real y debe respetar siempre la arquitectura de dominio del backend:

- `orders` como intención comercial / pre-venta
- `sales` como realidad comercial confirmada
- `remitos` como realidad documental y logística
- `payments` y `cash` como capa monetaria y de caja
- `customer-credit` como transición hacia una cuenta corriente más formal

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
- si la URL del backend es incorrecta, vas a ver `ERR_CONNECTION_REFUSED`, `Network Error`, `401` o timeouts de cliente

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

## Responsabilidad del frontend

La UI no debe inventar reglas de negocio centrales.

Su responsabilidad es:

- reflejar correctamente el estado operativo del backend
- exigir una sucursal resuelta antes de operar
- mostrar trazabilidad documental y monetaria sin mezclar conceptos
- guiar al usuario en flujos complejos como caja, cuenta corriente, transferencias y remitos

La UI no debería consolidar lógica crítica que tenga que vivir en backend, por ejemplo:

- autorización real por sucursal
- reglas definitivas de cuenta corriente
- resolución final de deuda
- verdad documental del remito

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
  - maneja timeouts y errores comunes de red/API

- **`app/dashboard/*`**
  - módulos operativos del panel administrativo

- **`app/dashboard/products/hooks/useProducts.ts`**
  - carga catálogo paginado desde backend
  - opera por `activeBranchId` para traer solo variantes asignadas comercialmente a la sucursal activa

- **`app/dashboard/hooks/useDashboardData.ts`**
  - alimenta KPIs, actividad reciente, alertas operativas y resumen del home

- **`app/dashboard/cash/*`**
  - núcleo de operación diaria en caja
  - revisión, entrega, cobro y emisión documental

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

La capa API adjunta `Authorization: Bearer <token>` en cada request autenticada.

---

## Regla central de sucursal en UI

La operación cotidiana se hace por **sucursal activa**.

### Reglas prácticas

- si el usuario tiene **`activeBranchId`**, la UI debe usarla automáticamente cuando corresponde
- si el usuario tiene acceso global y no hay sucursal activa, la UI debe pedir o enviar `branchId` según el flujo
- no se debe abrir caja, crear ventas, mover stock, generar reportes operativos o consultar información operativa sensible sin sucursal resuelta
- la visión multi-sucursal debe quedar reservada a reportes comparativos o pantallas explícitamente analíticas

### Módulos donde esto importa especialmente

- **Inicio**
- **Ventas**
- **Caja**
- **Clientes / cuenta corriente**
- **Gastos**
- **Reportes**
- **Transferencias / stock**

---

## Módulos reales del dashboard

Pantallas detectadas actualmente:

- **Inicio**
- **Clientes**
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
- selector de sucursal para operación diaria
- catálogo de productos con filtros, asignación por sucursal y acciones masivas
- importación/exportación CSV ligada a la sucursal activa
- módulo dedicado de transferencias en `/dashboard/stock`
- ventas con envío a caja
- caja con apertura, cierre, movimientos y cola operativa
- gastos fijos y variables
- reportes financieros
- Home operativo con KPIs, actividad reciente y alertas
- gestión visual de cuenta corriente en Clientes
- visualización de detalle documental y PDF de remitos

### En transición

- migración completa de consumos legacy de remito hacia endpoints de `remitos`
- mejora de UX de cuenta corriente para cobros posteriores y gestión operativa
- eliminación de datos simulados residuales en algunos widgets analíticos
- limpieza de logs de depuración en `services/api.ts`
- unificación visual entre piezas `shadcn/ui` y MUI

---

## Home operativo actual

El inicio fue rediseñado para responder rápido estas preguntas:

- **¿Cómo viene la venta hoy?**
- **¿Cómo está la caja?**
- **¿Hay problemas de stock?**
- **¿Qué tengo pendiente ahora?**

### Estructura actual

- **Fila 1**
  - ventas del día
  - caja actual
  - stock crítico
  - pendientes de entrega

- **Fila 2**
  - gráfico semanal de ventas

- **Fila 3**
  - actividad reciente
  - alertas operativas

### Nota actual

Los KPIs y alertas ya consumen datos reales. Algunos widgets analíticos todavía deben alinearse por completo con backend definitivo.

---

## Ventas, caja y remitos

### Flujo UI actual

1. desde **Ventas** se crea la orden
2. la orden se envía a caja
3. desde **Caja** se revisan cantidades
4. se cobra si corresponde
5. se entrega total o parcial
6. el backend crea `Sale` y `Remito`
7. la UI abre el PDF emitido

### Importante

La UI de caja debe mostrar claramente conceptos distintos:

- productos aprobados
- productos entregados ahora
- productos pendientes
- monto cobrado
- saldo pendiente / cuenta corriente
- documento emitido

No debe presentar `order` como si fuera la verdad final del negocio.

---

## Clientes y cuenta corriente

La pantalla visible hoy sigue estando en la ruta histórica **`/dashboard/categories`**, pero funcionalmente corresponde a **Clientes**.

Actualmente permite:

- alta y edición de clientes
- habilitar cliente para cuenta corriente
- configurar plazo de pago
- consultar resumen de cuenta corriente del cliente
- ver comprobantes y movimientos históricos
- abrir detalle de orden/remito asociado
- abrir PDF del remito

Esto ya permite trazabilidad operativa, pero todavía no es una gestión completa de:

- cobros posteriores
- reversos
- ajustes manuales de deuda
- notas de crédito/débito
- estados de cuenta consolidados

---

## Stock y transferencias

La operación diaria del catálogo y stock se apoya en la **sucursal activa**:

- la lista de productos muestra solo variantes asignadas a esa sucursal
- la alta manual trabaja sobre la sucursal activa
- la importación masiva asigna variantes a la sucursal activa confirmada por el usuario
- `gerente_sucursal` también puede exportar e importar CSV dentro de su sucursal activa
- el stock visible viene por ubicación (`branch`, `warehouse`, `transit`)
- usuarios globales también trabajan por sucursal activa en operación diaria

El módulo `/dashboard/stock` centraliza:

- creación de transferencias entre ubicaciones
- historial de transferencias
- visualización de stock por ubicación
- filtros de variantes con búsqueda

Actualmente el frontend consume:

- `POST /stock/transfer`
- `GET /stock/transfers`
- `GET /product-variants/catalog`
- `GET /product-variants/:id/stock-by-branch`

### Nota importante

Aunque el endpoint se llama `stock-by-branch`, hoy ya se usa para obtener stock real por ubicación y no solo por sucursal.

---

## Reglas UX que hoy conviene preservar

- en Caja, las cantidades aprobadas y a entregar deberían venir precompletadas para acelerar el cierre operativo
- la UI debe permitir corregir solo un ítem puntual si hace falta, no obligar a rearmar todo
- cuando hay pago parcial o cuenta corriente, la pantalla y el documento deben mostrar trazabilidad del saldo
- cuando el remito está totalmente impago, no deben mostrarse precios en el PDF

---

## Recomendaciones operativas

- iniciar backend primero en `http://localhost:4000`
- iniciar frontend luego en `http://localhost:3000`
- si hay `401`, revisar:
  - `localStorage.token`
  - `localStorage.user`
  - `NEXT_PUBLIC_API_URL`
  - respuesta de `/auth/login`
- si hay timeout en operaciones pesadas, revisar primero los timeouts definidos en `services/api.ts` antes de asumir error de negocio

---

## Archivos importantes del frontend

- **`src/services/api.ts`**
  - capa central de integración con backend

- **`src/components/auth/AuthContext.tsx`**
  - sesión, usuario y cambio de sucursal

- **`src/app/dashboard/cash/page.tsx`**
  - pantalla principal de caja

- **`src/app/dashboard/cash/components/CashQueuePanel.tsx`**
  - revisión, entrega, finalización y emisión de remitos

- **`src/app/dashboard/sales/page.tsx`**
  - armado de orden / envío a caja

- **`src/app/dashboard/products/*`**
  - catálogo, filtros, importación y administración por sucursal activa

- **`src/app/dashboard/hooks/useDashboardData.ts`**
  - Home operativo

---

## Observaciones de auditoría

- `services/api.ts` todavía contiene logs de depuración en interceptores
- conviven componentes de distintas librerías UI
- algunos flujos usan `fetch` manual y otros usan la capa Axios común
- todavía hay que terminar de alinear consumos documentales al módulo `remitos`

---

## Documentos relacionados

- **`../back/README.md`**
  - arquitectura y módulos del backend

- **`../README_TOTAL.md`**
  - visión integral del proyecto

- **`../README_IMPLEMENTACION_FUTURA.md`**
  - hoja de ruta recomendada para las próximas mejoras
