import { Routes, Route, Link } from "react-router-dom";
import { lazy, Suspense } from "react";
import Footer from "./components/Footer";
import Landing from "./components/Landing";
import LoadingSplash from "./components/LoadingSplash";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const HsrHome = lazy(() => import("./components/HsrHome"));
const CharacterStats = lazy(() => import("./components/CharacterStats"));
const PlayerStats = lazy(() => import("./components/PlayerStats"));
const PlayerProfile = lazy(() => import("./components/PlayerProfile"));
const TermsOfService = lazy(() => import("./components/TermsOfService"));
const AdminPage = lazy(() => import("./components/AdminPage"));
const BalancePage = lazy(() => import("./components/BalancePage"));
const BalancePreview = lazy(() => import("./components/BalancePreview"));
const AdminMatchHistory = lazy(() => import("./components/AdminMatchHistory"));

function PageWithFooter({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        style={{ marginTop: "80px" }}
      />

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="btn btn-light position-fixed"
        style={{
          bottom: "20px",
          right: "20px",
          zIndex: 9999,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "white",
          backdropFilter: "blur(6px)",
          borderRadius: "50%",
          width: "44px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Back to top"
        title="Back to top"
      >
        ↑
      </button>
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
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <HsrHome />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/characters"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <CharacterStats />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/players"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <PlayerStats />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/player/:id"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <PlayerProfile />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/terms"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <TermsOfService />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/admin"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <AdminPage />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/admin/balance"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <BalancePage />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/admin/match-history"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <AdminMatchHistory />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/balance-cost"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <BalancePreview />
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
            <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-white text-center">
              <h4 className="mb-4">Where you trying to go?</h4>
              <Link to="/" className="btn back-button-glass">
                ← Back to Home
              </Link>
            </div>
            <Footer />
          </div>
        }
      />
    </Routes>
  );
}
