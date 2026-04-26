import React from 'react';
import { useRouter } from 'next/navigation';

// Componente que redirige al formulario con el ID de edición
interface ProductFormProps {
  editMode?: boolean;
  variantId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ProductForm: React.FC<ProductFormProps> = (props) => {
  const router = useRouter();
  
  const { editMode, variantId, onSuccess, onCancel } = props;

  console.log('🔍 DEBUG - ProductForm props completos:', props);
  console.log('🔍 DEBUG - Props desestructurados:', { editMode, variantId, onSuccess, onCancel });

  React.useEffect(() => {
    // Si estamos en modo edición, redirigir con el parámetro edit
    if (editMode && variantId) {
      console.log('🔍 DEBUG - Redirigiendo a:', `/dashboard/products/new?edit=${variantId}`);
      router.push(`/dashboard/products/new?edit=${variantId}`);
    } else {
      // Si no, redirigir al formulario normal
      console.log('🔍 DEBUG - Redirigiendo a formulario normal');
      router.push('/dashboard/products/new');
    }
  }, [router, editMode, variantId]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirigiendo al formulario...</p>
      </div>
    </div>
  );
};

export default ProductForm;
