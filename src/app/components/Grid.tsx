export default function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4">
      {children}
    </div>
  );
}
