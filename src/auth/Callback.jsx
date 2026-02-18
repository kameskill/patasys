import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../config/Client";

export default function AuthCallback() {
    const navigate = useNavigate();
    const [msg, setMsg] = useState("Confirming...");

    useEffect(() => {
        const run = async () => {
            const url = new URL(window.location.href);

            const hashParams = new URLSearchParams(window.location.hash.replace("#", ""));
            const errorDesc =
                url.searchParams.get("error_description") || hashParams.get("error_description");

            if (errorDesc) {
                setMsg(decodeURIComponent(errorDesc));
                return;
            }

            const code = url.searchParams.get("code");
            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
                if (error) {
                    setMsg(error.message || "Confirmation failed.");
                    return;
                }
            }

            const {
                data: { session },
                error: sessionErr,
            } = await supabase.auth.getSession();

            if (sessionErr) {
                setMsg(sessionErr.message || "Failed to get session.");
                return;
            }

            if (session) {
                navigate("/home", { replace: true });
            } else {
                setMsg("No session found. Please login again.");
            }
        };

        run();
    }, [navigate]);

    return (
        <div className="min-h-screen grid place-items-center bg-white p-6">
            <div className="text-gray-700 font-semibold">{msg}</div>
        </div>
    );
}
