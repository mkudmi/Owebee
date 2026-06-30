import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="app-shell">
      <section className="intro">
        <p className="eyebrow">Owebee</p>
        <h1>Trip expenses without spreadsheet archaeology.</h1>
        <p>
          The product foundation is ready for trips, guests, families, currencies,
          and offline-friendly expense tracking.
        </p>
      </section>
    </main>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

