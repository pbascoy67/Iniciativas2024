export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ width: "30%", height: "1.6rem" }} />
      <div className="skeleton" /><div className="skeleton" style={{ width: "80%" }} /><div className="skeleton" style={{ width: "60%" }} />
    </div>
  );
}
