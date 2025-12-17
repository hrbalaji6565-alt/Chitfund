"use client";

import { useState } from "react";

export default function ProfilePage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleChangePassword = async () => {
    setLoading(true);
    setSuccess("");
    setError("");

    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");

      setSuccess("Password updated successfully");
      setOldPassword("");
      setNewPassword("");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "80vh",
        background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
        }}
      >
        {/* LEFT */}
        <div style={cardStyle}>
          <h2 style={titleStyle}>Admin Profile</h2>
          <InfoBox label="Email Address" value="admin@example.com" />
          <InfoBox label="Role" value="Admin" />
          <InfoBox label="Status" value="Logged In" valueColor="#16a34a" />
        </div>

        {/* RIGHT */}
        <div style={cardStyle}>
          <h2 style={titleStyle}>Change Password</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* OLD PASSWORD */}
            <PasswordField
              placeholder="Current Password"
              value={oldPassword}
              show={showOld}
              onToggle={() => setShowOld(!showOld)}
              onChange={setOldPassword}
            />

            {/* NEW PASSWORD */}
            <PasswordField
              placeholder="New Password"
              value={newPassword}
              show={showNew}
              onToggle={() => setShowNew(!showNew)}
              onChange={setNewPassword}
            />

            <button
              onClick={handleChangePassword}
              disabled={loading}
              style={buttonStyle}
            >
              {loading ? "Updating..." : "Update Password"}
            </button>

            {success && <div style={{ color: "#16a34a" }}>{success}</div>}
            {error && <div style={{ color: "#dc2626" }}>{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Password Field with Eye ---------- */
function PasswordField({
  placeholder,
  value,
  show,
  onToggle,
  onChange,
}: {
  placeholder: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, paddingRight: "42px" }}
      />
      <span
        onClick={onToggle}
        style={{
          position: "absolute",
          right: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          cursor: "pointer",
          fontSize: "16px",
          color: "#64748b",
        }}
      >
        {show ? "🙈" : "👁️"}
      </span>
    </div>
  );
}

/* ---------- Info Box ---------- */
function InfoBox({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={infoBoxStyle}>
      <div style={{ fontSize: "12px", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: "15px", fontWeight: 500, color: valueColor || "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}

/* ---------- Styles ---------- */
const cardStyle = {
  background: "#ffffff",
  borderRadius: "16px",
  padding: "32px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
};

const titleStyle = {
  fontSize: "22px",
  fontWeight: 600,
  marginBottom: "20px",
};

const inputStyle: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  fontSize: "14px",
  width: "100%",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: "10px",
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  fontWeight: 500,
  cursor: "pointer",
};

const infoBoxStyle = {
  background: "#f1f5f9",
  borderRadius: "10px",
  padding: "14px 16px",
  marginBottom: "14px",
};
