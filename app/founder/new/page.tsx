import NewProduct from "@/components/NewProduct";

export const metadata = { title: "Add your product" };

export default function NewProductPage() {
  return (
    <main className="shell narrow">
      <h1 style={{ fontSize: "2rem", letterSpacing: "-.03em", marginBottom: 6 }}>Add your product</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Talk, type or upload. We turn it into a detailed showcase, and nothing goes public until you approve it.
      </p>
      <NewProduct />
    </main>
  );
}