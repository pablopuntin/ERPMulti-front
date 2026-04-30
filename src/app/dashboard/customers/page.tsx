"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Building2, CreditCard, FileText, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { branchesAPI, customersAPI, ordersAPI } from "@/services/api";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

interface BranchOption {
  id: string;
  name: string;
}

interface CustomerBranchAssignment {
  id?: string;
  branchId: string;
  isDefault?: boolean;
  isActive?: boolean;
  branch?: {
    id: string;
    name: string;
  };
}

interface Customer {
  id: string;
  fullName: string;
  document?: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive: boolean;
  isCreditEnabled?: boolean;
  creditPaymentTermDays?: number;
  branchAssignments?: CustomerBranchAssignment[];
  createdAt?: string;
  updatedAt?: string;
}

interface CustomerFormState {
  fullName: string;
  document: string;
  phone: string;
  email: string;
  notes: string;
  isCreditEnabled: boolean;
  creditPaymentTermDays: string;
  branchIds: string[];
  defaultBranchId: string;
}

interface CustomerCreditSummary {
  customerId: string;
  customerName: string;
  creditEnabled: boolean;
  totalBalance: number;
  overdueBalance: number;
  openDocuments: number;
  partiallyPaidDocuments: number;
  paidDocuments: number;
  lastPaymentAt?: string;
  nextDueDate?: string;
}

interface CustomerCreditDocument {
  id: string;
  orderId: string;
  orderRemitoNumber?: string;
  originalAmount: number;
  currentAmount: number;
  amountPaid: number;
  balance: number;
  status: "open" | "partially_paid" | "paid" | "cancelled";
  dueDate?: string;
  firstPaymentAt?: string;
  lastPaymentAt?: string;
  pricingLocked: boolean;
  pricingUpdatedBeforeFirstPayment: boolean;
  notes?: string;
  createdAt?: string;
}

type CreditPaymentMode = "auto" | "by_documents";
type CreditAdjustmentType = "credit_note" | "debit_note";

interface CreditPaymentResponse {
  receipt?: {
    id: string;
  };
}

interface CreditAdjustmentResponse {
  document?: CustomerCreditDocument;
  summary?: CustomerCreditSummary;
}

interface CreditAdjustmentFormState {
  creditDocumentId: string;
  type: CreditAdjustmentType;
  amount: string;
  reason: string;
}

interface OrderDetailItem {
  id: string;
  approvedQuantity?: number;
  deliveredQuantity?: number;
  price?: number;
  notes?: string;
  variant?: {
    name?: string;
    sku?: string;
  };
}

interface OrderDetail {
  id: string;
  remitoNumber?: string;
  status?: string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  total?: number;
  approvedTotal?: number;
  deliveredTotal?: number;
  amountPaid?: number;
  notes?: string;
  createdAt?: string;
  customer?: {
    fullName?: string;
    phone?: string;
    email?: string;
    document?: string;
  };
  branch?: {
    name?: string;
  };
  user?: {
    firstname?: string;
    lastname?: string;
  };
  items?: OrderDetailItem[];
}

interface CustomerCreditMovement {
  id: string;
  creditDocumentId?: string;
  orderId?: string;
  paymentId?: string;
  type: string;
  sign: "debit" | "credit";
  amount: number;
  balanceAfter: number;
  description?: string;
  createdAt?: string;
}

const emptyForm: CustomerFormState = {
  fullName: "",
  document: "",
  phone: "",
  email: "",
  notes: "",
  isCreditEnabled: false,
  creditPaymentTermDays: "0",
  branchIds: [],
  defaultBranchId: "",
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

const formatCurrency = (value?: number | string | null) => currencyFormatter.format(Number(value || 0));

const formatDate = (value?: string | null) => {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return dateFormatter.format(parsed);
};

const getDocumentStatusLabel = (status: CustomerCreditDocument["status"]) => {
  switch (status) {
    case "open":
      return "Abierto";
    case "partially_paid":
      return "Pago parcial";
    case "paid":
      return "Pagado";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
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
  const openedInNewWindow = Boolean(pdfWindow);

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
  }, 1000);

  return {
    openedInNewWindow,
  };
};

const getMovementTypeLabel = (type: string) => {
  switch (type) {
    case "document_charge":
      return "Cargo por comprobante";
    case "payment":
      return "Cobro";
    case "payment_reversal":
      return "Reversión de cobro";
    case "system_reconciliation":
      return "Reconciliación automática";
    case "reprice":
      return "Reajuste de precio";
    case "surcharge":
      return "Nota de débito";
    case "discount":
      return "Nota de crédito";
    case "manual_adjustment":
      return "Ajuste manual";
    case "cancellation":
      return "Cancelación";
    default:
      return type;
  }
};

export default function CustomersManagementPage() {
  const { user, canAccessAllBranches } = useAuth();
  const isGlobalUser = canAccessAllBranches();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [creditSummary, setCreditSummary] = useState<CustomerCreditSummary | null>(null);
  const [creditSummaryByCustomer, setCreditSummaryByCustomer] = useState<Record<string, CustomerCreditSummary>>({});
  const [creditSummaryLoading, setCreditSummaryLoading] = useState(false);
  const [creditDocuments, setCreditDocuments] = useState<CustomerCreditDocument[]>([]);
  const [creditMovements, setCreditMovements] = useState<CustomerCreditMovement[]>([]);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditError, setCreditError] = useState("");
  const [expandedCustomerId, setExpandedCustomerId] = useState("");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [pdfLoadingOrderId, setPdfLoadingOrderId] = useState("");
  const [creditPaymentDialogOpen, setCreditPaymentDialogOpen] = useState(false);
  const [creditPaymentMode, setCreditPaymentMode] = useState<CreditPaymentMode>("auto");
  const [creditPaymentAmount, setCreditPaymentAmount] = useState("");
  const [creditPaymentMethod, setCreditPaymentMethod] = useState("cash");
  const [creditPaymentNotes, setCreditPaymentNotes] = useState("");
  const [creditPaymentApplications, setCreditPaymentApplications] = useState<Record<string, string>>({});
  const [creditPaymentSubmitting, setCreditPaymentSubmitting] = useState(false);
  const [creditReceiptLoadingId, setCreditReceiptLoadingId] = useState("");
  const [lastCreditReceiptByCustomer, setLastCreditReceiptByCustomer] = useState<Record<string, string>>({});
  const [creditAdjustmentDialogOpen, setCreditAdjustmentDialogOpen] = useState(false);
  const [creditAdjustmentSubmitting, setCreditAdjustmentSubmitting] = useState(false);
  const [creditAdjustmentForm, setCreditAdjustmentForm] = useState<CreditAdjustmentFormState>({
    creditDocumentId: "",
    type: "credit_note",
    amount: "",
    reason: "",
  });
  const [selectedAdjustmentDocument, setSelectedAdjustmentDocument] = useState<CustomerCreditDocument | null>(null);

  const visibleBranches = useMemo(() => {
    if (isGlobalUser) {
      return branches;
    }

    const allowed = new Set(user?.allowedBranchIds || []);
    return branches.filter((branch) => allowed.has(branch.id));
  }, [branches, isGlobalUser, user?.allowedBranchIds]);

  const activeBranchId = user?.activeBranchId || user?.branchId || "";

  const activeBranch = useMemo(() => {
    return visibleBranches.find((branch) => branch.id === activeBranchId) || null;
  }, [visibleBranches, activeBranchId]);

  const resolvedBranchId = useMemo(() => {
    if (selectedBranchId) {
      return selectedBranchId;
    }

    if (activeBranchId) {
      return activeBranchId;
    }

    return visibleBranches[0]?.id || "";
  }, [selectedBranchId, activeBranchId, visibleBranches]);

  const loadBranches = async () => {
    const data = await branchesAPI.getAll();
    const mapped = Array.isArray(data)
      ? data.map((branch: any) => ({ id: branch.id, name: branch.name || branch.id }))
      : [];
    setBranches(mapped);
  };

  const loadCustomers = async (branchId?: string, search?: string) => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};

      if (branchId && branchId !== "all") {
        params.branchId = branchId;
      }

      if (search?.trim()) {
        params.search = search.trim();
      }

      const data = await customersAPI.getAll(params);
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setErrorMessage(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudieron cargar los clientes.");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCreditData = async (customerId: string) => {
    try {
      setCreditLoading(true);
      setCreditError("");

      const [summary, documents, movements] = await Promise.all([
        customersAPI.getCreditSummary(customerId),
        customersAPI.getCreditDocuments(customerId),
        customersAPI.getCreditMovements(customerId),
      ]);

      setCreditSummary(summary || null);
      setCreditDocuments(Array.isArray(documents) ? documents : []);
      setCreditMovements(Array.isArray(movements) ? movements : []);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setCreditError(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudo cargar la cuenta corriente del cliente.");
      setCreditSummary(null);
      setCreditDocuments([]);
      setCreditMovements([]);
    } finally {
      setCreditLoading(false);
    }
  };

  useEffect(() => {
    if (activeBranchId) {
      setSelectedBranchId(activeBranchId);
      return;
    }

    if (!selectedBranchId && visibleBranches.length > 0) {
      setSelectedBranchId(visibleBranches[0].id);
    }
  }, [activeBranchId, selectedBranchId, visibleBranches]);

  useEffect(() => {
    const initialize = async () => {
      try {
        await loadBranches();
      } catch (error: any) {
        const backendMessage = error?.response?.data?.message;
        setErrorMessage(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudieron cargar las sucursales.");
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    loadCustomers(resolvedBranchId || undefined, searchTerm);
  }, [resolvedBranchId, searchTerm]);

  useEffect(() => {
    if (!customers.length) {
      setSelectedCustomerId("");
      setExpandedCustomerId("");
      return;
    }

    if (!selectedCustomerId || !customers.some((customer) => customer.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);

  useEffect(() => {
    loadCreditSummarySnapshots(customers);
  }, [customers]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setCreditSummary(null);
      setCreditDocuments([]);
      setCreditMovements([]);
      setCreditError("");
      return;
    }

    loadCreditData(selectedCustomerId);
  }, [selectedCustomerId]);

  const openCreditDocuments = useMemo(
    () => creditDocuments.filter((document) => Number(document.balance || 0) > 0 && document.status !== "cancelled"),
    [creditDocuments],
  );

  const selectedApplicationsTotal = useMemo(() => {
    if (creditPaymentMode !== "by_documents") {
      return 0;
    }

    return openCreditDocuments.reduce((sum, document) => {
      const raw = creditPaymentApplications[document.id];
      const normalized = Number(String(raw || "").replace(",", "."));
      if (!Number.isFinite(normalized) || normalized <= 0) {
        return sum;
      }
      return sum + normalized;
    }, 0);
  }, [creditPaymentApplications, creditPaymentMode, openCreditDocuments]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) || null,
    [customers, selectedCustomerId],
  );

  const adjustmentMaxAmount = useMemo(() => {
    if (!selectedAdjustmentDocument) {
      return 0;
    }

    if (creditAdjustmentForm.type === "credit_note") {
      return Math.max(
        Number(selectedAdjustmentDocument.currentAmount || 0) - Number(selectedAdjustmentDocument.amountPaid || 0),
        0,
      );
    }

    return Number.MAX_SAFE_INTEGER;
  }, [creditAdjustmentForm.type, selectedAdjustmentDocument]);

  const loadCreditSummarySnapshots = async (customerList: Customer[]) => {
    if (!customerList.length) {
      setCreditSummaryByCustomer({});
      return;
    }

    try {
      setCreditSummaryLoading(true);
      const summaryEntries = await Promise.all(
        customerList.map(async (customer) => {
          try {
            const summary = await customersAPI.getCreditSummary(customer.id);
            return [customer.id, summary] as const;
          } catch {
            return [customer.id, {
              customerId: customer.id,
              customerName: customer.fullName,
              creditEnabled: Boolean(customer.isCreditEnabled),
              totalBalance: 0,
              overdueBalance: 0,
              openDocuments: 0,
              partiallyPaidDocuments: 0,
              paidDocuments: 0,
            }] as const;
          }
        })
      );

      setCreditSummaryByCustomer(Object.fromEntries(summaryEntries));
    } finally {
      setCreditSummaryLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      ...emptyForm,
      branchIds: resolvedBranchId ? [resolvedBranchId] : [],
      defaultBranchId: resolvedBranchId,
    });
    setEditingCustomer(null);
    setErrorMessage("");
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      fullName: customer.fullName || "",
      document: customer.document || "",
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || "",
      isCreditEnabled: Boolean(customer.isCreditEnabled),
      creditPaymentTermDays: String(customer.creditPaymentTermDays ?? 0),
      branchIds: [resolvedBranchId],
      defaultBranchId: resolvedBranchId,
    });
    setErrorMessage("");
    setSuccessMessage("");
    setModalOpen(true);
  };

  const handleInputChange = (field: keyof Omit<CustomerFormState, "branchIds" | "defaultBranchId" | "isCreditEnabled">) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.fullName.trim()) {
      setErrorMessage("Debés completar el nombre completo del cliente.");
      return;
    }

    const resolvedBranchIds = resolvedBranchId ? [resolvedBranchId] : [];

    const resolvedDefaultBranchId = resolvedBranchId;

    if (!resolvedDefaultBranchId) {
      setErrorMessage("Debés tener una sucursal operativa seleccionada para guardar el cliente.");
      return;
    }

    const payload = {
      fullName: form.fullName.trim(),
      document: form.document.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
      isCreditEnabled: form.isCreditEnabled,
      creditPaymentTermDays: Math.max(0, Number(form.creditPaymentTermDays || 0)),
      branchAssignments: resolvedBranchIds.map((branchId) => ({
        branchId,
        isDefault: branchId === resolvedDefaultBranchId,
      })),
    };

    try {
      setSaving(true);

      if (editingCustomer) {
        await customersAPI.update(editingCustomer.id, payload);
      } else {
        await customersAPI.create(payload);
      }

      setSuccessMessage(editingCustomer ? "Cliente actualizado correctamente." : "Cliente creado correctamente.");
      setModalOpen(false);
      resetForm();
      await loadCustomers(resolvedBranchId || undefined, searchTerm);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setErrorMessage(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudo guardar el cliente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!customerToDelete) {
      return;
    }

    try {
      setSaving(true);
      await customersAPI.delete(customerToDelete.id);
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
      setSuccessMessage("Cliente eliminado correctamente.");
      await loadCustomers(resolvedBranchId || undefined, searchTerm);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setErrorMessage(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudo eliminar el cliente.");
    } finally {
      setSaving(false);
    }
  };

  const handleViewOrderDetail = async (orderId?: string) => {
    if (!orderId) {
      setDetailError("El comprobante no tiene un pedido asociado para mostrar.");
      setDetailDialogOpen(true);
      return;
    }

    try {
      setDetailLoading(true);
      setDetailError("");
      setDetailDialogOpen(true);
      const order = await ordersAPI.getById(orderId);
      setSelectedOrderDetail(order || null);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setDetailError(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudo cargar el detalle del remito.");
      setSelectedOrderDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewRemitoPdf = async (orderId?: string, remitoNumber?: string) => {
    if (!orderId) {
      setErrorMessage("El comprobante no tiene un pedido asociado para reimprimir el remito.");
      return;
    }

    try {
      setPdfLoadingOrderId(orderId);
      const result = await ordersAPI.getRemitoPdf(orderId);

      if (result?.pdfBase64) {
        const openResult = openPdfFromBase64(result.pdfBase64, result.pdfFileName || `${remitoNumber || orderId}.pdf`);
        setSuccessMessage(openResult.openedInNewWindow
          ? "Remito abierto correctamente."
          : "El navegador bloqueó la nueva pestaña. Se descargó el remito automáticamente.");
        return;
      }

      setErrorMessage("El backend no devolvió un PDF válido para este remito.");
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setErrorMessage(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudo abrir el PDF del remito.");
    } finally {
      setPdfLoadingOrderId("");
    }
  };

  const handleOpenCreditPaymentDialog = () => {
    if (!selectedCustomerId) {
      setErrorMessage("Seleccioná un cliente para registrar un cobro de cuenta corriente.");
      return;
    }

    setCreditPaymentMode("auto");
    setCreditPaymentAmount("");
    setCreditPaymentMethod("cash");
    setCreditPaymentNotes("");
    setCreditPaymentApplications({});
    setCreditPaymentSubmitting(false);
    setCreditPaymentDialogOpen(true);
  };

  const handleToggleCustomerDetail = (customerId: string) => {
    if (expandedCustomerId === customerId) {
      setExpandedCustomerId("");
      return;
    }

    setExpandedCustomerId(customerId);
    setSelectedCustomerId(customerId);
    setCreditError("");
  };

  const handleOpenCreditPaymentDialogForCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setExpandedCustomerId(customerId);
    handleOpenCreditPaymentDialog();
  };

  const handleOpenCreditAdjustmentDialog = (
    customerId: string,
    document: CustomerCreditDocument,
    type: CreditAdjustmentType,
  ) => {
    setSelectedCustomerId(customerId);
    setExpandedCustomerId(customerId);
    setSelectedAdjustmentDocument(document);
    setCreditAdjustmentForm({
      creditDocumentId: document.id,
      type,
      amount: "",
      reason: "",
    });
    setCreditAdjustmentSubmitting(false);
    setCreditAdjustmentDialogOpen(true);
  };

  const handleApplyCreditAdjustment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedCustomerId || !selectedAdjustmentDocument) {
      setErrorMessage("Seleccioná un cliente y un comprobante para registrar el ajuste.");
      return;
    }

    const amount = Number(creditAdjustmentForm.amount.replace(",", "."));
    const reason = creditAdjustmentForm.reason.trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      setErrorMessage("Ingresá un importe válido mayor a cero para el ajuste.");
      return;
    }

    if (!reason) {
      setErrorMessage("Debés indicar el motivo del ajuste.");
      return;
    }

    if (creditAdjustmentForm.type === "credit_note" && amount > adjustmentMaxAmount) {
      setErrorMessage("La nota de crédito no puede superar el saldo ajustable actual del comprobante.");
      return;
    }

    try {
      setCreditAdjustmentSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const result = await customersAPI.applyCreditAdjustment(selectedCustomerId, {
        creditDocumentId: creditAdjustmentForm.creditDocumentId,
        type: creditAdjustmentForm.type,
        amount,
        reason,
      }) as CreditAdjustmentResponse;

      await loadCreditData(selectedCustomerId);

      if (result?.summary) {
        setCreditSummaryByCustomer((current) => ({
          ...current,
          [selectedCustomerId]: result.summary as CustomerCreditSummary,
        }));
      } else {
        await loadCreditSummarySnapshots(customers);
      }

      setSuccessMessage(
        creditAdjustmentForm.type === "credit_note"
          ? "Nota de crédito registrada correctamente."
          : "Nota de débito registrada correctamente.",
      );
      setCreditAdjustmentDialogOpen(false);
      setSelectedAdjustmentDocument(null);
      setCreditAdjustmentForm({
        creditDocumentId: "",
        type: "credit_note",
        amount: "",
        reason: "",
      });
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setErrorMessage(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudo registrar el ajuste de cuenta corriente.");
    } finally {
      setCreditAdjustmentSubmitting(false);
    }
  };

  const handleCreditApplicationAmountChange = (documentId: string, value: string) => {
    setCreditPaymentApplications((current) => ({
      ...current,
      [documentId]: value,
    }));
  };

  const handleViewCreditReceiptPdf = async (
    receiptId?: string,
    options: { showSuccessMessage?: boolean } = {},
  ) => {
    if (!selectedCustomerId || !receiptId) {
      return false;
    }

    try {
      setCreditReceiptLoadingId(receiptId);
      const result = await customersAPI.getCreditReceiptPdf(selectedCustomerId, receiptId);
      if (result?.pdfBase64) {
        const openResult = openPdfFromBase64(result.pdfBase64, result.pdfFileName || `recibo-cc-${receiptId}.pdf`);
        if (options.showSuccessMessage ?? true) {
          setSuccessMessage(openResult.openedInNewWindow
            ? "Recibo de cobro abierto correctamente."
            : "El navegador bloqueó la nueva pestaña. Se descargó el recibo automáticamente.");
        }
        return true;
      }
      setErrorMessage("El backend no devolvió un PDF válido para el recibo de cobro.");
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setErrorMessage(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudo abrir el PDF del recibo de cobro.");
    } finally {
      setCreditReceiptLoadingId("");
    }

    return false;
  };

  const handleApplyCreditPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCustomerId) {
      setErrorMessage("Seleccioná un cliente para registrar el cobro.");
      return;
    }

    const method = creditPaymentMethod.trim() || "cash";
    let generatedReceiptId = "";

    try {
      setCreditPaymentSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (creditPaymentMode === "auto") {
        const amount = Number(creditPaymentAmount.replace(",", "."));
        if (!Number.isFinite(amount) || amount <= 0) {
          setErrorMessage("Ingresá un importe válido mayor a cero para el cobro automático.");
          return;
        }

        const result = await customersAPI.applyCreditPayment(selectedCustomerId, {
          mode: "auto",
          amount,
          method,
          notes: creditPaymentNotes.trim() || undefined,
        }) as CreditPaymentResponse;

        const receiptId = result?.receipt?.id || "";
        generatedReceiptId = receiptId;
        if (receiptId) {
          setLastCreditReceiptByCustomer((current) => ({
            ...current,
            [selectedCustomerId]: receiptId,
          }));
        }
        setSuccessMessage(receiptId
          ? `Cobro aplicado correctamente. Recibo generado: ${receiptId}.`
          : "Cobro aplicado correctamente.");
      } else {
        const applications = openCreditDocuments
          .map((document) => {
            const amount = Number(String(creditPaymentApplications[document.id] || "").replace(",", "."));
            return {
              creditDocumentId: document.id,
              amount,
              maxBalance: Number(document.balance || 0),
              label: document.orderRemitoNumber || document.orderId,
            };
          })
          .filter((item) => Number.isFinite(item.amount) && item.amount > 0);

        if (!applications.length) {
          setErrorMessage("Seleccioná al menos un remito con monto mayor a cero para registrar el cobro.");
          return;
        }

        const invalidApplication = applications.find((item) => item.amount > item.maxBalance);
        if (invalidApplication) {
          setErrorMessage(`El monto para el remito ${invalidApplication.label} supera su saldo pendiente.`);
          return;
        }

        const amount = applications.reduce((sum, item) => sum + item.amount, 0);

        const result = await customersAPI.applyCreditPayment(selectedCustomerId, {
          mode: "by_documents",
          amount,
          method,
          notes: creditPaymentNotes.trim() || undefined,
          applications: applications.map((item) => ({
            creditDocumentId: item.creditDocumentId,
            amount: item.amount,
          })),
        }) as CreditPaymentResponse;

        const receiptId = result?.receipt?.id || "";
        generatedReceiptId = receiptId;
        if (receiptId) {
          setLastCreditReceiptByCustomer((current) => ({
            ...current,
            [selectedCustomerId]: receiptId,
          }));
        }
        setSuccessMessage(receiptId
          ? `Cobro por remitos aplicado correctamente. Recibo generado: ${receiptId}.`
          : "Cobro por remitos aplicado correctamente.");
      }

      await loadCreditData(selectedCustomerId);
      setCreditPaymentDialogOpen(false);

      if (generatedReceiptId) {
        await handleViewCreditReceiptPdf(generatedReceiptId, { showSuccessMessage: false });
      }
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setErrorMessage(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudo registrar el cobro de cuenta corriente.");
    } finally {
      setCreditPaymentSubmitting(false);
    }
  };

  const totalAssignments = customers.reduce((sum, customer) => sum + ((customer.branchAssignments || []).filter((assignment) => assignment.isActive !== false).length), 0);

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestión de Clientes</h1>
          <p className="text-muted-foreground mt-1">
            Alta, edición y baja lógica de clientes con configuración básica de cuenta corriente.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Clientes activos</p>
              <p className="text-2xl font-bold text-foreground">{customers.length}</p>
            </div>
            <Users className="w-8 h-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Con documento</p>
              <p className="text-2xl font-bold text-foreground">{customers.filter((customer) => !!customer.document).length}</p>
            </div>
            <Users className="w-8 h-8 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Asignaciones de sucursal</p>
              <p className="text-2xl font-bold text-foreground">{totalAssignments}</p>
            </div>
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col xl:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nombre, documento o teléfono..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Mostrando clientes según la <span className="font-medium text-foreground">sucursal activa</span> seleccionada en la barra superior.
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert>
          <AlertTitle>Operación exitosa</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <CardDescription>
            La lista muestra clientes activos y su estado básico de cuenta corriente según el backend actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando clientes...</p>
          ) : customers.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No se encontraron clientes con los filtros actuales.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden lg:grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1.5fr_auto] gap-4 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Cliente</span>
                <span>Documento</span>
                <span>Teléfono</span>
                <span>Cuenta corriente</span>
                <span>Sucursales</span>
                <span className="text-right">Acciones</span>
              </div>
              {customers.map((customer) => {
                const assignments = (customer.branchAssignments || []).filter((assignment) => assignment.isActive !== false);
                const customerSummary = creditSummaryByCustomer[customer.id];
                const isExpanded = expandedCustomerId === customer.id;
                const lastReceiptId = lastCreditReceiptByCustomer[customer.id] || "";
                return (
                  <div key={customer.id} className="rounded-xl border border-border p-4">
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_1.5fr_auto] gap-4 items-start">
                      <div>
                        <p className="font-semibold text-foreground">{customer.fullName}</p>
                        <p className="text-sm text-muted-foreground">{customer.email || "Sin email"}</p>
                        {customer.notes && (
                          <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{customer.notes}</p>
                        )}
                      </div>
                      <div className="text-sm text-foreground">{customer.document || "—"}</div>
                      <div className="text-sm text-foreground">{customer.phone || "—"}</div>
                      <div className="flex flex-col gap-1 text-sm">
                        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-medium ${customer.isCreditEnabled ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-border text-muted-foreground"}`}>
                          {customer.isCreditEnabled ? "Habilitada" : "No habilitada"}
                        </span>
                        {creditSummaryLoading && !customerSummary ? (
                          <span className="text-xs text-muted-foreground">Cargando deuda...</span>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground">
                              Deuda: {formatCurrency(customerSummary?.totalBalance || 0)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Vencido: {formatCurrency(customerSummary?.overdueBalance || 0)}
                            </span>
                          </>
                        )}
                        {customer.isCreditEnabled && (
                          <span className="text-xs text-muted-foreground">
                            Plazo: {Number(customer.creditPaymentTermDays || 0)} día(s)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {assignments.length > 0 ? assignments.map((assignment) => (
                          <span key={`${customer.id}-${assignment.branchId}`} className="rounded-full border px-3 py-1 text-xs font-medium">
                            {assignment.branch?.name || assignment.branchId}{assignment.isDefault ? " · Predeterminada" : ""}
                          </span>
                        )) : (
                          <span className="text-sm text-muted-foreground">Sin sucursales asignadas</span>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleToggleCustomerDetail(customer.id)}>
                          <CreditCard className="w-4 h-4 mr-2" />
                          {isExpanded ? "Ocultar" : "Ver más"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openEditModal(customer)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setCustomerToDelete(customer);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-6 border-t border-border pt-6 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">Cuenta corriente del cliente</h3>
                            <p className="text-sm text-muted-foreground">Resumen, comprobantes y movimientos históricos del cliente seleccionado.</p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleOpenCreditPaymentDialogForCustomer(customer.id)}
                            disabled={creditLoading && selectedCustomerId === customer.id}
                          >
                            Registrar cobro
                          </Button>
                        </div>

                        {lastReceiptId && selectedCustomerId === customer.id && (
                          <div className="rounded-lg border border-border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <p className="text-sm text-foreground">
                              Último recibo generado: <span className="font-semibold">{lastReceiptId}</span>
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleViewCreditReceiptPdf(lastReceiptId)}
                              disabled={creditReceiptLoadingId === lastReceiptId}
                            >
                              {creditReceiptLoadingId === lastReceiptId ? "Abriendo recibo..." : "Ver recibo PDF"}
                            </Button>
                          </div>
                        )}

                        {creditError && selectedCustomerId === customer.id && (
                          <Alert variant="destructive">
                            <AlertTitle>Error al cargar cuenta corriente</AlertTitle>
                            <AlertDescription>{creditError}</AlertDescription>
                          </Alert>
                        )}

                        {creditLoading && selectedCustomerId === customer.id ? (
                          <p className="text-sm text-muted-foreground">Cargando resumen de cuenta corriente...</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                              <Card>
                                <CardContent className="p-4 flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Saldo total</p>
                                    <p className="text-2xl font-bold text-foreground">{formatCurrency(creditSummary?.totalBalance)}</p>
                                  </div>
                                  <CreditCard className="w-8 h-8 text-muted-foreground" />
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4 flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Saldo vencido</p>
                                    <p className="text-2xl font-bold text-foreground">{formatCurrency(creditSummary?.overdueBalance)}</p>
                                  </div>
                                  <CreditCard className="w-8 h-8 text-muted-foreground" />
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4 flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Comprobantes abiertos</p>
                                    <p className="text-2xl font-bold text-foreground">{creditSummary?.openDocuments || 0}</p>
                                  </div>
                                  <FileText className="w-8 h-8 text-muted-foreground" />
                                </CardContent>
                              </Card>
                              <Card>
                                <CardContent className="p-4 flex items-center justify-between">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Pagos parciales</p>
                                    <p className="text-2xl font-bold text-foreground">{creditSummary?.partiallyPaidDocuments || 0}</p>
                                  </div>
                                  <Users className="w-8 h-8 text-muted-foreground" />
                                </CardContent>
                              </Card>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                              <div className="rounded-xl border border-border p-4 space-y-2">
                                <p className="text-sm font-medium text-foreground">Estado general</p>
                                <div className="flex flex-wrap gap-2">
                                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${creditSummary?.creditEnabled ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700" : "border-border text-muted-foreground"}`}>
                                    {creditSummary?.creditEnabled ? "Cuenta corriente habilitada" : "Cuenta corriente no habilitada"}
                                  </span>
                                  <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
                                    Próximo vencimiento: {formatDate(creditSummary?.nextDueDate)}
                                  </span>
                                  <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
                                    Último cobro: {formatDate(creditSummary?.lastPaymentAt)}
                                  </span>
                                </div>
                              </div>
                              <div className="rounded-xl border border-border p-4 space-y-2">
                                <p className="text-sm font-medium text-foreground">Totales de comprobantes</p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                  <div className="rounded-lg bg-muted/30 p-3">
                                    <p className="text-muted-foreground">Abiertos</p>
                                    <p className="font-semibold text-foreground">{creditSummary?.openDocuments || 0}</p>
                                  </div>
                                  <div className="rounded-lg bg-muted/30 p-3">
                                    <p className="text-muted-foreground">Parciales</p>
                                    <p className="font-semibold text-foreground">{creditSummary?.partiallyPaidDocuments || 0}</p>
                                  </div>
                                  <div className="rounded-lg bg-muted/30 p-3">
                                    <p className="text-muted-foreground">Pagados</p>
                                    <p className="font-semibold text-foreground">{creditSummary?.paidDocuments || 0}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <h3 className="text-lg font-semibold text-foreground">Comprobantes</h3>
                                <p className="text-sm text-muted-foreground">Deuda asociada a remitos y estado actual de cada comprobante.</p>
                              </div>
                              {creditDocuments.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                                  Este cliente no tiene comprobantes de cuenta corriente todavía.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {creditDocuments.map((document) => (
                                    <div key={document.id} className="rounded-xl border border-border p-4">
                                      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-foreground">Remito {document.orderRemitoNumber || document.orderId}</p>
                                            <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
                                              {getDocumentStatusLabel(document.status)}
                                            </span>
                                            {document.pricingLocked && (
                                              <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
                                                Precio bloqueado
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-sm text-muted-foreground">
                                            Vencimiento: {formatDate(document.dueDate)} · Primer pago: {formatDate(document.firstPaymentAt)} · Último pago: {formatDate(document.lastPaymentAt)}
                                          </p>
                                          <div className="flex flex-wrap gap-2 pt-1">
                                            <Button type="button" variant="outline" size="sm" onClick={() => handleViewOrderDetail(document.orderId)}>
                                              Ver detalle
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleOpenCreditAdjustmentDialog(customer.id, document, "credit_note")}
                                              disabled={Number(document.balance || 0) <= 0}
                                            >
                                              Nota crédito
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleOpenCreditAdjustmentDialog(customer.id, document, "debit_note")}
                                            >
                                              Nota débito
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleViewRemitoPdf(document.orderId, document.orderRemitoNumber)}
                                              disabled={pdfLoadingOrderId === document.orderId}
                                            >
                                              {pdfLoadingOrderId === document.orderId ? "Abriendo PDF..." : "Ver PDF"}
                                            </Button>
                                          </div>
                                          {document.notes && (
                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{document.notes}</p>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-full xl:min-w-[430px]">
                                          <div className="rounded-lg bg-muted/30 p-3 text-sm">
                                            <p className="text-muted-foreground">Original</p>
                                            <p className="font-semibold text-foreground">{formatCurrency(document.originalAmount)}</p>
                                          </div>
                                          <div className="rounded-lg bg-muted/30 p-3 text-sm">
                                            <p className="text-muted-foreground">Actual</p>
                                            <p className="font-semibold text-foreground">{formatCurrency(document.currentAmount)}</p>
                                          </div>
                                          <div className="rounded-lg bg-muted/30 p-3 text-sm">
                                            <p className="text-muted-foreground">Cobrado</p>
                                            <p className="font-semibold text-foreground">{formatCurrency(document.amountPaid)}</p>
                                          </div>
                                          <div className="rounded-lg bg-muted/30 p-3 text-sm">
                                            <p className="text-muted-foreground">Saldo</p>
                                            <p className="font-semibold text-foreground">{formatCurrency(document.balance)}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div>
                                <h3 className="text-lg font-semibold text-foreground">Movimientos</h3>
                                <p className="text-sm text-muted-foreground">Trazabilidad cronológica de cargos, cobros y ajustes sobre la cuenta corriente.</p>
                              </div>
                              {creditMovements.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                                  Este cliente no tiene movimientos registrados todavía.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {creditMovements.map((movement) => (
                                    <div key={movement.id} className="rounded-xl border border-border p-4">
                                      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${movement.sign === "debit" ? "border-amber-500/40 bg-amber-500/10 text-amber-700" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"}`}>
                                              {movement.sign === "debit" ? "Débito" : "Crédito"}
                                            </span>
                                            <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
                                              {getMovementTypeLabel(movement.type)}
                                            </span>
                                          </div>
                                          <p className="text-sm text-foreground">{movement.description || "Sin descripción"}</p>
                                          <p className="text-xs text-muted-foreground">
                                            Fecha: {formatDate(movement.createdAt)} · Comprobante: {movement.creditDocumentId || "—"} · Pedido: {movement.orderId || "—"}
                                          </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 min-w-full xl:min-w-[240px]">
                                          <div className="rounded-lg bg-muted/30 p-3 text-sm">
                                            <p className="text-muted-foreground">Monto</p>
                                            <p className="font-semibold text-foreground">{formatCurrency(movement.amount)}</p>
                                          </div>
                                          <div className="rounded-lg bg-muted/30 p-3 text-sm">
                                            <p className="text-muted-foreground">Saldo resultante</p>
                                            <p className="font-semibold text-foreground">{formatCurrency(movement.balanceAfter)}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto bg-card text-foreground border border-border">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
            <DialogDescription>
              Desde esta pantalla podés administrar datos generales del cliente, sucursales y habilitación de cuenta corriente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="fullName">Nombre completo *</Label>
                <Input id="fullName" value={form.fullName} onChange={handleInputChange("fullName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document">Documento</Label>
                <Input id="document" value={form.document} onChange={handleInputChange("document")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={form.phone} onChange={handleInputChange("phone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={handleInputChange("email")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea id="notes" value={form.notes} onChange={handleInputChange("notes")} rows={4} />
              </div>
              <div className="space-y-3 md:col-span-2 rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <input
                    id="isCreditEnabled"
                    type="checkbox"
                    checked={form.isCreditEnabled}
                    onChange={(event) => setForm((current) => ({ ...current, isCreditEnabled: event.target.checked }))}
                    className="mt-1"
                  />
                  <div>
                    <Label htmlFor="isCreditEnabled">Habilitar cuenta corriente</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Permite usar cuenta corriente para este cliente en caja y generar deuda por comprobante.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="creditPaymentTermDays">Plazo de pago en días</Label>
                  <Input
                    id="creditPaymentTermDays"
                    type="number"
                    min="0"
                    value={form.creditPaymentTermDays}
                    onChange={handleInputChange("creditPaymentTermDays")}
                    disabled={!form.isCreditEnabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usá `0` si no querés establecer vencimiento automático.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sucursal asignada</Label>
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-foreground">
                {visibleBranches.find((branch) => branch.id === resolvedBranchId)?.name || activeBranch?.name || "Sucursal activa"}
              </div>
              <p className="text-sm text-muted-foreground">
                Desde esta pantalla operativa, el cliente se relacionará automáticamente con la sucursal seleccionada actualmente.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : editingCustomer ? "Guardar cambios" : "Crear cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={creditPaymentDialogOpen}
        onOpenChange={(open) => {
          setCreditPaymentDialogOpen(open);
          if (!open) {
            setCreditPaymentApplications({});
            setCreditPaymentAmount("");
            setCreditPaymentNotes("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl max-h-[90vh] overflow-y-auto bg-card text-foreground border border-border">
          <DialogHeader>
            <DialogTitle>Registrar cobro de cuenta corriente</DialogTitle>
            <DialogDescription>
              Podés cobrar por importe global (imputación automática por vencimiento/antigüedad) o por selección manual de remitos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleApplyCreditPayment} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment-mode">Modo de aplicación</Label>
                <select
                  id="payment-mode"
                  value={creditPaymentMode}
                  onChange={(event) => setCreditPaymentMode(event.target.value as CreditPaymentMode)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="auto">Por importe (automático)</option>
                  <option value="by_documents">Por remitos</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-method">Método</Label>
                <select
                  id="payment-method"
                  value={creditPaymentMethod}
                  onChange={(event) => setCreditPaymentMethod(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-amount">Importe</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={creditPaymentMode === "auto" ? creditPaymentAmount : String(selectedApplicationsTotal || "")}
                  onChange={(event) => setCreditPaymentAmount(event.target.value)}
                  disabled={creditPaymentMode !== "auto"}
                />
                {creditPaymentMode === "by_documents" && (
                  <p className="text-xs text-muted-foreground">El importe se calcula automáticamente con los remitos seleccionados.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notas (opcional)</Label>
              <Textarea
                id="payment-notes"
                rows={3}
                value={creditPaymentNotes}
                onChange={(event) => setCreditPaymentNotes(event.target.value)}
                placeholder="Ej: Cobro parcial acordado con el cliente"
              />
            </div>

            {creditPaymentMode === "by_documents" && (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Imputación por remitos</h3>
                  <p className="text-xs text-muted-foreground">Ingresá monto por cada remito. Si un remito no se cobra en este pago, dejalo en 0.</p>
                </div>

                {openCreditDocuments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No hay remitos pendientes para este cliente.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {openCreditDocuments.map((document) => {
                      const currentValue = creditPaymentApplications[document.id] || "";
                      return (
                        <div key={document.id} className="rounded-lg border border-border p-3 grid grid-cols-1 md:grid-cols-4 gap-3 md:items-center">
                          <div className="md:col-span-2">
                            <p className="font-medium text-foreground">Remito {document.orderRemitoNumber || document.orderId}</p>
                            <p className="text-xs text-muted-foreground">Saldo pendiente: {formatCurrency(document.balance)}</p>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Estado: {getDocumentStatusLabel(document.status)}
                          </div>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            max={Number(document.balance || 0)}
                            value={currentValue}
                            onChange={(event) => handleCreditApplicationAmountChange(document.id, event.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreditPaymentDialogOpen(false)} disabled={creditPaymentSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creditPaymentSubmitting || !selectedCustomer}>
                {creditPaymentSubmitting ? "Registrando..." : "Registrar cobro"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={creditAdjustmentDialogOpen}
        onOpenChange={(open) => {
          setCreditAdjustmentDialogOpen(open);
          if (!open) {
            setSelectedAdjustmentDocument(null);
            setCreditAdjustmentForm({
              creditDocumentId: "",
              type: "credit_note",
              amount: "",
              reason: "",
            });
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto bg-card text-foreground border border-border">
          <DialogHeader>
            <DialogTitle>
              {creditAdjustmentForm.type === "credit_note" ? "Registrar nota de crédito" : "Registrar nota de débito"}
            </DialogTitle>
            <DialogDescription>
              Ajustá el comprobante seleccionado sin salir de la cuenta corriente del cliente. El movimiento quedará auditado en la sucursal activa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleApplyCreditAdjustment} className="space-y-5">
            <div className="rounded-xl border border-border p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">
                Comprobante: Remito {selectedAdjustmentDocument?.orderRemitoNumber || selectedAdjustmentDocument?.orderId || "—"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-muted-foreground">Monto actual</p>
                  <p className="font-semibold text-foreground">{formatCurrency(selectedAdjustmentDocument?.currentAmount)}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-muted-foreground">Cobrado</p>
                  <p className="font-semibold text-foreground">{formatCurrency(selectedAdjustmentDocument?.amountPaid)}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-muted-foreground">Saldo</p>
                  <p className="font-semibold text-foreground">{formatCurrency(selectedAdjustmentDocument?.balance)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adjustment-type">Tipo</Label>
                <select
                  id="adjustment-type"
                  value={creditAdjustmentForm.type}
                  onChange={(event) => setCreditAdjustmentForm((current) => ({
                    ...current,
                    type: event.target.value as CreditAdjustmentType,
                  }))}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="credit_note">Nota de crédito</option>
                  <option value="debit_note">Nota de débito</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustment-amount">Importe</Label>
                <Input
                  id="adjustment-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={creditAdjustmentForm.amount}
                  onChange={(event) => setCreditAdjustmentForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))}
                />
                {creditAdjustmentForm.type === "credit_note" && (
                  <p className="text-xs text-muted-foreground">
                    Máximo ajustable sin saldo a favor: {formatCurrency(adjustmentMaxAmount)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-reason">Motivo</Label>
              <Textarea
                id="adjustment-reason"
                rows={4}
                value={creditAdjustmentForm.reason}
                onChange={(event) => setCreditAdjustmentForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))}
                placeholder="Ej: Bonificación comercial, corrección administrativa, diferencia detectada en remito..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreditAdjustmentDialogOpen(false)} disabled={creditAdjustmentSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creditAdjustmentSubmitting || !selectedCustomer}>
                {creditAdjustmentSubmitting
                  ? "Guardando..."
                  : creditAdjustmentForm.type === "credit_note"
                    ? "Registrar nota de crédito"
                    : "Registrar nota de débito"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailDialogOpen}
        onOpenChange={(open) => {
          setDetailDialogOpen(open);
          if (!open) {
            setSelectedOrderDetail(null);
            setDetailError("");
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl max-h-[90vh] overflow-y-auto bg-card text-foreground border border-border">
          <DialogHeader>
            <DialogTitle>Detalle del remito</DialogTitle>
            <DialogDescription>
              Vista rápida del pedido asociado al comprobante de cuenta corriente seleccionado.
            </DialogDescription>
          </DialogHeader>

          {detailError && (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{detailError}</AlertDescription>
            </Alert>
          )}

          {detailLoading ? (
            <p className="text-sm text-muted-foreground">Cargando detalle del remito...</p>
          ) : selectedOrderDetail ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Remito</p>
                  <p className="font-semibold text-foreground">{selectedOrderDetail.remitoNumber || selectedOrderDetail.id}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <p className="font-semibold text-foreground">{selectedOrderDetail.status || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Pago</p>
                  <p className="font-semibold text-foreground">{selectedOrderDetail.paymentStatus || "—"}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm text-muted-foreground">Entrega</p>
                  <p className="font-semibold text-foreground">{selectedOrderDetail.fulfillmentStatus || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Cliente y operación</p>
                  <p className="text-sm text-foreground">Cliente: {selectedOrderDetail.customer?.fullName || "—"}</p>
                  <p className="text-sm text-foreground">Contacto: {selectedOrderDetail.customer?.phone || selectedOrderDetail.customer?.email || selectedOrderDetail.customer?.document || "—"}</p>
                  <p className="text-sm text-foreground">Sucursal: {selectedOrderDetail.branch?.name || "—"}</p>
                  <p className="text-sm text-foreground">Vendedor: {[selectedOrderDetail.user?.firstname, selectedOrderDetail.user?.lastname].filter(Boolean).join(" ") || "—"}</p>
                  <p className="text-sm text-foreground">Fecha: {formatDate(selectedOrderDetail.createdAt)}</p>
                </div>
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Montos</p>
                  <p className="text-sm text-foreground">Total pedido: {formatCurrency(selectedOrderDetail.total)}</p>
                  <p className="text-sm text-foreground">Total aprobado: {formatCurrency(selectedOrderDetail.approvedTotal)}</p>
                  <p className="text-sm text-foreground">Total entregado: {formatCurrency(selectedOrderDetail.deliveredTotal)}</p>
                  <p className="text-sm text-foreground">Cobrado: {formatCurrency(selectedOrderDetail.amountPaid)}</p>
                  <p className="text-sm text-foreground">Saldo pendiente: {formatCurrency(Math.max(Number(selectedOrderDetail.approvedTotal || selectedOrderDetail.total || 0) - Number(selectedOrderDetail.amountPaid || 0), 0))}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Ítems del remito</h3>
                    <p className="text-sm text-muted-foreground">Detalle actual del pedido, con cantidades aprobadas y entregadas.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleViewRemitoPdf(selectedOrderDetail.id, selectedOrderDetail.remitoNumber)}
                    disabled={pdfLoadingOrderId === selectedOrderDetail.id}
                  >
                    {pdfLoadingOrderId === selectedOrderDetail.id ? "Abriendo PDF..." : "Abrir PDF del remito"}
                  </Button>
                </div>

                {!selectedOrderDetail.items?.length ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Este remito no tiene ítems para mostrar.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedOrderDetail.items.map((item) => (
                      <div key={item.id} className="rounded-xl border border-border p-4">
                        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                          <div className="space-y-1">
                            <p className="font-semibold text-foreground">{item.variant?.name || "Producto"}</p>
                            <p className="text-sm text-muted-foreground">SKU: {item.variant?.sku || "—"}</p>
                            {item.notes && (
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-3 min-w-full xl:min-w-[320px]">
                            <div className="rounded-lg bg-muted/30 p-3 text-sm">
                              <p className="text-muted-foreground">Aprobado</p>
                              <p className="font-semibold text-foreground">{Number(item.approvedQuantity || 0)}</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3 text-sm">
                              <p className="text-muted-foreground">Entregado</p>
                              <p className="font-semibold text-foreground">{Number(item.deliveredQuantity || 0)}</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3 text-sm">
                              <p className="text-muted-foreground">Precio unitario</p>
                              <p className="font-semibold text-foreground">{formatCurrency(item.price)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedOrderDetail.notes && (
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Observaciones</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedOrderDetail.notes}</p>
                </div>
              )}
            </div>
          ) : !detailError ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Seleccioná un comprobante para ver el detalle del remito.
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md bg-card text-foreground border border-border">
          <DialogHeader>
            <DialogTitle>Eliminar cliente</DialogTitle>
            <DialogDescription>
              Esta acción realiza la baja lógica del cliente manteniendo la trazabilidad histórica.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-foreground">
            ¿Querés dar de baja a <span className="font-semibold">{customerToDelete?.fullName}</span>?
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

