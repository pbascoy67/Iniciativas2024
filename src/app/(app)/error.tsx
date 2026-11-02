"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card" role="alert">
      <h1>Algo salió mal</h1>
      <p className="muted">No se pudo cargar la página. Normalmente significa que la base de datos aún está iniciando o no es accesible. Tus datos no se ven afectados.</p>
      <button type="button" className="primary" onClick={reset}>Intentar de nuevo</button>
    </div>
  );
}
