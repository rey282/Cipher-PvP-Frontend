import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import Landing from "./components/Landing";
import Footer from "./components/Footer";
import { Link } from "react-router-dom";

const HsrHome = lazy(() => import("./components/HsrHome"));
const CharacterStats = lazy(() => import("./components/CharacterStats"));
const PlayerStats = lazy(() => import("./components/PlayerStats"));
const PlayerProfile = lazy(() => import("./components/PlayerProfile"));
const TermsOfService = lazy(() => import("./components/TermsOfService"));
const AdminPage = lazy(() => import("./components/AdminPage"));
const BalancePage = lazy(() => import("./components/BalancePage"));

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/hsr"
          element={
            <Suspense fallback={<Loading />}>
              <HsrHome />
            </Suspense>
          }
        />
        <Route
          path="/characters"
          element={
            <Suspense fallback={<Loading />}>
              <CharacterStats />
            </Suspense>
          }
        />
        <Route
          path="/players"
          element={
            <Suspense fallback={<Loading />}>
              <PlayerStats />
            </Suspense>
          }
        />
        <Route
          path="/player/:id"
          element={
            <Suspense fallback={<Loading />}>
              <PlayerProfile />
            </Suspense>
          }
        />
        <Route
          path="/terms"
          element={
            <Suspense fallback={<Loading />}>
              <TermsOfService />
            </Suspense>
          }
        />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<Loading />}>
              <AdminPage />
            </Suspense>
          }
        />
        <Route
          path="/admin/balance"
          element={
            <Suspense fallback={<Loading />}>
              <BalancePage />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <div className="text-center text-white py-5">
              <h4 className="mb-4">Where you trying to go?</h4>
              <Link to="/" className="btn back-button-glass">
                ← Back to Home
              </Link>
            </div>
          }
        />
      </Routes>

      <Footer />
    </>
  );
}

function Loading() {
  return <div className="text-white text-center py-5">Loading…</div>;
}
