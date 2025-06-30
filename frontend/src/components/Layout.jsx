import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div>
      <header>This is the layout header</header>
      <main>
        <Outlet /> {/* This is where Home or Dashboard gets injected */}
      </main>
      <footer>This is the layout footer</footer>
    </div>
  );
}
