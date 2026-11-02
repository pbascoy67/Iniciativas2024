import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card" style={{ margin: "4rem auto", maxWidth: 480 }}>
      <h1>No encontrado</h1>
      <p className="muted">Ese registro no existe, o fue eliminado o fusionado con otro.</p>
      <Link prefetch={false} href="/">Volver a la agenda</Link>
    </div>
  );
}
