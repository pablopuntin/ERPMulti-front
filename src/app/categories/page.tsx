"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import CategoryModal from "@/app/components/categories/CategoryModal";
import { CategoryTable } from "@/app/components/categories/CategoryTable";
import { Button } from "@/app/components/ui/button";
import { categoriesService } from "@/services/categoriesServices";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const loadCategories = async () => {
    try {
      const data = await categoriesService.getAll();
      setCategories(data || []);
    } catch (error) {
      console.error("Error cargando categorías", error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Categorías</h1>
        <Button
          onClick={() => {
            setEditingCategory(null);
            setModalOpen(true);
          }}
        >
          Nueva Categoría
        </Button>
      </div>

      {/* Aquí mostramos la tabla de categorías con enlaces */}
      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : categories.length === 0 ? (
        <p className="text-muted-foreground">No hay categorías disponibles</p>
      ) : (
        <div>
          {categories.map((cat: any) => (
            <div key={cat.id || Math.random()} className="mb-2">
              <Link
                href={`/categories/${cat.id}`}
                className="text-blue-600 underline hover:text-blue-800"
              >
                {cat.name || 'Sin nombre'}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Mantienes tu modal y tabla para administrar categorías */}
      <CategoryTable
        categories={categories}
        loading={loading}
        onEdit={(cat: any) => {
          setEditingCategory(cat);
          setModalOpen(true);
        }}
        onUpdated={loadCategories}
      />

      <CategoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        category={editingCategory}
        onSaved={loadCategories}
      />
    </div>
  );
}
