'use client';

import { useRouter } from 'next/navigation';

export default function CategoryCard({ category }: any) {
  const router = useRouter();

  return (
    <div
      className="rounded-xl shadow p-4 bg-white cursor-pointer hover:bg-gray-100"
      onClick={() =>router.push(`/categories/${category.id}`)
}
    >
      <h3 className="text-lg font-semibold">{category.name}</h3>
      <p className="text-sm text-gray-600">{category.description}</p>
    </div>
  );
}
