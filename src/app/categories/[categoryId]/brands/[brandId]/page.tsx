import React from "react";
import Link from "next/link";

async function getProductsBase(brandId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/brands/${brandId}/products-base`,
    { cache: "no-store" }
  );

  if (!res.ok) throw new Error("Error cargando productos base");
  return res.json();
}

export default async function BrandProductsPage({
  params,
}: {
  params: { categoryId: string; brandId: string };
}) {
  const productsBase = await getProductsBase(params.brandId);

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">
        Productos de esta marca
      </h1>

      {productsBase.length === 0 && (
        <p className="text-gray-500 text-sm">No hay productos base aún.</p>
      )}

      <div className="
        grid 
        grid-cols-1 
        sm:grid-cols-2 
        lg:grid-cols-3 
        gap-4
      ">
        {productsBase.map((product: any) => (
          <Link
            key={product.id}
            href={`/categories/${params.categoryId}/brands/${params.brandId}/products/${product.id}`}
            className="bg-white border rounded-xl p-3 shadow-sm hover:shadow-md transition"
          >
            <img
              src={product.imgURL || "/no-image.png"}
              alt={product.name}
              className="w-full h-32 object-cover rounded-md mb-2"
            />

            <h2 className="font-medium text-base">{product.name}</h2>
            <p className="text-sm text-gray-600 line-clamp-2">
              {product.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
