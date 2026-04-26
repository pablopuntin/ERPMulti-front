"use client";

import { Clock, ShoppingCart, Package, DollarSign, AlertTriangle } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "sale" | "stock" | "payment" | "alert";
  title: string;
  description: string;
  time: string;
  amount?: string;
}

interface RecentActivityProps {
  activities?: ActivityItem[];
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  const activityList = activities || [];

  const getIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "sale":
        return ShoppingCart;
      case "stock":
        return Package;
      case "payment":
        return DollarSign;
      case "alert":
        return AlertTriangle;
      default:
        return Clock;
    }
  };

  const getIconColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "sale":
        return "text-green-600 bg-green-100";
      case "stock":
        return "text-orange-600 bg-orange-100";
      case "payment":
        return "text-blue-600 bg-blue-100";
      case "alert":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Actividad Reciente
        </h3>
        <Clock className="w-5 h-5 text-muted-foreground" />
      </div>
      
      <div className="space-y-4">
        {activityList.map((activity) => {
          const Icon = getIcon(activity.type);
          const iconColor = getIconColor(activity.type);
          
          return (
            <div
              key={activity.id}
              className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className={`p-2 rounded-lg ${iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground truncate">
                    {activity.title}
                  </p>
                  {activity.amount && (
                    <span className="text-sm font-semibold text-foreground">
                      {activity.amount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {activity.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activity.time}
                </p>
              </div>
            </div>
          );
        })}

        {activityList.length === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No hay actividad reciente para mostrar.
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-border">
        <button className="text-sm text-primary hover:text-primary/80 font-medium">
          Ver toda la actividad →
        </button>
      </div>
    </div>
  );
}
