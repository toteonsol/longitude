import type { AppMeta } from "../apps";

/** Shown when an app has no snapshot yet. Tells the builder exactly what to run. */
export function Missing({ app }: { app: AppMeta }) {
  return (
    <div className="lg-missing">
      <h2>Nothing seeded yet</h2>
      <p>
        {app.name} reads a snapshot written by its seed script. Add <code>NANSEN_API_KEY</code> to <code>.env</code> and run:
      </p>
      <pre>pnpm --filter @longitude/{app.id} seed</pre>
      <p>Or press “Refresh live” to fetch straight from Nansen.</p>
    </div>
  );
}
