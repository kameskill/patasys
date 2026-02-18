import React, { useState } from "react";
import supabase from "../config/Client";

function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [msg, setMsg] = useState("");

    const sendReset = async (e) => {
        e.preventDefault();
        setMsg("");

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: "http://localhost:5173/reset-password",
        });

        if (error) setMsg(error.message);
        else setMsg("Reset link sent! Please check your email.");
    };

    return (
        <div className="min-h-screen grid place-items-center p-4 bg-black/40">
            <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 p-6 shadow-xl">
                <h1 className="text-2xl font-bold">Reset Password</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Enter your email and we’ll send a reset link.
                </p>

                {msg && <div className="mt-4 text-sm">{msg}</div>}

                <form onSubmit={sendReset} className="mt-5 flex flex-col gap-3">
                    <input
                        className="w-full border border-gray-300 rounded-md p-2.5"
                        type="email"
                        placeholder="Email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <button className="w-full bg-black text-white py-2.5 rounded font-semibold">
                        Send reset link
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ForgotPasswordPage