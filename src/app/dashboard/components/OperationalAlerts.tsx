"use client";

import { AlertTriangle, ArrowRight, Package, Truck } from "lucide-react";

interface OperationalAlertItem {
  id: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  count?: number;
}

interface OperationalAlertsProps {
  alerts?: OperationalAlertItem[];
}

export default function OperationalAlerts({ alerts }: OperationalAlertsProps) {
  const alertList = alerts || [];

  const getSeverityClasses = (severity: OperationalAlertItem["severity"]) => {
    switch (severity) {
      case "high":
        return {
          container: "border-red-200 bg-red-50/60",
          icon: "text-red-700 bg-red-100",
          badge: "text-red-700 bg-red-100 border-red-200",
        };
      case "medium":
        return {
          container: "border-amber-200 bg-amber-50/60",
          icon: "text-amber-700 bg-amber-100",
          badge: "text-amber-700 bg-amber-100 border-amber-200",
        };
      default:
        return {
          container: "border-blue-200 bg-blue-50/60",
          icon: "text-blue-700 bg-blue-100",
          badge: "text-blue-700 bg-blue-100 border-blue-200",
        };
    }
  };

  const getIcon = (title: string) => {
    if (title.toLowerCase().includes("stock")) {
      return Package;
    }

    if (title.toLowerCase().includes("entrega") || title.toLowerCase().includes("remito")) {
      return Truck;
    }

    return AlertTriangle;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Alertas operativas</h3>
          <p className="text-sm text-muted-foreground mt-1">Resumen rápido de lo que requiere atención ahora.</p>
        </div>
        <AlertTriangle className="w-5 h-5 text-muted-foreground" />
      </div>

      <div className="space-y-3">
        {alertList.map((alert) => {
          const Icon = getIcon(alert.title);
          const severityClasses = getSeverityClasses(alert.severity);

          return (
            <div
              key={alert.id}
              className={`rounded-lg border p-4 transition-colors ${severityClasses.container}`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${severityClasses.icon}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{alert.title}</p>
                    {alert.count !== undefined && (
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${severityClasses.badge}`}>
                        {alert.count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                </div>
              </div>
            </div>
          );
        })}

        {alertList.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-6 px-4 text-sm text-muted-foreground text-center">
            No hay alertas operativas para mostrar.
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <button className="text-sm text-primary hover:text-primary/80 font-medium inline-flex items-center gap-2">
          Revisar estado operativo
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
