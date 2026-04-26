"use client";

import { useRouter } from "next/navigation";
import { Plus, ShoppingCart, FileText, Settings, Download, Users } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: any;
  href: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    id: "1",
    title: "Nuevo Producto",
    description: "Agregar producto al inventario",
    icon: Plus,
    href: "/dashboard/products/new",
    color: "bg-blue-600 hover:bg-blue-700"
  },
  {
    id: "2",
    title: "Nueva Venta",
    description: "Registrar venta manual",
    icon: ShoppingCart,
    href: "/dashboard/sales",
    color: "bg-green-600 hover:bg-green-700"
  },
  {
    id: "3",
    title: "Generar Reporte",
    description: "Exportar datos de ventas",
    icon: FileText,
    href: "/dashboard/reports",
    color: "bg-purple-600 hover:bg-purple-700"
  },
  {
    id: "4",
    title: "Gastos",
    description: "Registrar nuevo gasto",
    icon: Download,
    href: "/dashboard/expenses/new",
    color: "bg-orange-600 hover:bg-orange-700"
  },
  {
    id: "5",
    title: "Clientes",
    description: "Gestionar clientes",
    icon: Users,
    href: "/dashboard/customers",
    color: "bg-indigo-600 hover:bg-indigo-700"
  },
  {
    id: "6",
    title: "Configuración",
    description: "Ajustes del sistema",
    icon: Settings,
    href: "/dashboard/settings",
    color: "bg-gray-600 hover:bg-gray-700"
  }
];

export default function QuickActions() {
  const router = useRouter();

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Acciones Rápidas
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          
          return (
            <Button
              key={action.id}
              variant="outline"
              className={`h-auto p-4 flex flex-col items-center text-left space-y-2 border-border hover:shadow-md transition-all duration-200 ${action.color} text-white border-0`}
              onClick={() => router.push(action.href)}
            >
              <Icon className="w-6 h-6" />
              <div className="text-center">
                <p className="font-medium text-sm">{action.title}</p>
                <p className="text-xs opacity-90 mt-1">{action.description}</p>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
