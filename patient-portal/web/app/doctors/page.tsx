"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeCheck, Sparkles, MapPin, Award, Search, Filter } from "lucide-react";
import { api, Doctor } from "@/lib/api";

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filtered, setFiltered] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Doctor[]>("/doctors")
      .then((data) => {
        setDoctors(data);
        setFiltered(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let list = doctors;
    if (selectedSpecialty !== "All") {
      list = list.filter((d) => d.specialization.toLowerCase().includes(selectedSpecialty.toLowerCase()));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q) || d.specialization.toLowerCase().includes(q) || d.city.toLowerCase().includes(q));
    }
    setFiltered(list);
  }, [search, selectedSpecialty, doctors]);

  const specialties = [
    "All",
    "Gynecology",
    "Ayurvedic",
    "Diabetology",
    "Dental",
  ];

  return (
    <div className="doctors-directory-page">
      <header className="page-heading" style={{ marginBottom: "1.8rem" }}>
        <p className="eyebrow">AIVIDA MEDICAL DIRECTORY · SCREEN 2</p>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.4rem" }}>Find a Specialist Doctor</h1>
        <p className="muted" style={{ maxWidth: "640px" }}>
          Consult certified specialists in Chennai. Select any doctor to view credentials, clinical experience, and real-time appointment availability.
        </p>
      </header>

      {/* Search & Filter Bar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginBottom: "2rem",
          background: "#ffffff",
          padding: "1.2rem 1.4rem",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ position: "relative", width: "100%" }}>
          <Search
            size={18}
            style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }}
          />
          <input
            type="text"
            placeholder="Search by doctor name, specialty, or condition..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem 1rem 0.75rem 2.7rem",
              borderRadius: "10px",
              border: "1px solid #cbd5e1",
              fontSize: "0.95rem",
              outline: "none",
            }}
          />
        </div>

        {/* Specialty Filter Chips */}
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "4px" }}>
            Filter:
          </span>
          {specialties.map((spec) => (
            <button
              key={spec}
              type="button"
              onClick={() => setSelectedSpecialty(spec)}
              style={{
                padding: "0.45rem 0.95rem",
                borderRadius: "999px",
                fontSize: "0.83rem",
                fontWeight: 600,
                border: selectedSpecialty === spec ? "1px solid #047857" : "1px solid #e2e8f0",
                background: selectedSpecialty === spec ? "#ecfdf5" : "#f8fafc",
                color: selectedSpecialty === spec ? "#047857" : "#475569",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {spec}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="alert error-alert" role="alert">
          {error}
        </p>
      ) : loading ? (
        <p className="muted">Loading certified doctors from database...</p>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
          <p className="muted">No doctors found matching "{search}". Try searching for another specialty.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {filtered.map((doc) => (
            <Link
              key={doc.id}
              href={`/doctors/${doc.id}`}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "18px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 12px 24px rgba(0,0,0,0.08)";
                e.currentTarget.style.borderColor = "#cbd5e1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.04)";
                e.currentTarget.style.borderColor = "#e2e8f0";
              }}
            >
              <div style={{ position: "relative", width: "100%", height: "180px", background: "#f1f5f9" }}>
                <img
                  src={doc.image_url || "/doctors/hamsathvani.jpg"}
                  alt={`Portrait of ${doc.name}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/doctors/hamsathvani.jpg";
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "50%",
                    padding: "4px",
                    display: "grid",
                    placeItems: "center",
                    color: "#0284c7",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                  title="Aivida Certified Specialist"
                >
                  <BadgeCheck size={18} fill="currentColor" stroke="white" />
                </span>

                {/* Live Online Badge */}
                <span
                  style={{
                    position: "absolute",
                    bottom: "12px",
                    left: "12px",
                    background: doc.is_online ? "rgba(6, 78, 59, 0.88)" : "rgba(30, 41, 59, 0.85)",
                    color: "#fff",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    padding: "0.25rem 0.65rem",
                    borderRadius: "999px",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: doc.is_online ? "#10b981" : "#94a3b8",
                    }}
                  />
                  <span>{doc.is_online ? "Online Now" : "Offline"}</span>
                </span>
              </div>

              <div style={{ padding: "1.4rem", display: "flex", flexDirection: "column", flex: 1, gap: "0.5rem" }}>
                <h2 style={{ fontSize: "1.15rem", margin: 0, color: "#0f172a" }}>{doc.name}</h2>
                <p style={{ color: "var(--brand, #ea580c)", fontSize: "0.88rem", fontWeight: 700, margin: 0 }}>{doc.specialization}</p>

                <p style={{ color: "#64748b", fontSize: "0.83rem", margin: "0.3rem 0 0 0", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <Award size={14} style={{ color: "#1d4ed8", flexShrink: 0 }} />
                  <span>{doc.experience_years} Years Experience · {doc.qualification}</span>
                </p>

                <p style={{ color: "#64748b", fontSize: "0.83rem", margin: 0, display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <MapPin size={14} style={{ color: "#64748b", flexShrink: 0 }} />
                  <span>{doc.city}</span>
                </p>

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: "1rem",
                    borderTop: "1px solid #f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <span style={{ display: "block", fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Fee</span>
                    <strong style={{ fontSize: "1.15rem", color: "#0f172a" }}>₹{doc.fee}</strong>
                  </div>
                  <span
                    style={{
                      padding: "0.45rem 0.95rem",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                      color: "#c2410c",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      border: "1px solid #fed7aa",
                    }}
                  >
                    View Slots →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
