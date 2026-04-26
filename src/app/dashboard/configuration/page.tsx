"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { branchesAPI } from "@/services/api";

interface BranchSettingsItem {
  id: string;
  name: string;
  restrictSalesToBranchStock: boolean;
}

export default function ConfigurationPage() {
  const { user, loading } = useAuth();
  const canAccess = user?.role === "root" || user?.role === "gerente_general";
  const [branches, setBranches] = useState<BranchSettingsItem[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedBranches = useMemo(
    () => [...branches].sort((a, b) => a.name.localeCompare(b.name)),
    [branches]
  );

  useEffect(() => {
    if (!canAccess) {
      setLoadingBranches(false);
      return;
    }

    const loadBranchSettings = async () => {
      setLoadingBranches(true);
      setError(null);

      try {
        const branchList = await branchesAPI.getAll();
        const normalizedBranches = Array.isArray(branchList)
          ? branchList.map((branch: any) => ({
              id: branch.id,
              name: branch.name || branch.id,
              restrictSalesToBranchStock: Boolean(branch.restrictSalesToBranchStock),
            }))
          : [];

        const settingsResults = await Promise.all(
          normalizedBranches.map(async (branch: BranchSettingsItem) => {
            try {
              const settings = await branchesAPI.getSalesSettings(branch.id);
              return {
                ...branch,
                restrictSalesToBranchStock: Boolean(settings?.restrictSalesToBranchStock),
              };
            } catch {
              return branch;
            }
          })
        );

        setBranches(settingsResults);
      } catch (loadError: any) {
        setError(
          loadError?.response?.data?.message ||
            loadError?.message ||
            "No se pudo cargar la configuración de ventas por sucursal."
        );
      } finally {
        setLoadingBranches(false);
      }
    };

    loadBranchSettings();
  }, [canAccess]);

  const handleToggle = async (branch: BranchSettingsItem) => {
    const nextValue = !branch.restrictSalesToBranchStock;

    setSavingBranchId(branch.id);
    setError(null);
    setMessage(null);

    try {
      const updated = await branchesAPI.updateSalesSettings(branch.id, {
        restrictSalesToBranchStock: nextValue,
      });

      setBranches((current) =>
        current.map((item) =>
          item.id === branch.id
            ? {
                ...item,
                restrictSalesToBranchStock: Boolean(updated?.restrictSalesToBranchStock),
              }
            : item
        )
      );

      setMessage(
        `La sucursal ${branch.name} ${nextValue ? "ahora" : "ya no"} restringe las ventas al stock local.`
      );
    } catch (saveError: any) {
      setError(
        saveError?.response?.data?.message ||
          saveError?.message ||
          `No se pudo actualizar la sucursal ${branch.name}.`
      );
    } finally {
      setSavingBranchId(null);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 py-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Cargando configuración...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="w-full px-4 py-6">
        <Alert variant="destructive">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Acceso restringido</AlertTitle>
          <AlertDescription>
            Esta pantalla queda reservada para root y gerente general.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Ajustes sensibles reservados para root y gerente general.
        </p>
      </div>

      {message && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Configuración actualizada</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>No se pudo completar la acción</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ventas por stock local</CardTitle>
          <CardDescription>
            Cuando esta regla está activa, la sucursal solo puede generar remitos por el stock disponible en su propia ubicación operativa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingBranches ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando sucursales...
            </div>
          ) : sortedBranches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay sucursales disponibles para configurar.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedBranches.map((branch) => {
                const isSaving = savingBranchId === branch.id;
                return (
                  <div
                    key={branch.id}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">{branch.name}</div>
                      <p className="text-sm text-muted-foreground">
                        {branch.restrictSalesToBranchStock
                          ? "Modo estricto activo: solo se puede vender stock disponible local."
                          : "Modo flexible activo: se mantiene el flujo actual con revisión posterior en caja."}
                      </p>
                    </div>

                    <Button
                      variant={branch.restrictSalesToBranchStock ? "destructive" : "default"}
                      onClick={() => handleToggle(branch)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : branch.restrictSalesToBranchStock ? (
                        "Deshabilitar"
                      ) : (
                        "Habilitar"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
