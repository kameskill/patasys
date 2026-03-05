import React, { useEffect, useState } from "react";
import supabase from "../config/Client";
import { useNavigate } from "react-router-dom";

function ResetPasswordPage() {
    const navigate = useNavigate();

    const [pw, setPw] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);

    const [status, setStatus] = useState({ type: "", text: "" });
    const setError = (text) => setStatus({ type: "error", text });
    const setSuccess = (text) => setStatus({ type: "success", text });

    const [hasRecoverySession, setHasRecoverySession] = useState(false);

    const isValidPassword = (password) => {
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const isValidLength = password.length >= 8;
        return hasUpper && hasNumber && hasSpecial && isValidLength;
    };

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
            return setError("Reset session missing or expired. Please request a new reset link.");
        }
        if (!isValidPassword(pw)) {
            return setError("Password must be at least 8 characters, include an uppercase letter, a number, and a special character.");
        }
        if (pw !== confirm) {
            return setError("Passwords do not match.");
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: pw });
            if (error) throw error;

            setSuccess("Password updated successfully! Redirecting to login...");
            setTimeout(() => navigate("/login"), 1500);
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to update password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 font-sans selection:bg-black selection:text-white">
            <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-8 shadow-xl">

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fa-solid fa-lock text-gray-900 text-2xl"></i>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Set New Password</h1>
                    <p className="text-sm text-gray-500 mt-2">
                        Create a new, strong password for your account.
                    </p>
                </div>

                {!hasRecoverySession && (
                    <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3 text-red-800">
                        <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                        <p className="text-sm font-medium">Reset session missing or link expired. Please request a new password reset link.</p>
                    </div>
                )}

                {status.text && (
                    <div
                        className={`p-4 mb-6 text-sm rounded-xl flex items-start gap-3 ${status.type === "error"
                                ? "text-red-800 bg-red-50 border border-red-100"
                                : "text-green-800 bg-green-50 border border-green-100"
                            }`}
                        role="alert"
                    >
                        <i className={`fa-solid ${status.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} mt-0.5`}></i>
                        <span className="font-medium">{status.text}</span>
                    </div>
                )}

                <form onSubmit={updatePw} className="space-y-5">
                    <div>
                        <label className="block mb-2 text-sm font-bold text-gray-700">
                            New Password
                        </label>
                        <div className="relative">
                            <input
                                className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-black focus:border-transparent block p-3.5 pr-10 transition-colors outline-none"
                                type={showPw ? "text" : "password"}
                                placeholder="••••••••"
                                required
                                value={pw}
                                onChange={(e) => setPw(e.target.value)}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-700 cursor-pointer transition-colors"
                                onClick={() => setShowPw(!showPw)}
                            >
                                <i className={`fa-regular ${showPw ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                        <p className="mt-2 text-[11px] text-gray-500 font-medium">Min 8 chars, 1 uppercase, 1 number, 1 special char.</p>
                    </div>

                    <div>
                        <label className="block mb-2 text-sm font-bold text-gray-700">
                            Confirm New Password
                        </label>
                        <input
                            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-black focus:border-transparent block p-3.5 transition-colors outline-none"
                            type={showPw ? "text" : "password"}
                            placeholder="••••••••"
                            required
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-black text-white py-3.5 rounded-xl font-bold text-base hover:bg-gray-800 disabled:opacity-50 transition-all cursor-pointer shadow-md active:scale-[0.99] mt-4"
                        disabled={loading || !hasRecoverySession}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <i className="fa-solid fa-circle-notch animate-spin"></i> Updating...
                            </span>
                        ) : (
                            "Update Password"
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => navigate("/login")}
                        className="text-sm font-semibold text-gray-500 hover:text-black transition-colors cursor-pointer"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ResetPasswordPage;