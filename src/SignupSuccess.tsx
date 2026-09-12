import { useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { User } from "./types";
import revzentaLogo from "./assets/revzenta-logo.png";

/**
 * Stripe-return landing (2026-09-08): the signup checkout `success_url` points
 * at `#/signup-success?session_id=…&email=…`. This screen verifies the
 * checkout via `api.signupComplete` (the server re-checks the Stripe session
 * before minting a session) and enters the workspace on success.
 */
export default function SignupSuccess({
  onDone,
  onSignIn,
}: {
  onDone: (u: User) => void;
  onSignIn: () => void;
}) {
  const [status, setStatus] = useState<"verifying" | "ready" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your checkout…");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const h = window.location.hash;
    const q = h.includes("?") ? h.slice(h.indexOf("?") + 1) : "";
    const params = new URLSearchParams(q);
    const sessionId = params.get("session_id") ?? undefined;
    const email = params.get("email") ?? undefined;
    api
      .signupComplete({ sessionId, email })
      .then((res) => {
        if (res.user) {
          setUser(res.user);
          setStatus("ready");
          setMessage("Payment confirmed — your workspace is ready!");
        } else {
          setStatus("error");
          setMessage("We could not find a completed payment for this signup. Your workspace is created only after payment — please complete checkout, then sign in.");
        }
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Could not verify your checkout. Please sign in.");
      });
  }, []);

  return (
    <div className="login">
      <div className="login-glow" aria-hidden="true" />
      <div className="login-card" style={{ textAlign: "center" }}>
        <div className="login-brand" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <img
            src={revzentaLogo}
            alt="Revzenta Logo"
            style={{ width: "110px", height: "auto", borderRadius: "10px", objectFit: "contain" }}
          />
          <div className="login-name" style={{ fontSize: "22px", fontWeight: 800 }}>Revzenta CRM</div>
        </div>
        {status === "verifying" && (
          <div className="alert alert-setup" role="status">
            <strong>Finishing signup…</strong>
            <p>{message}</p>
          </div>
        )}
        {status === "ready" && user && (
          <>
            <div className="alert alert-success" role="status">{message}</div>
            <button className="btn btn-primary btn-block" type="button" onClick={() => onDone(user)}>
              Enter your workspace →
            </button>
          </>
        )}
        {status === "error" && (
          <>
            <div className="alert alert-error" role="alert">{message}</div>
            <button className="btn btn-primary btn-block" type="button" onClick={onSignIn}>
              Go to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
