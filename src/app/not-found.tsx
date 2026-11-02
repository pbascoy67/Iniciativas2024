import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card" style={{ margin: "4rem auto", maxWidth: 480 }}>
      <h1>Not found</h1>
      <p className="muted">That record doesn&apos;t exist, or it was deleted or merged into another one.</p>
      <Link prefetch={false} href="/">Back to the agenda</Link>
    </div>
  );
}
