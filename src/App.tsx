import { Routes, Route, Link } from "react-router-dom";
import { lazy, Suspense } from "react";
import Footer from "./components/Footer";
import Landing from "./components/Landing";

const HsrHome = lazy(() => import("./components/HsrHome"));
const CharacterStats = lazy(() => import("./components/CharacterStats"));
const PlayerStats = lazy(() => import("./components/PlayerStats"));
const PlayerProfile = lazy(() => import("./components/PlayerProfile"));
const TermsOfService = lazy(() => import("./components/TermsOfService"));
const AdminPage = lazy(() => import("./components/AdminPage"));
const BalancePage = lazy(() => import("./components/BalancePage"));

function PageWithFooter({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PageWithFooter>
            <Landing />
          </PageWithFooter>
        }
      />

      <Route
        path="/hsr"
        element={
          <Suspense fallback={<Loading />}>
            <PageWithFooter>
              <HsrHome />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/characters"
        element={
          <Suspense fallback={<Loading />}>
            <PageWithFooter>
              <CharacterStats />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/players"
        element={
          <Suspense fallback={<Loading />}>
            <PageWithFooter>
              <PlayerStats />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/player/:id"
        element={
          <Suspense fallback={<Loading />}>
            <PageWithFooter>
              <PlayerProfile />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/terms"
        element={
          <Suspense fallback={<Loading />}>
            <PageWithFooter>
              <TermsOfService />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/admin"
        element={
          <Suspense fallback={<Loading />}>
            <PageWithFooter>
              <AdminPage />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/admin/balance"
        element={
          <Suspense fallback={<Loading />}>
            <PageWithFooter>
              <BalancePage />
            </PageWithFooter>
          </Suspense>
        }
      />

      <Route
        path="*"
        element={
          <div
            className="d-flex flex-column"
            style={{ minHeight: "100vh", background: "#000" }}
          >
            {/* Centered 404 content */}
            <div
              className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-white text-center"
            >
              <h4 className="mb-4">Where you trying to go?</h4>
              <Link to="/" className="btn back-button-glass">
                ← Back to Home
              </Link>
            </div>

            {/* Footer at the bottom */}
            <Footer />
          </div>
        }
      />
    </Routes>
  );
}

function Loading() {
  return (
    <div className="text-white text-center py-5" style={{ minHeight: "100vh" }}>
      Loading…
    </div>
  );
}
