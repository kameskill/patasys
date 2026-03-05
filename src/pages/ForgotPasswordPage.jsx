import React, { useState } from "react";
import supabase from "../config/Client";
import { useNavigate } from "react-router-dom";

function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState({ type: "", text: "" });
    const [loading, setLoading] = useState(false);

    const sendReset = async (e) => {
        e.preventDefault();
        setStatus({ type: "", text: "" });
        setLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) throw error;

            setStatus({ type: "success", text: "Reset link sent! Please check your email." });
            setEmail("");
        } catch (err) {
            setStatus({ type: "error", text: err.message || "Failed to send reset link." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 font-sans selection:bg-black selection:text-white">
            <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-8 shadow-xl">

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fa-regular fa-envelope text-gray-900 text-2xl"></i>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
                    <p className="text-sm text-gray-500 mt-2">
                        Enter your email and we'll send you a link to get back into your account.
                    </p>
                </div>

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

                <form onSubmit={sendReset} className="space-y-5">
                    <div>
                        <label className="block mb-2 text-sm font-bold text-gray-700">
                            Email Address
                        </label>
                        <input
                            className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-black focus:border-transparent block p-3.5 transition-colors outline-none"
                            type="email"
                            placeholder="email@mail.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-black text-white py-3.5 rounded-xl font-bold text-base hover:bg-gray-800 disabled:opacity-50 transition-all cursor-pointer shadow-md active:scale-[0.99] mt-4"
                        disabled={loading || !email}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <i className="fa-solid fa-circle-notch animate-spin"></i> Sending...
                            </span>
                        ) : (
                            "Send Reset Link"
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => navigate("/login")}
                        className="text-sm font-semibold text-gray-500 hover:text-black transition-colors cursor-pointer"
                    >
                        <i className="fa-solid fa-arrow-left mr-1"></i> Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ForgotPasswordPage;