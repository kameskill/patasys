import React, { useEffect, useState } from "react";
import supabase from "../config/Client";
import { useNavigate } from "react-router";

function ResetPasswordPage() {
    const navigate = useNavigate();
    const [pw, setPw] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);

    const [status, setStatus] = useState({ type: "", text: "" });
    const setError = (text) => setStatus({ type: "error", text });
    const setSuccess = (text) => setStatus({ type: "success", text });

    const [hasRecoverySession, setHasRecoverySession] = useState(false);

    useEffect(() => {
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
            if (event === "PASSWORD_RECOVERY") {
                setHasRecoverySession(true);
            }
        });

        supabase.auth.getSession().then(({ data }) => {
            if (data?.session) setHasRecoverySession(true);
        });

        return () => sub.subscription.unsubscribe();
    }, []);

    const updatePw = async (e) => {
        e.preventDefault();
        setStatus({ type: "", text: "" });

        if (!hasRecoverySession) {
            setError("Reset session missing. Please request a new reset link.");
            return;
        }
        if (pw.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        if (pw !== confirm) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: pw });
            if (error) throw error;

            setSuccess("Password updated! Redirecting to login...");
            setTimeout(() => navigate("/login"), 800);
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to update password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid place-items-center p-4 bg-black/40">
            <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-6 shadow-xl">
                <h1 className="text-2xl font-bold">Set New Password</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Create a new password for your account.
                </p>

                {!hasRecoverySession && (
                    <div className="mt-4 rounded-md border border-red-300 bg-red-50 text-red-700 p-3 text-sm">
                        Reset session missing or link expired. Please request a new reset link.
                    </div>
                )}

                {status.text && (
                    <div
                        className={[
                            "mt-4 rounded-md border p-3 text-sm",
                            status.type === "error"
                                ? "border-red-300 bg-red-50 text-red-700"
                                : "border-green-300 bg-green-50 text-green-700",
                        ].join(" ")}
                    >
                        {status.text}
                    </div>
                )}

                <form onSubmit={updatePw} className="mt-5 flex flex-col gap-3">
                    <input
                        className="w-full border border-gray-300 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-black/20"
                        type="password"
                        placeholder="New password"
                        required
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                    />
                    <input
                        className="w-full border border-gray-300 rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-black/20"
                        type="password"
                        placeholder="Confirm new password"
                        required
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                    />

                    <button
                        className="w-full bg-black text-white py-2.5 rounded font-semibold hover:bg-neutral-800 disabled:opacity-60"
                        disabled={loading || !hasRecoverySession}
                    >
                        {loading ? "Updating..." : "Update password"}
                    </button>
                </form>
            </div>
        </div>
    );
}


export default ResetPasswordPage