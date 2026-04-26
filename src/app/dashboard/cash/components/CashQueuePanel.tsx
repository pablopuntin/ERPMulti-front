"use client";

import { useState } from "react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { useAuth } from "@/components/auth/AuthContext";
import { ordersAPI } from "@/services/api";

export interface CashQueueOrderItem {
  id: string;
  quantity: number;
  approvedQuantity?: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  deliveredQuantity?: number;
  price?: number;
  status?: string;
  notes?: string;
  variant?: {
    id: string;
    name?: string;
    sku?: string;
  };
}

export interface CashQueueOrder {
  id: string;
  remitoNumber: string;
  sellerName: string;
  customerId?: string;
  customerName: string;
  creditEnabled?: boolean;
  submittedAt?: string;
  total: number;
  approvedTotal: number;
  amountPaid?: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  status: string;
  restrictSalesToBranchStock?: boolean;
  itemsCount: number;
  notes?: string;
  items: CashQueueOrderItem[];
}

interface ReviewItemState {
  decision: "approved" | "approved_pending_stock" | "rejected";
  approvedQuantity: number;
  deliveredQuantity: number;
  notes: string;
}

interface PaymentDraftState {
  amount: string;
  method: string;
  notes: string;
}

interface ModalState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
}

const roundCurrency = (value: number) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const getItemDisplayName = (item: CashQueueOrderItem) => item.variant?.name || "Producto";

const buildStockExceededMessage = ({
  productName,
  requestedQuantity,
  availableNow,
  pendingAfter,
}: {
  productName: string;
  requestedQuantity: number;
  availableNow: number;
  pendingAfter: number;
}) => `No hay stock suficiente para ${productName}. Se quiso entregar ${requestedQuantity} unidad(es), pero solo hay ${availableNow} disponible(s) para entregar ahora. Quedan ${pendingAfter} unidad(es) pendiente(s) sin stock.`;

const getOrderStateSnapshot = (order: CashQueueOrder, orderState?: Record<string, ReviewItemState>) => {
  const state = orderState || buildInitialState(order);
  const items = order.items.map((item) => {
    const itemState = normalizeReviewItemState(state[item.id] || buildInitialState(order)[item.id]);
    const approvedQuantity = Number(itemState.approvedQuantity || 0);
    const deliveredQuantity = Number(itemState.deliveredQuantity || 0);
    const deliveredNow = Math.max(deliveredQuantity - Number(item.deliveredQuantity || 0), 0);
    const pendingQuantity = Math.max(approvedQuantity - deliveredQuantity, 0);
    const availableNowBase = item.availableQuantity !== undefined
      ? Number(item.availableQuantity || 0) + Number(item.reservedQuantity || 0)
      : Number(item.reservedQuantity || 0);
    const availableNow = Math.max(Math.min(availableNowBase, approvedQuantity - Number(item.deliveredQuantity || 0)), 0);
    const subtotal = roundCurrency(approvedQuantity * Number(item.price || 0));

    return {
      item,
      itemState,
      approvedQuantity,
      deliveredQuantity,
      deliveredNow,
      pendingQuantity,
      availableNow,
      subtotal,
    };
  });

  return {
    items,
    approvedTotal: roundCurrency(items.reduce((sum, entry) => sum + entry.subtotal, 0)),
    hasPendingItems: items.some((entry) => entry.pendingQuantity > 0),
    hasPendingStockItems: items.some((entry) => entry.itemState.decision === "approved_pending_stock" && entry.pendingQuantity > 0),
  };
};

const buildInitialState = (order: CashQueueOrder) => {
  return order.items.reduce<Record<string, ReviewItemState>>((acc, item) => {
    const approvedQuantity = Number(item.approvedQuantity && item.approvedQuantity > 0 ? item.approvedQuantity : item.quantity ?? 0);
    const alreadyDelivered = Number(item.deliveredQuantity || 0);
    const pendingToDeliver = Math.max(approvedQuantity - alreadyDelivered, 0);
    const availableToDeliverBase = item.availableQuantity !== undefined
      ? Number(item.availableQuantity || 0) + Number(item.reservedQuantity || 0)
      : Number(item.reservedQuantity || 0);
    const deliverNowByDefault = Math.max(Math.min(availableToDeliverBase, pendingToDeliver), 0);
    const deliveredQuantity = alreadyDelivered + deliverNowByDefault;
    const currentStatus = item.status === "approved_pending_stock"
      ? "approved_pending_stock"
      : item.status === "rejected"
        ? "rejected"
        : "approved";

    acc[item.id] = {
      decision: order.restrictSalesToBranchStock && currentStatus === "approved_pending_stock"
        ? "approved"
        : currentStatus,
      approvedQuantity,
      deliveredQuantity: order.restrictSalesToBranchStock ? approvedQuantity : deliveredQuantity,
      notes: item.notes || "",
    };

    return acc;
  }, {});
};

const normalizeReviewItemState = (state: ReviewItemState): ReviewItemState => {
  if (state.decision === "rejected") {
    return {
      ...state,
      approvedQuantity: 0,
      deliveredQuantity: 0,
    };
  }

  return {
    ...state,
    approvedQuantity: Math.max(0, state.approvedQuantity),
    deliveredQuantity: Math.max(0, Math.min(state.deliveredQuantity, state.approvedQuantity)),
  };
};

const openPdfFromBase64 = (base64: string, fileName: string) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const pdfWindow = window.open(url, "_blank", "noopener,noreferrer");

  if (!pdfWindow) {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 60_000);
};

export default function CashQueuePanel({
  orders,
  onReload,
  title = "Remitos en caja",
  description = "Revisá los ítems solo si necesitás cambiar algo y luego finalizá la transacción desde acá.",
  emptyMessage = "No hay remitos pendientes en caja.",
}: {
  orders: CashQueueOrder[];
  onReload: () => Promise<void>;
  title?: string;
  description?: string;
  emptyMessage?: string;
}) {
  const { user } = useAuth();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<Record<string, Record<string, ReviewItemState>>>({});
  const [paymentState, setPaymentState] = useState<Record<string, PaymentDraftState>>({});
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    title: "",
    description: "",
  });

  const closeModal = () => {
    setModalState((current) => ({
      ...current,
      open: false,
      onConfirm: undefined,
    }));
  };

  const showInfoModal = (title: string, description: string) => {
    setModalState({
      open: true,
      title,
      description,
      confirmLabel: "Aceptar",
    });
  };

  const showConfirmModal = ({
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
  }: Omit<ModalState, "open">) => {
    setModalState({
      open: true,
      title,
      description,
      confirmLabel,
      cancelLabel,
      onConfirm,
    });
  };

  const ensureOrderState = (order: CashQueueOrder) => {
    setReviewState((current) => {
      if (current[order.id]) {
        return current;
      }
      return {
        ...current,
        [order.id]: buildInitialState(order),
      };
    });
  };

  const clearOrderUiState = (orderId: string) => {
    setExpandedOrderId((current) => (current === orderId ? null : current));
    setReviewState((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });
    setPaymentState((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });
  };

  const handleExpand = (order: CashQueueOrder) => {
    ensureOrderState(order);
    const snapshot = getOrderStateSnapshot(order, reviewState[order.id] || buildInitialState(order));
    const pendingAmount = roundCurrency(Math.max(Number(snapshot.approvedTotal || order.approvedTotal || order.total || 0) - Number(order.amountPaid || 0), 0));
    setPaymentState((current) => ({
      ...current,
      [order.id]: current[order.id] || {
        amount: pendingAmount > 0 ? pendingAmount.toFixed(2) : "",
        method: "cash",
        notes: "",
      },
    }));
    setExpandedOrderId((current) => (current === order.id ? null : order.id));
  };

  const updateItemState = (orderId: string, itemId: string, patch: Partial<ReviewItemState>) => {
    const order = orders.find((entry) => entry.id === orderId);
    const isStrictStockOrder = Boolean(order?.restrictSalesToBranchStock);
    setReviewState((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] || {}),
        [itemId]: (() => {
          const nextState = normalizeReviewItemState({
            ...(current[orderId]?.[itemId] || {
            decision: "approved",
            approvedQuantity: 0,
            deliveredQuantity: 0,
            notes: "",
            }),
            ...patch,
          });

          if (isStrictStockOrder) {
            const normalizedDecision = nextState.decision === "approved_pending_stock"
              ? "approved"
              : nextState.decision;

            return normalizeReviewItemState({
              ...nextState,
              decision: normalizedDecision,
              deliveredQuantity: normalizedDecision === "rejected"
                ? 0
                : nextState.approvedQuantity,
            });
          }

          return nextState;
        })(),
      },
    }));
  };

  const getPendingStockWarnings = (order: CashQueueOrder) => {
    const snapshot = getOrderStateSnapshot(order, reviewState[order.id] || buildInitialState(order));

    return snapshot.items.flatMap((entry) => {
      const pendingAfter = Math.max(entry.approvedQuantity - (Number(entry.item.deliveredQuantity || 0) + Math.min(entry.deliveredNow, entry.availableNow)), 0);

      if (entry.deliveredNow > entry.availableNow) {
        return [buildStockExceededMessage({
          productName: getItemDisplayName(entry.item),
          requestedQuantity: entry.deliveredNow,
          availableNow: entry.availableNow,
          pendingAfter,
        })];
      }

      if (entry.itemState.decision === "approved_pending_stock" && pendingAfter > 0) {
        return [`${getItemDisplayName(entry.item)} queda con ${pendingAfter} unidad(es) pendiente(s) por falta de stock.`];
      }

      return [];
    });
  };

  const handleReview = async (order: CashQueueOrder, rejectEntireOrder = false) => {
    setSubmittingOrderId(order.id);

    try {
      const orderState = reviewState[order.id] || buildInitialState(order);
      await ordersAPI.reviewInCash(order.id, {
        rejectEntireOrder,
        items: order.items.map((item) => ({
          itemId: item.id,
          decision: normalizeReviewItemState(orderState[item.id] || buildInitialState(order)[item.id]).decision,
          approvedQuantity: Number(normalizeReviewItemState(orderState[item.id] || buildInitialState(order)[item.id]).approvedQuantity || 0),
          notes: normalizeReviewItemState(orderState[item.id] || buildInitialState(order)[item.id]).notes?.trim() || undefined,
        })),
      });

      showInfoModal("Operación exitosa", rejectEntireOrder ? "Remito rechazado correctamente." : "Remito revisado correctamente.");
      await onReload();
      clearOrderUiState(order.id);
    } catch (reviewError: any) {
      showInfoModal("No se pudo revisar el remito", reviewError?.response?.data?.message || reviewError?.message || "No se pudo revisar el remito.");
    } finally {
      setSubmittingOrderId(null);
    }
  };

  const executeFinalize = async (order: CashQueueOrder, forceReprint = false) => {
    if (!user?.id) {
      throw new Error("No hay usuario autenticado para finalizar el remito.");
    }

    const orderState = reviewState[order.id] || buildInitialState(order);
    const snapshot = getOrderStateSnapshot(order, orderState);
    const pendingAmount = roundCurrency(Math.max(Number(snapshot.approvedTotal || order.approvedTotal || order.total || 0) - Number(order.amountPaid || 0), 0));
    const paymentDraft = paymentState[order.id] || {
      amount: pendingAmount > 0 ? pendingAmount.toFixed(2) : "",
      method: "cash",
      notes: "",
    };
    const paymentMethod = paymentDraft.method || "cash";
    if (paymentMethod === "current_account" && (!order.customerId || !order.creditEnabled)) {
      throw new Error("La cuenta corriente solo está disponible para clientes registrados y habilitados.");
    }
    const paymentAmount = paymentMethod === "current_account"
      ? roundCurrency(Number(paymentDraft.amount || 0))
      : pendingAmount;

    const payload = {
      items: order.items.map((item) => {
        const itemState = normalizeReviewItemState(orderState[item.id] || buildInitialState(order)[item.id]);
        return {
          itemId: item.id,
          decision: itemState.decision,
          approvedQuantity: Number(itemState.approvedQuantity || 0),
          deliveredQuantity: Number(itemState.deliveredQuantity || 0),
          notes: itemState.notes?.trim() || undefined,
        };
      }),
      payment: pendingAmount > 0 ? {
        amount: paymentAmount,
        method: paymentMethod,
        notes: paymentDraft.notes?.trim() || undefined,
        paidByUserId: user.id,
      } : undefined,
      forceReprint,
    };

    const result = await ordersAPI.finalizeInCash(order.id, payload);

    if (result?.pdfBase64) {
      openPdfFromBase64(result.pdfBase64, result.pdfFileName || `${order.remitoNumber}.pdf`);
    }

    showInfoModal(
      "Operación exitosa",
      result?.pdfType === "delivery_event"
        ? (result?.paymentRegistered ? "Entrega puntual registrada, cobro aplicado y remito de retiro emitido correctamente." : "Entrega puntual registrada y remito de retiro emitido correctamente.")
        : (result?.paymentRegistered ? "Remito acumulado finalizado, cobrado y emitido correctamente." : "Remito acumulado emitido correctamente."),
    );
    await onReload();
    clearOrderUiState(order.id);
  };

  const handleFinalize = async (order: CashQueueOrder, forceReprint = false) => {
    setSubmittingOrderId(order.id);

    try {
      const stockWarnings = getPendingStockWarnings(order);

      if (stockWarnings.length > 0 && !forceReprint) {
        showConfirmModal({
          title: "Hay productos pendientes por falta de stock",
          description: `${stockWarnings.join("\n")}`,
          confirmLabel: "Continuar igual",
          cancelLabel: "Volver",
          onConfirm: async () => {
            closeModal();
            setSubmittingOrderId(order.id);
            try {
              await executeFinalize(order, forceReprint);
            } catch (finalizeError: any) {
              const backendMessage = finalizeError?.response?.data?.message || finalizeError?.message || "No se pudo finalizar el remito.";
              if (String(backendMessage).includes("No hubo cambios en el remito")) {
                showConfirmModal({
                  title: "No hubo cambios en el remito",
                  description: "¿Deseas reimprimirlo igualmente?",
                  confirmLabel: "Reimprimir",
                  cancelLabel: "Cancelar",
                  onConfirm: async () => {
                    closeModal();
                    setSubmittingOrderId(order.id);
                    try {
                      await executeFinalize(order, true);
                    } catch (retryError: any) {
                      showInfoModal("No se pudo finalizar el remito", retryError?.response?.data?.message || retryError?.message || "No se pudo finalizar el remito.");
                    } finally {
                      setSubmittingOrderId(null);
                    }
                  },
                });
              } else {
                showInfoModal("No se pudo finalizar el remito", backendMessage);
              }
            } finally {
              setSubmittingOrderId(null);
            }
          },
        });
        return;
      }
      await executeFinalize(order, forceReprint);
    } catch (finalizeError: any) {
      const backendMessage = finalizeError?.response?.data?.message || finalizeError?.message || "No se pudo finalizar el remito.";
      if (String(backendMessage).includes("No hubo cambios en el remito")) {
        showConfirmModal({
          title: "No hubo cambios en el remito",
          description: "¿Deseas reimprimirlo igualmente?",
          confirmLabel: "Reimprimir",
          cancelLabel: "Cancelar",
          onConfirm: async () => {
            closeModal();
            setSubmittingOrderId(order.id);
            try {
              await executeFinalize(order, true);
            } catch (retryError: any) {
              showInfoModal("No se pudo finalizar el remito", retryError?.response?.data?.message || retryError?.message || "No se pudo finalizar el remito.");
            } finally {
              setSubmittingOrderId(null);
            }
          },
        });
        return;
      }
      showInfoModal("No se pudo finalizar el remito", backendMessage);
    } finally {
      setSubmittingOrderId(null);
    }
  };

  const handlePrintCumulative = async (order: CashQueueOrder) => {
    setSubmittingOrderId(order.id);

    try {
      const result = await ordersAPI.getRemitoPdf(order.id);

      if (result?.pdfBase64) {
        openPdfFromBase64(result.pdfBase64, result.pdfFileName || `${order.remitoNumber}.pdf`);
      }

      showInfoModal("Operación exitosa", "Remito acumulado reimpreso correctamente.");
    } catch (printError: any) {
      showInfoModal("No se pudo reimprimir el remito acumulado", printError?.response?.data?.message || printError?.message || "No se pudo reimprimir el remito acumulado.");
    } finally {
      setSubmittingOrderId(null);
    }
  };

  const updatePaymentState = (orderId: string, patch: Partial<PaymentDraftState>) => {
    setPaymentState((current) => ({
      ...current,
      [orderId]: {
        amount: current[orderId]?.amount || "",
        method: current[orderId]?.method || "cash",
        notes: current[orderId]?.notes || "",
        ...patch,
      },
    }));
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <Dialog open={modalState.open} onOpenChange={(open) => {
        if (!open) {
          closeModal();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalState.title}</DialogTitle>
            <DialogDescription className="whitespace-pre-line">{modalState.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {modalState.cancelLabel && (
              <Button variant="outline" onClick={closeModal}>
                {modalState.cancelLabel}
              </Button>
            )}
            <Button
              onClick={async () => {
                if (modalState.onConfirm) {
                  await modalState.onConfirm();
                  return;
                }
                closeModal();
              }}
            >
              {modalState.confirmLabel || "Aceptar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge variant="outline" className="text-foreground">{orders.length} en cola</Badge>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const orderState = reviewState[order.id] || {};
            const isExpanded = expandedOrderId === order.id;
            const snapshot = getOrderStateSnapshot(order, reviewState[order.id] || buildInitialState(order));
            const reviewedApprovedTotal = roundCurrency(Number(snapshot.approvedTotal || order.approvedTotal || 0));
            const reviewedPendingAmount = roundCurrency(Math.max(reviewedApprovedTotal - Number(order.amountPaid || 0), 0));
            const selectedPaymentMethod = paymentState[order.id]?.method || "cash";
            const canUseCurrentAccount = Boolean(order.customerId && order.creditEnabled);
            const isStrictStockOrder = Boolean(order.restrictSalesToBranchStock);
            const paymentDraftAmount = paymentState[order.id]?.amount;
            const paymentInputValue = selectedPaymentMethod === "current_account"
              ? (paymentDraftAmount !== undefined
                ? paymentDraftAmount
                : reviewedPendingAmount > 0
                  ? reviewedPendingAmount.toFixed(2)
                  : "")
              : (reviewedPendingAmount > 0 ? reviewedPendingAmount.toFixed(2) : "");

            return (
              <div key={order.id} className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-semibold text-foreground">{order.sellerName} - {order.customerName}</div>
                    <div className="text-sm text-muted-foreground">Remito {order.remitoNumber} · {order.itemsCount} ítems</div>
                    <div className="text-xs text-muted-foreground mt-1">Enviado: {order.submittedAt ? new Date(order.submittedAt).toLocaleString("es-AR") : "Sin fecha"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-foreground">Estado: {order.status}</Badge>
                    <Badge variant="outline" className="text-foreground">Pago: {order.paymentStatus}</Badge>
                    <Badge variant="outline" className="text-foreground">Entrega: {order.fulfillmentStatus}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-muted-foreground">Total pedido</div>
                    <div className="font-semibold text-foreground">${order.total.toLocaleString("es-AR")}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-muted-foreground">Total revisado</div>
                    <div className="font-semibold text-foreground">${reviewedApprovedTotal.toLocaleString("es-AR")}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-muted-foreground">Cobrado</div>
                    <div className="font-semibold text-foreground">${Number(order.amountPaid || 0).toLocaleString("es-AR")}</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-muted-foreground">Pendiente de cobro</div>
                    <div className="font-semibold text-foreground">${reviewedPendingAmount.toLocaleString("es-AR")}</div>
                  </div>
                </div>

                {order.notes && (
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                    {order.notes}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => handleExpand(order)}>
                    {isExpanded ? "Ocultar detalle" : "Revisar ítems"}
                  </Button>
                  <Button variant="outline" onClick={() => handleReview(order, true)} disabled={submittingOrderId === order.id}>
                    Rechazar remito
                  </Button>
                  <Button variant="outline" onClick={() => handlePrintCumulative(order)} disabled={submittingOrderId === order.id}>
                    Ver / Reimprimir acumulado
                  </Button>
                  <Button onClick={() => handleFinalize(order)} disabled={submittingOrderId === order.id}>
                    {order.paymentStatus === 'paid' ? 'Registrar entrega puntual' : 'Finalizar'}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="space-y-3 border-t border-border pt-4">
                    {order.paymentStatus !== 'paid' && (
                      <div className="rounded-lg border border-border p-3 space-y-3">
                        <div className="font-medium text-foreground">Pago</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="text-sm text-foreground block mb-1">Monto</label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={paymentInputValue}
                              onChange={(e) => updatePaymentState(order.id, { amount: e.target.value })}
                              disabled={selectedPaymentMethod !== "current_account"}
                            />
                            {selectedPaymentMethod !== "current_account" && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                El monto se completa automáticamente con el saldo revisado.
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="text-sm text-foreground block mb-1">Medio</label>
                            <select
                              value={paymentState[order.id]?.method || "cash"}
                              onChange={(e) => {
                                if (e.target.value === "current_account" && !canUseCurrentAccount) {
                                  showInfoModal(
                                    "Cuenta corriente no disponible",
                                    !order.customerId
                                      ? "Debes asociar un cliente registrado al remito para poder usar cuenta corriente."
                                      : "El cliente asociado no está habilitado para operar con cuenta corriente.",
                                  );
                                  updatePaymentState(order.id, { method: "cash" });
                                  return;
                                }

                                updatePaymentState(order.id, { method: e.target.value });
                              }}
                              className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                            >
                              <option value="cash">Efectivo</option>
                              <option value="card">Tarjeta</option>
                              <option value="transfer">Transferencia</option>
                              <option value="mercadopago">MercadoPago</option>
                              <option value="current_account">Cuenta corriente</option>
                            </select>
                            {!canUseCurrentAccount && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {!order.customerId
                                  ? "La cuenta corriente requiere un cliente registrado en la base de datos."
                                  : "El cliente actual no está habilitado para cuenta corriente."}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="text-sm text-foreground block mb-1">Notas</label>
                            <Input
                              value={paymentState[order.id]?.notes || ""}
                              onChange={(e) => updatePaymentState(order.id, { notes: e.target.value })}
                              placeholder="Opcional"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {order.items.map((item) => {
                      const itemState = orderState[item.id] || buildInitialState(order)[item.id];
                      const alreadyDelivered = Number(item.deliveredQuantity || 0);
                      const approvedQuantity = Number(itemState.approvedQuantity || 0);
                      const pendingToDeliver = Math.max(approvedQuantity - alreadyDelivered, 0);
                      const deliverNowQuantity = Math.max(Number(itemState.deliveredQuantity || 0) - alreadyDelivered, 0);
                      const availableToDeliverBase = item.availableQuantity !== undefined
                        ? Number(item.availableQuantity || 0) + Number(item.reservedQuantity || 0)
                        : Number(item.reservedQuantity || 0);
                      const availableToDeliverNow = Math.max(Math.min(availableToDeliverBase, pendingToDeliver), 0);
                      const fullyDelivered = approvedQuantity > 0 && pendingToDeliver === 0;
                      const reviewedSubtotal = roundCurrency(approvedQuantity * Number(item.price || 0));
                      return (
                        <div key={item.id} className="rounded-lg border border-border p-3 space-y-3">
                          <div>
                            <div className="font-medium text-foreground">{item.variant?.name || "Producto"}</div>
                            <div className="text-xs text-muted-foreground">{item.variant?.sku || "Sin SKU"} · Pedido: {item.quantity} · Reservado: {Number(item.reservedQuantity || 0)} · Disponible sucursal: {Number(item.availableQuantity || 0)} · P. unitario: ${Number(item.price || 0).toLocaleString("es-AR")}</div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-sm text-foreground block mb-1">Decisión</label>
                              <select
                                value={itemState.decision}
                                onChange={(e) => updateItemState(order.id, item.id, { decision: e.target.value as ReviewItemState["decision"] })}
                                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                              >
                                <option value="approved">Aprobado</option>
                                {!isStrictStockOrder && <option value="approved_pending_stock">Aprobado pendiente stock</option>}
                                <option value="rejected">Rechazado</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-sm text-foreground block mb-1">Cant. aprobada</label>
                              <Input
                                type="number"
                                min={alreadyDelivered}
                                max={item.quantity}
                                value={itemState.approvedQuantity}
                                onChange={(e) => updateItemState(order.id, item.id, { approvedQuantity: Math.max(alreadyDelivered, Math.min(item.quantity, Number(e.target.value) || 0)) })}
                              />
                            </div>

                            <div>
                              <label className="text-sm text-foreground block mb-1">Cant. a entregar ahora</label>
                              {isStrictStockOrder ? (
                                <Input
                                  type="number"
                                  value={approvedQuantity}
                                  disabled
                                  className="bg-muted/50"
                                />
                              ) : (
                                <Input
                                  type="number"
                                  min="0"
                                  max={pendingToDeliver}
                                  value={deliverNowQuantity}
                                  onChange={(e) => {
                                    const requestedNow = Math.max(0, Math.min(pendingToDeliver, Number(e.target.value) || 0));
                                    const deliverableNow = Math.min(requestedNow, availableToDeliverNow);
                                    if (requestedNow > availableToDeliverNow) {
                                      const pendingAfter = Math.max(approvedQuantity - (alreadyDelivered + availableToDeliverNow), 0);
                                      showInfoModal(
                                        "Stock insuficiente para esta entrega",
                                        buildStockExceededMessage({
                                          productName: getItemDisplayName(item),
                                          requestedQuantity: requestedNow,
                                          availableNow: availableToDeliverNow,
                                          pendingAfter,
                                        }),
                                      );
                                    }
                                    updateItemState(order.id, item.id, { deliveredQuantity: alreadyDelivered + deliverableNow });
                                  }}
                                  disabled={fullyDelivered}
                                  className={fullyDelivered ? "bg-muted/50" : ""}
                                />
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {isStrictStockOrder
                                  ? `En stock estricto, la entrega siempre coincide con la cantidad aprobada.`
                                  : `Ya entregado: ${alreadyDelivered} · Pendiente: ${pendingToDeliver} · Disponible ahora: ${availableToDeliverNow}`}
                              </div>
                              {fullyDelivered && (
                                <div className="text-xs text-muted-foreground mt-1">Ya entregado completamente - no modificable</div>
                              )}
                              {!isStrictStockOrder && !fullyDelivered && deliverNowQuantity > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">Se entregarán {deliverNowQuantity} ahora. Total acumulado: {alreadyDelivered + deliverNowQuantity}.</div>
                              )}
                              {!isStrictStockOrder && !fullyDelivered && deliverNowQuantity > availableToDeliverNow && (
                                <div className="text-xs text-destructive mt-1">No se puede entregar más de {availableToDeliverNow} unidad(es) ahora por stock reservado/disponible.</div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">Subtotal revisado: ${reviewedSubtotal.toLocaleString("es-AR")}</div>
                            </div>

                            <div>
                              <label className="text-sm text-foreground block mb-1">Notas</label>
                              <Input
                                value={itemState.notes}
                                onChange={(e) => updateItemState(order.id, item.id, { notes: e.target.value })}
                                placeholder="Detalle"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {(() => {
                      const snapshot = getOrderStateSnapshot(order, orderState);
                      const pendingAmount = roundCurrency(Math.max(snapshot.approvedTotal - Number(order.amountPaid || 0), 0));
                      return (
                        <div className="rounded-lg border border-border bg-muted/20 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground">Total revisado</div>
                            <div className="font-semibold text-foreground">${snapshot.approvedTotal.toLocaleString("es-AR")}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Cobrado acumulado</div>
                            <div className="font-semibold text-foreground">${Number(order.amountPaid || 0).toLocaleString("es-AR")}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Saldo luego de revisión</div>
                            <div className="font-semibold text-foreground">${pendingAmount.toLocaleString("es-AR")}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
