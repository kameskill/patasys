import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../config/Client";

export default function useAuthLogic() {
    const navigate = useNavigate();

    const [checkingSession, setCheckingSession] = useState(true);
    const [activeTab, setActiveTab] = useState("login");

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });

    const [loginForm, setLoginForm] = useState({ email: "", password: "" });
    const [regForm, setRegForm] = useState({
        fullname: "",
        phone: "",
        email: "",
        password: "",
        confirm: "",
        agree: false,
    });

    const setError = (text) => setMsg({ type: "error", text: text || "Something went wrong." });
    const setSuccess = (text) => setMsg({ type: "success", text: text || "Success." });

    async function upsertProfile(userId, fullname, phone) {
        const { error } = await supabase.from("profiles").upsert(
            {
                user_id: userId,
                full_name: fullname || "",
                phone: phone || "",
            },
            { onConflict: "user_id" }
        );
        if (error) throw error;
    }

    async function redirectByRole(userId) {
        const { data, error } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("user_id", userId)
            .single();

        if (error || !data?.is_admin) navigate("/home", { replace: true });
        else navigate("/admin/dashboard", { replace: true });
    }

    useEffect(() => {
        let mounted = true;

        const check = async () => {
            try {
                const { data } = await supabase.auth.getSession();
                if (!mounted) return;

                const user = data?.session?.user;
                if (user?.id) {
                    await redirectByRole(user.id);
                    return;
                }
            } finally {
                if (mounted) setCheckingSession(false);
            }
        };

        check();

        const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const user = session?.user;
            if (user?.id) {
                await redirectByRole(user.id);
            }
        });

        return () => {
            mounted = false;
            listener?.subscription?.unsubscribe();
        };
    }, [navigate]);

    async function login(e) {
        if (e?.preventDefault) e.preventDefault();
        setMsg({ type: "", text: "" });
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginForm.email,
                password: loginForm.password,
            });

            if (error) throw error;

            const u = data?.user;
            if (u?.id) {
                const meta = u.user_metadata || {};
                const metaName = meta.full_name || meta.name || meta.fullname || "";
                const metaPhone = meta.phone || "";

                await upsertProfile(u.id, metaName, metaPhone);
                await redirectByRole(u.id);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || "Login failed.");
        } finally {
            setLoading(false);
        }
    }

    async function register(e) {
        if (e?.preventDefault) e.preventDefault();
        setMsg({ type: "", text: "" });

        if (regForm.password !== regForm.confirm) return setError("Passwords do not match.");
        if (!regForm.agree) return setError("Please agree to the Terms.");

        setLoading(true);

        try {
            const emailRedirectTo = `${window.location.origin}/auth/callback`;

            const { data, error } = await supabase.auth.signUp({
                email: regForm.email,
                password: regForm.password,
                options: {
                    emailRedirectTo,
                    data: {
                        full_name: regForm.fullname,
                        phone: regForm.phone,
                    },
                },
            });

            if (error) throw error;

            if (!data.session) {
                setSuccess("Registered! Please check your email to confirm your account.");
                return;
            }

            if (data?.user?.id) {
                await upsertProfile(data.user.id, regForm.fullname, regForm.phone);
                await redirectByRole(data.user.id);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || "Register failed.");
        } finally {
            setLoading(false);
        }
    }

    async function resendConfirmation() {
        setMsg({ type: "", text: "" });

        if (!regForm.email) return setError("Enter your email first (register email field).");

        setLoading(true);
        try {
            const emailRedirectTo = `${window.location.origin}/auth/callback`;

            const { error } = await supabase.auth.resend({
                type: "signup",
                email: regForm.email,
                options: { emailRedirectTo },
            });

            if (error) throw error;
            setSuccess("Confirmation email sent. Please check your inbox/spam.");
        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to resend confirmation email.");
        } finally {
            setLoading(false);
        }
    }

    return {
        checkingSession,

        activeTab,
        setActiveTab,

        loading,
        msg,

        loginForm,
        setLoginForm,

        regForm,
        setRegForm,

        login,
        register,
        resendConfirmation,
    };
}
