"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { ShieldAlert, UserPlus, Building2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { branchesAPI, usersAPI } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";

interface BranchOption {
  id: string;
  name: string;
}

type AllowedRole = "gerente_general" | "gerente_sucursal" | "vendedor" | "cajero";

const roleLabels: Record<AllowedRole, string> = {
  gerente_general: "Gerente general",
  gerente_sucursal: "Gerente de sucursal",
  vendedor: "Vendedor",
  cajero: "Cajero",
};

const roleDescriptions: Record<AllowedRole, string> = {
  gerente_general: "Puede gestionar múltiples sucursales según el alcance asignado.",
  gerente_sucursal: "Gestiona operación y personal de sucursal dentro de su alcance.",
  vendedor: "Opera ventas y productos dentro de sus sucursales asignadas.",
  cajero: "Opera caja y tareas de cobro dentro de sus sucursales asignadas.",
};

export default function UsersManagementPage() {
  const { user, loading, canManageUsersPanel, canAccessAllBranches } = useAuth();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    roleName: "cajero" as AllowedRole,
    globalBranchAccess: false,
    branchIds: [] as string[],
  });

  const creatableRoles = useMemo(() => {
    const roles = (user?.canCreateUsers || []).filter((role): role is AllowedRole =>
      ["gerente_general", "gerente_sucursal", "vendedor", "cajero"].includes(role),
    );

    return roles;
  }, [user?.canCreateUsers]);

  const visibleBranches = useMemo(() => {
    if (canAccessAllBranches()) {
      return branches;
    }

    const allowed = new Set(user?.allowedBranchIds || []);
    return branches.filter((branch) => allowed.has(branch.id));
  }, [branches, canAccessAllBranches, user?.allowedBranchIds]);

  useEffect(() => {
    if (!creatableRoles.includes(form.roleName)) {
      setForm((current) => ({
        ...current,
        roleName: creatableRoles[0] || "cajero",
      }));
    }
  }, [creatableRoles, form.roleName]);

  useEffect(() => {
    const loadBranches = async () => {
      if (!canManageUsersPanel()) {
        setBranches([]);
        setLoadingBranches(false);
        return;
      }

      try {
        setLoadingBranches(true);
        const data = await branchesAPI.getAll();
        const normalized = Array.isArray(data)
          ? data.map((branch: any) => ({ id: branch.id, name: branch.name || branch.id }))
          : [];
        setBranches(normalized);
      } catch (error: any) {
        setErrorMessage(error?.response?.data?.message || "No se pudieron cargar las sucursales.");
        setBranches([]);
      } finally {
        setLoadingBranches(false);
      }
    };

    loadBranches();
  }, [canManageUsersPanel]);

  const shouldAllowGlobalBranchAccess = useMemo(() => {
    return canAccessAllBranches() && form.roleName === "gerente_general";
  }, [canAccessAllBranches, form.roleName]);

  const handleInputChange = (field: "firstname" | "lastname" | "email" | "password" | "roleName") =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setErrorMessage("");
      setSuccessMessage("");
      setForm((current) => ({
        ...current,
        [field]: value,
        ...(field === "roleName" && value !== "gerente_general"
          ? { globalBranchAccess: false }
          : {}),
      }));
    };

  const toggleBranch = (branchId: string) => {
    setErrorMessage("");
    setSuccessMessage("");
    setForm((current) => ({
      ...current,
      branchIds: current.branchIds.includes(branchId)
        ? current.branchIds.filter((id) => id !== branchId)
        : [...current.branchIds, branchId],
    }));
  };

  const handleGlobalAccessChange = (checked: boolean) => {
    setErrorMessage("");
    setSuccessMessage("");
    setForm((current) => ({
      ...current,
      globalBranchAccess: checked,
    }));
  };

  const resetForm = () => {
    setForm({
      firstname: "",
      lastname: "",
      email: "",
      password: "",
      roleName: creatableRoles[0] || "cajero",
      globalBranchAccess: false,
      branchIds: [],
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!form.firstname || !form.lastname || !form.email || !form.password) {
      setErrorMessage("Completá nombre, apellido, email y contraseña.");
      return;
    }

    if (!form.globalBranchAccess && form.branchIds.length === 0) {
      setErrorMessage("Debés asignar al menos una sucursal.");
      return;
    }

    try {
      setSubmitting(true);
      await usersAPI.create({
        firstname: form.firstname.trim(),
        lastname: form.lastname.trim(),
        email: form.email.trim(),
        password: form.password,
        roleName: form.roleName,
        branchIds: form.branchIds,
        globalBranchAccess: shouldAllowGlobalBranchAccess ? form.globalBranchAccess : false,
      });

      setSuccessMessage("Usuario creado correctamente.");
      resetForm();
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      setErrorMessage(Array.isArray(backendMessage) ? backendMessage.join(" ") : backendMessage || "No se pudo crear el usuario.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 py-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Cargando permisos...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canManageUsersPanel()) {
    return (
      <div className="w-full px-4 py-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acceso restringido</AlertTitle>
          <AlertDescription>
            No tenés permisos para acceder al panel de usuarios.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Usuarios</h1>
          <p className="text-muted-foreground mt-1">
            Creá usuarios internos según tu nivel de autorización y alcance por sucursal.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Crear usuario
            </CardTitle>
            <CardDescription>
              Solo podés crear roles incluidos en tu alcance actual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstname">Nombre</Label>
                  <Input id="firstname" value={form.firstname} onChange={handleInputChange("firstname")} placeholder="Juan" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastname">Apellido</Label>
                  <Input id="lastname" value={form.lastname} onChange={handleInputChange("lastname")} placeholder="Pérez" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={handleInputChange("email")} placeholder="usuario@electrotec.com" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" value={form.password} onChange={handleInputChange("password")} placeholder="Ingresá una contraseña segura" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleName">Rol</Label>
                <select
                  id="roleName"
                  value={form.roleName}
                  onChange={handleInputChange("roleName")}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {creatableRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-muted-foreground">
                  {roleDescriptions[form.roleName]}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Sucursales asignadas</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Seleccioná una o más sucursales dentro de tu alcance.
                    </p>
                  </div>
                  {shouldAllowGlobalBranchAccess && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.globalBranchAccess}
                        onChange={(event) => handleGlobalAccessChange(event.target.checked)}
                      />
                      Acceso global
                    </label>
                  )}
                </div>

                {loadingBranches ? (
                  <p className="text-sm text-muted-foreground">Cargando sucursales...</p>
                ) : visibleBranches.length === 0 ? (
                  <Alert>
                    <Building2 className="h-4 w-4" />
                    <AlertTitle>Sin sucursales disponibles</AlertTitle>
                    <AlertDescription>
                      No hay sucursales activas disponibles dentro de tu alcance actual.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {visibleBranches.map((branch) => {
                      const checked = form.branchIds.includes(branch.id);
                      return (
                        <label
                          key={branch.id}
                          className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleBranch(branch.id)}
                            disabled={form.globalBranchAccess}
                            className="mt-1"
                          />
                          <div>
                            <p className="font-medium text-foreground">{branch.name}</p>
                            <p className="text-xs text-muted-foreground">{branch.id}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {errorMessage && (
                <Alert variant="destructive">
                  <AlertTitle>No se pudo crear el usuario</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}

              {successMessage && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Operación exitosa</AlertTitle>
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" disabled={submitting || loadingBranches || creatableRoles.length === 0}>
                  {submitting ? "Creando..." : "Crear usuario"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
                  Limpiar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tu alcance actual</CardTitle>
            <CardDescription>
              El panel se adapta a los permisos incluidos en tu token.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Rol actual</p>
              <p className="font-semibold text-foreground">{user?.role}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Roles que podés crear</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {creatableRoles.length > 0 ? (
                  creatableRoles.map((role) => (
                    <span key={role} className="rounded-full border px-3 py-1 text-xs font-medium">
                      {roleLabels[role]}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No tenés roles habilitados para crear.</p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Acceso a sucursales</p>
              <p className="font-semibold text-foreground">
                {canAccessAllBranches() ? "Global" : `${user?.allowedBranchIds?.length || 0} sucursal(es)`}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Regla aplicada</p>
              <p className="text-sm text-foreground">
                cajero y vendedor no ven este panel, y si intentan entrar por URL quedan bloqueados.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
