// src/components/admin/AdminRosterLogPanel.tsx
import { useEffect, useState } from "react";

interface RosterLogEntry {
  id: number;
  discord_id: string;
  username: string;
  global_name: string;
  old_points: number;
  new_points: number;
  submitted_at: string;
}

export default function AdminRosterLogPanel() {
  const [logs, setLogs] = useState<RosterLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/admin/roster-log`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((j) => setLogs(j.data || []))
      .catch(() => setLogs([]));
  }, []);

  /* Timestamp formatter */
  function formatTimestamp(raw?: string): string {
    if (!raw || typeof raw !== "string") return "Invalid Date";
    const iso = raw.replace(" ", "T");
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date
      .toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      .replace(",", "");
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
    <div className="admin-panel-scroll">
      {/* Search bar */}
      <div className="d-flex justify-content-start mb-3">
        <input
          type="text"
          placeholder="Search by name or Discord ID"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          style={{
            width: "100%",
            maxWidth: 400,
            padding: "0.6rem 0.9rem",
            backgroundColor: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10,
            color: "#fff",
            backdropFilter: "blur(6px)",
            outline: "none",
          }}
        />
      </div>

      {/* Table */}
      <div
        className="mb-4"
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
                  <td>
                    <strong>
                      {log.global_name || log.username || "Unknown User"}
                    </strong>
                  </td>
                  <td>{log.old_points}</td>
                  <td>{log.new_points}</td>
                  <td>{formatTimestamp(log.submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="d-flex justify-content-center gap-3 mt-3">
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
  );
}
