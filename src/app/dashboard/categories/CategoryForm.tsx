"use client";

import React, { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { categoriesService } from "@/services/categoriesServices";

export default function CategoryForm({ 
  category, 
  onClose, 
  onSaved 
}: { 
  category?: any; 
  onClose: () => void; 
  onSaved: (savedCategory?: any) => void; 
}) {
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [imgURL, setImgURL] = useState(category?.imgURL || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const body = {
      name,
      ...(description.trim() !== "" && { description: description.trim() }),
      ...(imgURL.trim() !== "" && { imgURL: imgURL.trim() }),
    };

    try {
      let result;
      if (category) {
        result = await categoriesService.update(category.id, body);
      } else {
        result = await categoriesService.create(body);
      }

      onSaved({
        ...(category || {}),
        ...(typeof result === "object" && result ? result : {}),
        ...body,
        id: (typeof result === "object" && result?.id) || category?.id,
      });
      onClose();
    } catch (err: any) {
      console.error("Error guardando categoría:", err);
      setError(err.response?.data?.message || "Error guardando la categoría");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        placeholder="Nombre de la categoría"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />

      <Textarea
        placeholder="Descripción (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      <Input
        placeholder="URL de la imagen (opcional)"
        value={imgURL}
        onChange={(e) => setImgURL(e.target.value)}
      />

      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? "Guardando..." : "Guardar"}
      </Button>
    </form>
  );
}
