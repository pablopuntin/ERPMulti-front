import Grid from "../../components/Grid";
import BrandCard from "../../components/BrandCard";

export default async function CategoryBrandsPage({ params }: any) {
  const categoryId = params?.categoryId;

  if (!categoryId) {
    return <div>No se especificó el ID de la categoría.</div>;
  }

  const res = await fetch(
   `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/categories/${categoryId}/brands`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return <div>Error cargando las marcas para la categoría {categoryId}</div>;
  }

  const brands = await res.json();

  // return (
  //   <div>
  //     <h1 className="text-xl font-bold p-4">Marcas</h1>
  //     <Grid>
  //       {brands.map((brand: any) => (
  //         <BrandCard key={brand.id} brand={brand} categoryId={categoryId} />
  //       ))}
  //     </Grid>
  //   </div>
  // );

  //refactor
  return (
    <div className="p-4">
      <h1>Brand page</h1>
      <p>Brand ID: {params.brandId}</p>
      <p>Category ID: {params.categoryId}</p>
    </div>
  );
  
}
