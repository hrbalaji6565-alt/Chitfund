import { cookies } from "next/headers";

export default async function Profile() {
  const cookieStore = await cookies();
  const token = cookieStore.get("adminToken")?.value;

  let email = "Not logged in";

  if (token) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64").toString("utf-8")
      );
      email = payload.email || email;
    } catch {
      email = "Invalid token";
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8fafc",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#ffffff",
          padding: "32px",
          borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "22px",
            fontWeight: "600",
            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          Admin Profile
        </h1>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              backgroundColor: "#f1f5f9",
            }}
          >
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Email Address
            </div>
            <div style={{ fontSize: "15px", fontWeight: "500" }}>
              {email}
            </div>
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              backgroundColor: "#f1f5f9",
            }}
          >
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Role
            </div>
            <div style={{ fontSize: "15px", fontWeight: "500" }}>
              Admin
            </div>
          </div>

          <div
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              backgroundColor: "#f1f5f9",
            }}
          >
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Status
            </div>
            <div style={{ fontSize: "15px", fontWeight: "500", color: "#16a34a" }}>
              Logged In
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
