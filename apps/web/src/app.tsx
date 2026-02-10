import type { JSX } from "react";
import { Route, Routes } from "react-router";

function Home(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-warm-white">
      <div className="text-center">
        <h1 className="font-display font-semibold text-4xl text-charcoal">Hearth</h1>
        <p className="mt-2 font-body text-warm-gray">The place people gather.</p>
      </div>
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
