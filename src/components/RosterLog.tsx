// src/pages/admin/RosterLog.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import "../components/Landing.css";

interface RosterLogEntry {
  id: number;
  discord_id: string;
  username: string;
  global_name: string;
  old_points: number;
  new_points: number;
  timestamp: string;
}

export default function RosterLogPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<RosterLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) navigate("/");
  }, [user, loading, navigate]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/admin/roster-log`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((j) => setLogs(j.data || []))
      .catch(() => setLogs([]));
  }, []);

  /* ────────── access-check loader ────────── */
  if (loading || !user) {
    return (
      <div
        className="d-flex justify-content-center align-items-center text-white"
        style={{ minHeight: "100vh", background: "#000" }}
      >
        <p>Checking admin access…</p>
      </div>
    );
  }

  const filtered = logs.filter(
    (log) =>
      log.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.global_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.discord_id.includes(searchTerm)
  );

  const pageCount = Math.ceil(filtered.length / rowsPerPage);
  const pageData = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/admin.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,.7)",
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />
      <div className="position-relative z-2 text-white px-4 pb-5">
        <Navbar />

        <div className="w-100 d-flex justify-content-end mb-3 pe-4">
          <button
            onClick={() => navigate("/admin")}
            className="btn back-button-glass"
          >
            ← Back
          </button>
        </div>

        <div className="container">
          <h1 className="display-4 fw-bold text-center mb-4">Roster Log</h1>

          {/* Search bar */}
          <div className="d-flex justify-content-center mb-4">
            <input
              type="text"
              className="form-control"
              placeholder="Search by name or Discord ID"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              style={{
                maxWidth: 500,
                padding: "0.75rem 1rem",
                backgroundColor: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                color: "#fff",
                backdropFilter: "blur(6px)",
                outline: "none",
              }}
            />
          </div>

          {/* Table */}
          <div
            className="mx-auto"
            style={{
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              boxShadow: "0 0 18px rgba(0,0,0,0.4)",
              padding: "1rem",
              maxWidth: 1000,
            }}
          >
            <div className="table-responsive">
              <table
                className="table table-hover mb-0"
                style={{
                  backgroundColor: "transparent",
                  color: "white",
                  tableLayout: "fixed",
                  width: "100%",
                }}
              >
                <thead>
                  <tr>
                    <th style={{ width: "35%" }}>User</th>
                    <th style={{ width: "10%" }}>Old Points</th>
                    <th style={{ width: "10%" }}>New Points</th>
                    <th style={{ width: "25%" }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((log) => (
                    <tr key={log.id}>
                      <td style={{ backgroundColor: "transparent" }}>
                        <strong>
                          {log.global_name || log.username || "Unknown User"}
                        </strong>
                      </td>
                      <td>{log.old_points}</td>
                      <td>{log.new_points}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="d-flex justify-content-center gap-2 mt-3">
                <button
                  className="btn btn-sm btn-outline-light"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ◀ Prev
                </button>
                <span className="pt-1">
                  Page {page} / {pageCount}
                </span>
                <button
                  className="btn btn-sm btn-outline-light"
                  disabled={page === pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next ▶
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
