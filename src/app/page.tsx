"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { authAPI } from "@/services/api";

export default function Home() {
  const router = useRouter();
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
      // Intentar login real con API
      const response = await authAPI.login({ email, password });
      
      console.log("Login response:", response);
      
      // Guardar token en localStorage y cookies
      if (response.access_token) {
        localStorage.setItem("token", response.access_token);
        
        // También guardar en cookies como respaldo
        document.cookie = `access_token=${response.access_token}; path=/; max-age=3600; SameSite=Lax`;
        document.cookie = `token=${response.access_token}; path=/; max-age=3600; SameSite=Lax`;
        
        console.log("Token guardado en localStorage:", response.access_token);
        console.log("Token guardado en cookies:", response.access_token);
      }
      
      if (response.user) {
        localStorage.setItem("user", JSON.stringify(response.user));
        console.log("Usuario guardado:", response.user);
      }
      
      // Redirigir al dashboard
      router.push(response.user?.role === "vendedor" ? "/dashboard/sales" : "/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      
      // Si falla la API, hacer login fake para desarrollo
      if (err.code === "ERR_NETWORK" || err.code === "ECONNREFUSED") {
        console.log("Backend no disponible, usando login fake...");
        setTimeout(() => {
          router.push("/dashboard");
        }, 800);
      } else {
        setError(err.response?.data?.message || "Error al iniciar sesión");
      }
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
          Sistema de gestión • Electrotec
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
          <p>Email: superadmin@example.com</p>
          <p>Password: SuperSecurePassword123!</p>
          <p className="mt-2">Backend: {process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}</p>
        </div>
      </div>
    </div>
  );
}
