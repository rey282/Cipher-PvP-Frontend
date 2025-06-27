import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import type { ChartOptions } from "chart.js";
import { seasonOptions } from "../data/season";
import type { SeasonValue } from "../data/season";
import "./Landing.css";

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

type InsightsData = {
  averageCyclesPerMatch: number;
  averagePrebansPerMatch: number;
  averagePenaltyPerMatch: number;
  matchesByDay: Record<string, number>;
  totalMatches: number;
  total15cCycles: number;
  lastFetched?: string;
};
  

function fillMissingDays(
  input: Record<string, number>
): Record<string, number> {
  if (!input || Object.keys(input).length === 0) return {};

  const filled: Record<string, number> = {};
  const rawDates = Object.keys(input).sort();

  const start = new Date(rawDates[0]);
  const end = new Date(rawDates[rawDates.length - 1]);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);

  const inputFormatted: Record<string, number> = {};
  for (const dateStr of rawDates) {
    const d = new Date(dateStr);
    const key = d.toLocaleDateString("en-GB");
    inputFormatted[key] = input[dateStr];
  }

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toLocaleDateString("en-GB"); // DD/MM/YYYY
    filled[key] = inputFormatted[key] ?? 0;
  }

  return filled;
}
  

export default function HsrInsights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [season, setSeason] = useState<SeasonValue>("players");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE}/api/insights?season=${season}`)
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData(null));
  }, [season]);

  const filledMatches = data ? fillMissingDays(data.matchesByDay) : {};
  const sortedEntries = Object.entries(filledMatches).sort(
    ([a], [b]) =>
      new Date(a.split("/").reverse().join("-")).getTime() -
      new Date(b.split("/").reverse().join("-")).getTime()
  );

  const labels = sortedEntries.map(([date]) => date);
  const values = sortedEntries.map(([, count]) => count);

  const lineData = {
    labels,
    datasets: [
      {
        label: "Matches Played",
        data: values,
        borderColor: "#ffffff",
        backgroundColor: "rgba(255,255,255,0.5)",
        pointBackgroundColor: "#ffffff",
        pointBorderColor: "#000",
        borderWidth: 2,
        tension: 0.3,
        fill: false,
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      line: { tension: 0.3 },
    },
    plugins: {
      legend: {
        labels: {
          color: "white",
        },
      },
    },
    scales: {
      x: {
        display: true,
        type: "category",
        offset: true,
        ticks: {
          color: "white",
          autoSkip: false,
          maxRotation: 60,
          minRotation: 60,
        },
        grid: {
          color: "rgba(255,255,255,0.1)",
        },
      },
      y: {
        ticks: {
          color: "white",
        },
        grid: {
          color: "rgba(255,255,255,0.1)",
        },
      },
    },
  };

  return (
    <div
      className="page-fade-in"
      style={{
        backgroundImage: "url('/background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0,0,0,0.7)",
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />
      <div className="position-relative z-2 text-white px-4">
        <Navbar />

        <div className="d-flex justify-content-end mt-3 mb-4">
          <div className="d-flex flex-column align-items-end gap-2">
            <Link to="/hsr" className="btn back-button-glass">
              ← Back
            </Link>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value as SeasonValue)}
              className="form-select"
              style={{
                width: 160,
                padding: "0.75rem 1rem",
                backgroundColor: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                color: "#fff",
                backdropFilter: "blur(6px)",
                outline: "none",
              }}
            >
              {seasonOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h2 className="fw-bold mb-3 text-center">Cipher PvP Insights</h2>

        {data?.lastFetched && (
          <p
            className="text-white-50 mb-4 text-center"
            style={{ fontSize: "0.85rem" }}
          >
            Data last updated: {new Date(data.lastFetched).toLocaleString()}
          </p>
        )}

        <div className="row g-3 mb-4">
          <StatCard
            label="Avg. Cycles per Match"
            value={data?.averageCyclesPerMatch}
          />
          <StatCard
            label="Avg. Preban+Jokers"
            value={data?.averagePrebansPerMatch}
          />
          <StatCard
            label="Avg. Cycle Penalty"
            value={data?.averagePenaltyPerMatch}
          />
          <StatCard label="Total 15C Cycles" value={data?.total15cCycles} />
        </div>

        <div
          className="p-3 rounded glass-card mb-5 scroll-container"
          style={{
            overflowX: "auto",
            minHeight: "300px",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <h5 className="mb-3">Match Count by Day</h5>
          <div
            style={{
              width: `${Math.max(labels.length * 30, 800)}px`,
              height: "300px",
            }}
          >
            <Line data={lineData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="col-sm-6 col-lg-3">
      <div className="glass-card p-3 text-center">
        <div className="fs-6 text-white-50">{label}</div>
        <div className="fs-4 fw-semibold">{value?.toFixed(2) ?? "—"}</div>
      </div>
    </div>
  );
}
