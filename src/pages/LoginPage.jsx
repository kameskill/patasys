import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import supabase from "../config/Client";

function LoginPage() {
    const navigate = useNavigate();

    const [pageState, setPageState] = useState("checking");

    const [activeTab, setActiveTab] = useState("login");
    const [showLoginPw, setShowLoginPw] = useState(false);
    const [showRegPw, setShowRegPw] = useState(false);

    const [showTerms, setShowTerms] = useState(false);

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });

    const [loginForm, setLoginForm] = useState({ email: "", password: "" });

    const [regForm, setRegForm] = useState({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        password: "",
        confirm: "",
        agree: false,
    });

    const setError = (text) => setMsg({ type: "error", text });
    const setSuccess = (text) => setMsg({ type: "success", text });

    const isValidEmail = (email) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());

    const cleanPhoneDigits = (v) => String(v || "").replace(/\D/g, "").slice(0, 11);
    const isValidPHPhone11 = (v) => /^\d{11}$/.test(String(v || ""));

    const fullNameFromReg = useMemo(() => {
        const fn = regForm.first_name.trim();
        const ln = regForm.last_name.trim();
        return [fn, ln].filter(Boolean).join(" ");
    }, [regForm.first_name, regForm.last_name]);

    const isEmailAlreadyRegisteredError = (err) => {
        const m = String(err?.message || "").toLowerCase();
        return (
            m.includes("already registered") ||
            m.includes("already exists") ||
            m.includes("user already") ||
            m.includes("email already") ||
            m.includes("duplicate") ||
            m.includes("unique constraint") ||
            m.includes("duplicate key")
        );
    };

    async function upsertProfile(userId, firstName, lastName, phone) {
        const full_name = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ").trim();

        const payload = {
            user_id: userId,
            first_name: firstName?.trim() || "",
            last_name: lastName?.trim() || "",
            full_name: full_name || "",
            phone: phone || "",
            notes: null,
        };

        const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
        if (error) throw error;
    }

    async function redirectByRoleSafe(userId) {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("role-timeout")), 4000)
        );

        try {
            const roleFetch = supabase
                .from("profiles")
                .select("is_admin")
                .eq("user_id", userId)
                .single();

            const { data: prof } = await Promise.race([roleFetch, timeout]);

            if (prof?.is_admin) navigate("/admin/dashboard", { replace: true });
            else navigate("/home", { replace: true });
        } catch (e) {
            navigate("/home", { replace: true });
        }
    }

    useEffect(() => {
        let alive = true;

        const go = async (userId) => {
            if (!alive) return;

            setPageState("redirecting");

            redirectByRoleSafe(userId);
        };

        const check = async () => {
            try {
                const { data, error } = await supabase.auth.getSession();
                if (!alive) return;

                if (error) {
                    setPageState("ready");
                    return;
                }

                const userId = data?.session?.user?.id;
                if (userId) {
                    go(userId);
                    return;
                }

                setPageState("ready");
            } catch {
                if (alive) setPageState("ready");
            }
        };

        check();

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            const userId = session?.user?.id;
            if (userId) go(userId);
        });

        return () => {
            alive = false;
            listener?.subscription?.unsubscribe();
        };
    }, [navigate]);

    const title = useMemo(
        () => (activeTab === "login" ? "Welcome Back" : "Get Started"),
        [activeTab]
    );

    const tabBtn = (isActive) =>
        [
            "relative pb-3 font-medium text-sm md:text-base transition-colors duration-200 cursor-pointer",
            isActive
                ? "text-gray-900 after:absolute after:left-0 after:bottom-0 after:w-full after:h-[2px] after:bg-gray-900"
                : "text-gray-500 hover:text-gray-700",
        ].join(" ");

    const inputClass =
        "w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-black focus:border-black block w-full p-2.5 transition-colors duration-200";

    const labelClass = "block mb-2 text-sm font-medium text-gray-900";

    async function onSubmitLogin(e) {
        e.preventDefault();
        setMsg({ type: "", text: "" });
        setLoading(true);

        try {
            const email = loginForm.email.trim();
            if (!isValidEmail(email)) throw new Error("Please enter a valid email (must include @).");

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: loginForm.password,
            });

            if (error) throw error;

            const u = data?.user;
            if (u?.id) {
                const metaFirst =
                    u.user_metadata?.first_name ||
                    (u.user_metadata?.full_name || "").split(" ").slice(0, -1).join(" ") ||
                    "";
                const metaLast =
                    u.user_metadata?.last_name ||
                    (u.user_metadata?.full_name || "").split(" ").slice(-1).join(" ") ||
                    "";
                const metaPhone = u.user_metadata?.phone || "";

                await upsertProfile(u.id, metaFirst, metaLast, metaPhone);

                setPageState("redirecting");
                redirectByRoleSafe(u.id);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || "Login failed.");
        } finally {
            setLoading(false);
        }
    }

    async function onSubmitRegister(e) {
        e.preventDefault();
        setMsg({ type: "", text: "" });

        const first = regForm.first_name.trim();
        const last = regForm.last_name.trim();
        const email = regForm.email.trim();
        const phone = cleanPhoneDigits(regForm.phone);

        if (!first) return setError("First name is required.");
        if (!last) return setError("Last name is required.");
        if (!isValidEmail(email)) return setError("Please enter a valid email (must include @).");
        if (!isValidPHPhone11(phone)) return setError("Phone must be exactly 11 digits (numbers only).");
        if (regForm.password !== regForm.confirm) return setError("Passwords do not match.");
        if (!regForm.agree) return setError("Please agree to the Terms.");

        setLoading(true);

        try {
            const emailRedirectTo = `${window.location.origin}/auth/callback`;

            const { data, error } = await supabase.auth.signUp({
                email,
                password: regForm.password,
                options: {
                    emailRedirectTo,
                    data: {
                        first_name: first,
                        last_name: last,
                        full_name: `${first} ${last}`,
                        phone,
                    },
                },
            });

            if (error) {
                if (isEmailAlreadyRegisteredError(error)) {
                    setError("Email is already registered. Please log in instead.");
                    setActiveTab("login");
                    setLoginForm((p) => ({ ...p, email }));
                    return;
                }
                throw error;
            }

            const identities = data?.user?.identities ?? [];
            if (data?.user && identities.length === 0) {
                setError("Email is already registered. Please log in instead.");
                setActiveTab("login");
                setLoginForm((p) => ({ ...p, email }));
                return;
            }

            if (!data.session) {
                setSuccess("Registered! Please check your email to confirm your account.");
                return;
            }

            if (data?.user?.id) {
                await upsertProfile(data.user.id, first, last, phone);
                setPageState("redirecting");
                redirectByRoleSafe(data.user.id);
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

        if (!regForm.email) {
            setError("Enter your email first (in the register email field).");
            return;
        }

        setLoading(true);
        try {
            const emailRedirectTo = `${window.location.origin}/auth/callback`;

            const { error } = await supabase.auth.resend({
                type: "signup",
                email: regForm.email.trim(),
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

    if (pageState === "checking" || pageState === "redirecting") {
        return (
            <div className="min-h-screen grid place-items-center bg-gray-50">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
                    <div className="text-gray-600 font-medium text-lg">
                        {pageState === "checking" ? "Verifying session..." : "Redirecting..."}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 md:p-8 relative">

            {showTerms && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all duration-300">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-[fadeIn_0.2s_ease-out]">

                        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">
                                Terms and Conditions
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowTerms(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-200 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-5 text-sm text-gray-600 leading-relaxed">
                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">1. Introduction</h4>
                                <p>Welcome to <strong>Crispy Pata sa A.Luna</strong>. By accessing our website and placing an order, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our services.</p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">2. Ordering & Availability</h4>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>All orders are subject to acceptance and availability.</li>
                                    <li>We reserve the right to refuse service to anyone for any reason at any time.</li>
                                    <li>Items in your cart are not reserved until the order is successfully placed.</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">3. Pricing & Payment</h4>
                                <p>Prices for our products are subject to change without notice. We accept payments via the methods indicated on our checkout page. You agree to provide current, complete, and accurate purchase and account information for all purchases made.</p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">4. Cancellations & Refunds</h4>
                                <p>Orders cannot be cancelled once food preparation has begun. Refunds or replacements are only issued for incorrect or defective items reported immediately upon receipt. Please inspect your order upon delivery.</p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">5. Privacy Policy</h4>
                                <p>Your submission of personal information through the store is governed by our Privacy Policy. We collect your name, phone number, and email solely for the purpose of processing your orders and contacting you regarding your transaction.</p>
                            </div>
                        </div>

                        <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowTerms(false)}
                                className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-black transition-colors shadow-sm cursor-pointer"
                            >
                                I Understand
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white w-full max-w-6xl rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row h-full md:h-auto min-h-150">
                <div className="hidden md:block w-1/2 bg-gray-900 relative">
                    <div className="absolute inset-0">
                        <img
                            src="/pataXXL.jpg"
                            alt="Crispy Pata"
                            className="w-full h-full object-cover opacity-60"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    </div>
                    <div className="relative z-10 p-12 flex flex-col h-full justify-between text-white">
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <span className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></span>
                                <span className="text-sm font-medium tracking-wide uppercase opacity-90">Open for Orders</span>
                            </div>
                            <h2 className="text-4xl font-bold leading-tight mb-4">Crispy Pata sa A.Luna</h2>
                            <p className="text-lg text-gray-200 leading-relaxed max-w-md">
                                Experience the crispiest, most flavorful pata in town. Order now and satisfy your cravings.
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <NavLink
                                to="/menu"
                                className="px-6 py-2.5 bg-white text-gray-900 rounded-full font-semibold hover:bg-gray-100 transition-colors duration-200 text-sm"
                            >
                                View Menu
                            </NavLink>
                            <NavLink
                                to="/"
                                className="px-6 py-2.5 border border-white/30 text-white rounded-full font-semibold hover:bg-white/10 transition-colors duration-200 text-sm"
                            >
                                Home
                            </NavLink>
                        </div>
                    </div>
                </div>

                <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white">
                    <div className="max-w-md w-full mx-auto">
                        <div className="md:hidden mb-8 text-center">
                            <h1 className="text-2xl font-bold text-gray-900">Crispy Pata sa A.Luna</h1>
                        </div>

                        <div className="flex space-x-8 border-b border-gray-200 mb-8">
                            <button
                                className={tabBtn(activeTab === "login")}
                                onClick={() => {
                                    setMsg({ type: "", text: "" });
                                    setActiveTab("login");
                                }}
                            >
                                Log In
                            </button>
                            <button
                                className={tabBtn(activeTab === "register")}
                                onClick={() => {
                                    setMsg({ type: "", text: "" });
                                    setActiveTab("register");
                                }}
                            >
                                Sign Up
                            </button>
                        </div>

                        <div className="mb-8">
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
                            <p className="text-gray-500">
                                {activeTab === "login"
                                    ? "Welcome back! Please enter your details."
                                    : "Create an account to start ordering."}
                            </p>
                        </div>

                        {msg.text && (
                            <div
                                className={`p-4 mb-6 text-sm rounded-lg flex items-start gap-3 ${msg.type === "error"
                                    ? "text-red-800 bg-red-50 border border-red-100"
                                    : "text-green-800 bg-green-50 border border-green-100"
                                    }`}
                                role="alert"
                            >
                                <i className={`fa-solid ${msg.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} mt-0.5`}></i>
                                <span>{msg.text}</span>
                            </div>
                        )}

                        {activeTab === "login" && (
                            <form onSubmit={onSubmitLogin} className="space-y-5">
                                <div>
                                    <label htmlFor="email" className={labelClass}>
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        className={inputClass}
                                        placeholder="Email"
                                        required
                                        value={loginForm.email}
                                        onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label htmlFor="password" className="block text-sm font-medium text-gray-900">
                                            Password
                                        </label>
                                        <NavLink
                                            to="/forgot-password"
                                            className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline"
                                        >
                                            Forgot password?
                                        </NavLink>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type={showLoginPw ? "text" : "password"}
                                            id="password"
                                            className={`${inputClass} pr-10`}
                                            placeholder="••••••••"
                                            required
                                            value={loginForm.password}
                                            onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 cursor-pointer"
                                            onClick={() => setShowLoginPw(!showLoginPw)}
                                        >
                                            <i className={`fa-regular ${showLoginPw ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full text-white bg-gray-900 hover:bg-black focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform active:scale-[0.99] cursor-pointer"
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Signing in...</span>
                                        </div>
                                    ) : (
                                        "Sign in"
                                    )}
                                </button>
                            </form>
                        )}

                        {activeTab === "register" && (
                            <form onSubmit={onSubmitRegister} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="first_name" className={labelClass}>
                                            First Name
                                        </label>
                                        <input
                                            type="text"
                                            id="first_name"
                                            className={inputClass}
                                            placeholder="Juan"
                                            required
                                            value={regForm.first_name}
                                            onChange={(e) => setRegForm((p) => ({ ...p, first_name: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="last_name" className={labelClass}>
                                            Last Name
                                        </label>
                                        <input
                                            type="text"
                                            id="last_name"
                                            className={inputClass}
                                            placeholder="Dela Cruz"
                                            required
                                            value={regForm.last_name}
                                            onChange={(e) => setRegForm((p) => ({ ...p, last_name: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="phone" className={labelClass}>
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        id="phone"
                                        className={inputClass}
                                        placeholder="09XXXXXXXXX"
                                        maxLength={11}
                                        required
                                        value={regForm.phone}
                                        onChange={(e) => setRegForm((p) => ({ ...p, phone: cleanPhoneDigits(e.target.value) }))}
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Format: 11 digits (e.g., 09171234567)</p>
                                </div>

                                <div>
                                    <label htmlFor="reg-email" className={labelClass}>
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        id="reg-email"
                                        className={inputClass}
                                        placeholder="Email"
                                        required
                                        value={regForm.email}
                                        onChange={(e) => setRegForm((p) => ({ ...p, email: e.target.value }))}
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="reg-password" className={labelClass}>
                                            Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showRegPw ? "text" : "password"}
                                                id="reg-password"
                                                className={`${inputClass} pr-10`}
                                                placeholder="••••••••"
                                                required
                                                value={regForm.password}
                                                onChange={(e) => setRegForm((p) => ({ ...p, password: e.target.value }))}
                                            />
                                            <button
                                                type="button"
                                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 cursor-pointer"
                                                onClick={() => setShowRegPw(!showRegPw)}
                                            >
                                                <i className={`fa-regular ${showRegPw ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="confirm-password" className={labelClass}>
                                            Confirm
                                        </label>
                                        <input
                                            type={showRegPw ? "text" : "password"}
                                            id="confirm-password"
                                            className={inputClass}
                                            placeholder="••••••••"
                                            required
                                            value={regForm.confirm}
                                            onChange={(e) => setRegForm((p) => ({ ...p, confirm: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-start">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="terms"
                                            type="checkbox"
                                            className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-primary-300 accent-black"
                                            required
                                            checked={regForm.agree}
                                            onChange={(e) => setRegForm((p) => ({ ...p, agree: e.target.checked }))}
                                        />
                                    </div>
                                    <label htmlFor="terms" className="ml-2 text-sm font-medium text-gray-900">
                                        I agree with the{" "}
                                        <button
                                            type="button"
                                            className="text-black hover:underline font-bold cursor-pointer"
                                            onClick={() => setShowTerms(true)}
                                        >
                                            Terms and Conditions
                                        </button>
                                    </label>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full text-white bg-gray-900 hover:bg-black focus:ring-4 focus:outline-none focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform active:scale-[0.99] cursor-pointer"
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Creating account...</span>
                                        </div>
                                    ) : (
                                        "Create account"
                                    )}
                                </button>

                                <div className="text-center mt-4">
                                    <button
                                        type="button"
                                        onClick={resendConfirmation}
                                        disabled={loading}
                                        className="text-sm text-gray-500 hover:text-gray-900 hover:underline transition-colors duration-200 cursor-pointer"
                                    >
                                        Didn't receive confirmation email? Resend
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;