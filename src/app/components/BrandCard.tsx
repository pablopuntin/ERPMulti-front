'use client';

import { useRouter } from 'next/navigation';

export default function BrandCard({ brand, categoryId }: any) {
  const router = useRouter();

  return (
    <div
      className="rounded-xl shadow bg-white p-3 cursor-pointer hover:bg-gray-100"
      onClick={() =>
        router.push(`/categories/${categoryId}/brands/${brand.id}`)
      }
    >
      <img
        src={brand.imgURL}
        alt={brand.name}
        className="w-full h-24 object-contain"
      />
      <h3 className="text-center text-md font-semibold mt-2">{brand.name}</h3>
    </div>
  );
}
