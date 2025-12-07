import { Routes, Route, Link } from "react-router-dom";
import { lazy, Suspense } from "react";
import Footer from "./components/Footer";
import Landing from "./components/Landing";
import LoadingSplash from "./components/LoadingSplash";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ─────────── Lazy-loaded pages ─────────── */
const HsrHome = lazy(() => import("./components/HsrHome"));
const CharacterStats = lazy(() => import("./components/CharacterStats"));
const PlayerStats = lazy(() => import("./components/PlayerStats"));
const PlayerProfile = lazy(() => import("./components/PlayerProfile"));
const Profile = lazy(() => import("./components/Profile"));
const TermsOfService = lazy(() => import("./components/TermsOfService"));
const AdminPage = lazy(() => import("./components/AdminPage"));
const BalancePage = lazy(() => import("./components/BalancePage"));
const BalancePreview = lazy(() => import("./components/BalancePreview"));
const AdminMatchHistory = lazy(() => import("./components/AdminMatchHistory"));
const HsrInsights = lazy(() => import("./components/HsrInsights"));
//const HsrHome2 = lazy(() => import("./components2/HsrHome2"));
const BalancePage2 = lazy(() => import("./components2/BalancePage2"));
const BalancePreview2 = lazy(() => import("./components2/BalancePreview2"));
const CostTest = lazy(() => import("./components2/CostTest"));
const RosterLog = lazy(() => import("./components/RosterLog"));
const ZzzDraftPage = lazy(() => import("./components/ZzzDraft"));
const TeamPresets = lazy(() => import("./components/TeamPresets"));
const ZzzSpectatorPage = lazy(() => import("./components/ZzzSpectatorPage"));
const HsrDraftPage = lazy(() => import("./components/HsrDraft"));
const HsrSpectatorPage = lazy(() => import("./components/HsrSpectatorPage"));
const PlayerCharacterStats = lazy(
  () => import("./components/PlayerCharacterStats")
);
const ZzzBalancePage = lazy(() => import("./components2/ZzzBalancePage"));


/* ─────────── Layout wrapper ─────────── */
function PageWithFooter({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Footer />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
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

/* ─────────── App router ─────────── */
export default function App() {
  return (
    <Routes>
      {/* Landing */}
      <Route
        path="/"
        element={
          <PageWithFooter>
            <Landing />
          </PageWithFooter>
        }
      />
      <Route
        path="/terms"
        element={
          <PageWithFooter>
            <TermsOfService />
          </PageWithFooter>
        }
      />
      <Route
        path="/profile"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <Profile />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="/profile/:id"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <Profile />
            </PageWithFooter>
          </Suspense>
        }
      />
      <Route
        path="player/:id/characters"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <PlayerCharacterStats />
            </PageWithFooter>
          </Suspense>
        }
      />

      <Route
        path="/profile/team-presets"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <TeamPresets />
            </PageWithFooter>
          </Suspense>
        }
      />

      <Route
        path="/profile/:id/presets"
        element={
          <Suspense fallback={<LoadingSplash />}>
            <PageWithFooter>
              <TeamPresets />
            </PageWithFooter>
          </Suspense>
        }
      />

      {/* Cipher Format */}
      <Route path="/cipher">
        <Route
          index
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <HsrHome />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="characters"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <CharacterStats />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="players"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <PlayerStats />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="player/:id"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <PlayerProfile />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="insights"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <HsrInsights />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="balance-cost"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <BalancePreview />
              </PageWithFooter>
            </Suspense>
          }
        />
      </Route>

      {/* Cerydra Format */}
      <Route path="/cerydra">
        <Route
          path="balance-cost"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <BalancePreview2 />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="cost-test"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <CostTest />
              </PageWithFooter>
            </Suspense>
          }
        />
      </Route>

      {/* ZZZ Format */}
      <Route path="/zzz">
        <Route
          path="draft"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <ZzzDraftPage />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="s/:key"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <ZzzSpectatorPage />
              </PageWithFooter>
            </Suspense>
          }
        />
      </Route>

      {/* HSR Format */}
      <Route path="/hsr">
        <Route
          path="draft"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <HsrDraftPage />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="s/:key"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <HsrSpectatorPage />
              </PageWithFooter>
            </Suspense>
          }
        />
      </Route>

      {/* Admin Pages */}
      <Route path="/admin">
        <Route
          index
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <AdminPage />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="balance"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <BalancePage />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="cerydra-balance"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <BalancePage2 />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="vivian-balance"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <ZzzBalancePage />
              </PageWithFooter>
            </Suspense>
          }
        />

        <Route
          path="match-history"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <AdminMatchHistory />
              </PageWithFooter>
            </Suspense>
          }
        />
        <Route
          path="roster-log"
          element={
            <Suspense fallback={<LoadingSplash />}>
              <PageWithFooter>
                <RosterLog />
              </PageWithFooter>
            </Suspense>
          }
        />
      </Route>

      {/* 404 fallback */}
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
