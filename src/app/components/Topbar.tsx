//responsive
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Menu, UserRound } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";

interface BranchOption {
  id: string;
  name: string;
}

export default function Topbar({ onSidebarToggle }: { onSidebarToggle: () => void }) {
  const router = useRouter();
  const { user, logout, switchBranch, canAccessAllBranches } = useAuth();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [switchingBranch, setSwitchingBranch] = useState(false);
  const activeBranchId = user?.activeBranchId || user?.branchId || "";
  const roleLabel = useMemo(() => {
    switch (user?.role) {
      case "root":
        return "Root";
      case "gerente_general":
        return "Gerente general";
      case "gerente_sucursal":
        return "Gerente de sucursal";
      case "cajero":
        return "Cajero";
      case "vendedor":
        return "Vendedor";
      default:
        return "Usuario";
    }
  }, [user?.role]);
  const userDisplayName = useMemo(() => user?.name || user?.email || "Usuario", [user?.name, user?.email]);
  const activeBranchName = useMemo(() => {
    if (!activeBranchId) {
      return canAccessAllBranches() ? "Seleccioná una sucursal" : "Sin sucursal activa";
    }

    return branches.find((branch) => branch.id === activeBranchId)?.name || activeBranchId;
  }, [branches, activeBranchId, canAccessAllBranches]);

  const shouldShowBranchSelector = useMemo(() => {
    if (canAccessAllBranches()) {
      return true;
    }

    return (user?.allowedBranchIds?.length || 0) > 1;
  }, [canAccessAllBranches, user?.allowedBranchIds]);

  useEffect(() => {
    const loadBranches = async () => {
      if (!user?.token || (!shouldShowBranchSelector && !activeBranchId)) {
        setBranches([]);
        return;
      }

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/branches`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        if (!response.ok) {
          setBranches([]);
          return;
        }

        const data = await response.json();
        const normalized = (Array.isArray(data) ? data : []).map((branch: any) => ({
          id: branch.id,
          name: branch.name || branch.id,
        }));

        const filtered = canAccessAllBranches() || shouldShowBranchSelector
          ? normalized.filter((branch: BranchOption) => {
              if (canAccessAllBranches()) {
                return true;
              }

              const allowedBranchIds = user?.allowedBranchIds || [];
              return branch.id === activeBranchId || allowedBranchIds.includes(branch.id);
            })
          : normalized.filter((branch: BranchOption) => branch.id === activeBranchId);

        setBranches(filtered);
      } catch {
        setBranches([]);
      }
    };

    loadBranches();
  }, [user?.token, user?.allowedBranchIds, activeBranchId, shouldShowBranchSelector, canAccessAllBranches]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleBranchChange = async (branchId: string) => {
    if (!branchId || branchId === activeBranchId) {
      return;
    }

    try {
      setSwitchingBranch(true);
      await switchBranch(branchId);
      router.refresh();
    } finally {
      setSwitchingBranch(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 md:min-h-16 md:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          className="rounded-md p-2 transition-colors hover:bg-muted"
          onClick={onSidebarToggle}
          aria-label="Toggle sidebar"
        >
          <Menu />
        </button>

        <div className="min-w-0">
          <h1 className="text-base font-semibold md:text-lg">Dashboard</h1>
          <p className="hidden text-xs text-muted-foreground lg:block">
            La sucursal activa definida aquí aplica al resto de las pantallas operativas.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-center md:gap-3">
        <div className="hidden items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground shadow-sm lg:flex">
          <div className="flex items-center gap-2 min-w-0">
            <UserRound className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <div className="font-medium leading-none truncate max-w-[220px]">{userDisplayName}</div>
              <div className="text-xs text-muted-foreground mt-1">{roleLabel}</div>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2 min-w-0 rounded-lg bg-background px-3 py-2">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-none">Sucursal activa</div>
              <div className="mt-1 truncate max-w-[220px] font-semibold text-foreground">{activeBranchName}</div>
            </div>
          </div>
        </div>

        {shouldShowBranchSelector && branches.length > 0 && (
          <select
            value={activeBranchId || ""}
            onChange={(e) => handleBranchChange(e.target.value)}
            disabled={switchingBranch}
            className="h-9 max-w-[220px] rounded-lg border border-border bg-background px-3 py-1 text-sm font-medium text-foreground shadow-sm"
            aria-label="Seleccionar sucursal activa"
          >
            {!activeBranchId && <option value="">Seleccionar sucursal</option>}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        )}

        <Button variant="outline" onClick={handleLogout} className="h-9 px-3">
          <LogOut className="w-4 h-4 mr-2" />
          Salir
        </Button>
      </div>
    </header>
  );
}
