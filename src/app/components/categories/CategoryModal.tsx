"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

import CategoryForm from "./CategoryForm";

export default function CategoryModal({ 
  open, 
  onClose, 
  category, 
  onSaved 
}: { 
  open: boolean; 
  onClose: () => void; 
  category?: any; 
  onSaved: (savedCategory?: any) => void; 
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card text-foreground border border-border">
        <DialogHeader>
          <DialogTitle>
            {category ? "Editar Categoría" : "Nueva Categoría"}
          </DialogTitle>
        </DialogHeader>

        <CategoryForm
          category={category}
          onClose={onClose}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
