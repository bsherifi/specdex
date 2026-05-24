import type { JSX } from "react";

export function App(): JSX.Element {
  return (
    <main
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>Specdex shell ready</h1>
    </main>
  );
}
