"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/app/components/ui/alert";

export default function PaymentsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/cash");
  }, [router]);

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <Alert>
        <AlertDescription>Pagos fue integrado dentro de Caja. Redirigiendo...</AlertDescription>
      </Alert>
    </div>
  );
}
