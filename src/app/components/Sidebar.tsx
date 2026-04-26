//responsive
"use client";

import { SidebarItem } from "./SidebarItem";
import { useAuth } from "@/components/auth/AuthContext";
import {
  Menu,
  Folder,
  Home,
  Box,
  Settings,
  ArrowRightLeft,
  ShoppingCart,
  Wallet,
  Receipt,
  BarChart,
  Users,
} from "lucide-react";

export default function Sidebar({
  open,
  onClose,
  compactDesktop = false,
}: {
  open: boolean;
  onClose: () => void;
  compactDesktop?: boolean;
}) {
  const { user, canManageUsersPanel, isSellerOnly, isCashier } = useAuth();
  const sellerOnly = isSellerOnly();
  const cashier = isCashier();
  const canAccessSettings = user?.role === "root" || user?.role === "gerente_general";

  return (
    <>
      {/* Sidebar panel */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 bg-sidebar border-r border-border shadow-sm flex flex-col transition-transform duration-300
          w-64 md:${compactDesktop ? 'w-20' : 'w-64'}
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Top section */}
        <div className={`flex min-h-14 items-center justify-between border-b border-border px-4 py-3 md:min-h-16 ${compactDesktop ? 'md:justify-center' : ''}`}>
          <h2 className={`text-lg font-semibold text-text ${compactDesktop ? 'md:hidden' : ''}`}>Panel</h2>
          {/* Close button only on mobile */}
          <button className="rounded-md p-2 transition-colors hover:bg-muted" onClick={onClose} aria-label="Cerrar sidebar">
            <Menu className="text-icon" />
          </button>
        </div>

        {/* Items */}
        <nav className="flex flex-col gap-2 px-2 pb-3 pt-4">
          {sellerOnly ? (
            <SidebarItem href="/dashboard/sales" icon={ShoppingCart} label="Ventas" open={!compactDesktop} />
          ) : cashier ? (
            <>
              <SidebarItem href="/dashboard/categories" icon={Folder} label="Clientes" open={!compactDesktop} />
              <SidebarItem href="/dashboard" icon={Home} label="Inicio" open={!compactDesktop} />
              <SidebarItem href="/dashboard/stock" icon={ArrowRightLeft} label="Transferencias" open={!compactDesktop} />
              <SidebarItem href="/dashboard/sales" icon={ShoppingCart} label="Ventas" open={!compactDesktop} />
              <SidebarItem href="/dashboard/cash" icon={Wallet} label="Caja" open={!compactDesktop} />
            </>
          ) : (
            <>
              <SidebarItem href="/dashboard/categories" icon={Folder} label="Clientes" open={!compactDesktop} />
              <SidebarItem href="/dashboard" icon={Home} label="Inicio" open={!compactDesktop} />
              <SidebarItem href="/dashboard/products" icon={Box} label="Productos" open={!compactDesktop} />
              <SidebarItem href="/dashboard/stock" icon={ArrowRightLeft} label="Transferencias" open={!compactDesktop} />
              <SidebarItem href="/dashboard/sales" icon={ShoppingCart} label="Ventas" open={!compactDesktop} />
              <SidebarItem href="/dashboard/cash" icon={Wallet} label="Caja" open={!compactDesktop} />
              <SidebarItem href="/dashboard/expenses" icon={Receipt} label="Gastos" open={!compactDesktop} />
              <SidebarItem href="/dashboard/reports" icon={BarChart} label="Reportes" open={!compactDesktop} />
              {canManageUsersPanel() && (
                <SidebarItem href="/dashboard/users" icon={Users} label="Usuarios" open={!compactDesktop} />
              )}
              {canAccessSettings && (
                <SidebarItem href="/dashboard/configuration" icon={Settings} label="Configuración" open={!compactDesktop} />
              )}
            </>
          )}
        </nav>
      </div>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}

