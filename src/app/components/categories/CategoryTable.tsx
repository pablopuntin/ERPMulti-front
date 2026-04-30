"use client";

import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { categoriesService } from "@/services/categoriesServices";

export function CategoryTable({ 
  categories, 
  loading, 
  onEdit, 
  onUpdated 
}: { 
  categories: any[]; 
  loading: boolean; 
  onEdit: (category: any) => void; 
  onUpdated: () => void; 
}) {
  if (loading) return <p className="text-muted-foreground">Cargando...</p>;

  const deleteCategory = async (id: string) => {
    if (!confirm("¿Eliminar categoría?")) return;

    await categoriesService.delete(id);
    onUpdated();
  };

  const updateCategory = async (id: string, data: any) => {
    await categoriesService.update(id, data);
    onUpdated();
  };

  return (
    <div className="w-full">

      {/* === MOBILE VERSION (cards) === */}
      <div className="space-y-4 sm:hidden">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-card border border-border rounded-xl p-4 shadow-sm"
          >
            <p className="font-semibold text-lg">
              <Link href={`/categories/${cat.id}`}>
                {cat.name}
              </Link>
            </p>

            <p className="text-sm text-muted-foreground mt-1">
              {cat.description || "Sin descripción"}
            </p>

            <div className="flex flex-col gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => onEdit(cat)}
                className="w-full"
              >
                Editar
              </Button>

              <Button
                variant="destructive"
                className="w-full"
                onClick={() => deleteCategory(cat.id)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* === DESKTOP VERSION (tabla) === */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full bg-card border border-border rounded-lg">
          <thead className="bg-secondary/50">
            <tr>
              <th className="p-3 text-left">Categoría</th>
              <th className="p-3 text-left">Descripción</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {categories.map((cat) => (
              <tr
                key={cat.id}
                className="border-t border-border hover:bg-muted/20"
              >
                <td className="p-3 font-medium">
                  <Link href={`/categories/${cat.id}`}>
                    {cat.name}
                  </Link>
                </td>

                <td className="p-3 text-muted-foreground max-w-[350px] truncate">
                  {cat.description || "—"}
                </td>

                <td className="p-3">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => onEdit(cat)}
                    >
                      Editar
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={() => deleteCategory(cat.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
