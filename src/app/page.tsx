"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { useAuth } from "@/components/auth/AuthContext";

export default function Home() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Obtener valores del formulario
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await login(email, password);
      const storedUser = localStorage.getItem("user");
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      router.push(parsedUser?.role === "vendedor" ? "/dashboard/sales" : "/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md bg-sidebar border border-border rounded-2xl p-8 shadow-xl">

        {/* Título */}
        <h1 className="text-3xl font-bold text-center mb-2">
          Bienvenido
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6">
          Sistema de gestión 
        </p>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            name="email"
            type="email"
            placeholder="Email"
            defaultValue="superadmin@example.com"
            className="bg-input text-foreground border-border"
            required
            disabled={loading}
          />
          <Input
            name="password"
            type="password"
            placeholder="Contraseña"
            defaultValue="SuperSecurePassword123!"
            className="bg-input text-foreground border-border"
            required
            disabled={loading}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        {/* Debug Info */}
        <div className="mt-4 text-xs text-muted-foreground text-center">
          <p className="font-semibold">Credenciales por defecto:</p>
          <p>Email: GerenteGeneral@email.com</p>
          <p>Password: GerenteDemo12!</p>
          <p className="mt-2">Backend: {process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}</p>
        </div>
      </div>
    </div>
  );
}
