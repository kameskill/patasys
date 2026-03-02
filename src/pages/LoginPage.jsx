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

    const [otpSent, setOtpSent] = useState(false);
    const [generatedOtp, setGeneratedOtp] = useState("");
    const [enteredOtp, setEnteredOtp] = useState("");
    const [resendTimer, setResendTimer] = useState(0);

    const setError = (text) => setMsg({ type: "error", text });
    const setSuccess = (text) => setMsg({ type: "success", text });

    const isValidEmail = (email) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());

    const cleanPhone10 = (v) => String(v || "").replace(/\D/g, "").slice(0, 10);

    const isValidPassword = (password) => {
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const isValidLength = password.length >= 8;
        return hasUpper && hasNumber && hasSpecial && isValidLength;
    };

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
            is_banned: false
        };

        const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "user_id" });
        if (error) throw error;
    }

    useEffect(() => {
        let alive = true;

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
                    const { data: prof } = await supabase
                        .from("profiles")
                        .select("is_banned, is_admin")
                        .eq("user_id", userId)
                        .maybeSingle();

                    if (prof?.is_banned) {
                        await supabase.auth.signOut();
                        setError("Your account has been banned. Please contact support.");
                        setPageState("ready");
                        return;
                    }

                    setPageState("redirecting");
                    if (prof?.is_admin) {
                        navigate("/admin/dashboard", { replace: true });
                    } else {
                        navigate("/home", { replace: true });
                    }
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
            if (userId) check();
        });

        return () => {
            alive = false;
            listener?.subscription?.unsubscribe();
        };
    }, [navigate]);

    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const formatTimer = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = String(seconds % 60).padStart(2, '0');
        return `${m}:${s}`;
    };

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
                const { data: prof, error: profError } = await supabase
                    .from("profiles")
                    .select("is_banned, is_admin")
                    .eq("user_id", u.id)
                    .maybeSingle();

                if (prof?.is_banned) {
                    await supabase.auth.signOut();
                    throw new Error("Your account has been banned. Please contact support.");
                }

                if (!prof && !profError) {
                    const metaFirst = u.user_metadata?.first_name || (u.user_metadata?.full_name || "").split(" ").slice(0, -1).join(" ") || "";
                    const metaLast = u.user_metadata?.last_name || (u.user_metadata?.full_name || "").split(" ").slice(-1).join(" ") || "";
                    const metaPhone = u.user_metadata?.phone || "";
                    await upsertProfile(u.id, metaFirst, metaLast, metaPhone);
                }

                setPageState("redirecting");
                if (prof?.is_admin) {
                    navigate("/admin/dashboard", { replace: true });
                } else {
                    navigate("/home", { replace: true });
                }
            }
        } catch (err) {
            setError(err.message || "Login failed.");
        } finally {
            setLoading(false);
        }
    }

    const sendOtp = async (e) => {
        if (e) e.preventDefault();
        setMsg({ type: "", text: "" });

        const first = regForm.first_name.trim();
        const last = regForm.last_name.trim();
        const email = regForm.email.trim();
        const phone = regForm.phone.trim();

        if (!first) return setError("First name is required.");
        if (!last) return setError("Last name is required.");
        if (!isValidEmail(email)) return setError("Please enter a valid email.");
        if (phone.length !== 10 || !phone.startsWith("9")) return setError("Phone must be exactly 10 digits and start with 9.");
        if (!isValidPassword(regForm.password)) return setError("Password must be at least 8 characters long, include an uppercase letter, a number, and a special character.");
        if (regForm.password !== regForm.confirm) return setError("Passwords do not match.");
        if (!regForm.agree) return setError("Please agree to the Terms.");

        setLoading(true);

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedOtp(otpCode);

        const formattedPhone = "+63" + phone;

        const apiKey = import.meta.env.VITE_TEXTBEE_API_KEY;
        const deviceId = import.meta.env.VITE_TEXTBEE_DEVICE_ID;

        if (!apiKey || !deviceId) {
            setLoading(false);
            return setError("API Key or Device ID is missing in environment variables.");
        }

        try {
            const response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey
                },
                body: JSON.stringify({
                    recipients: [formattedPhone],
                    message: `Crispy Pata sa A. Luna: Your verification code is ${otpCode}. Do not share this with anyone.`
                })
            });

            if (!response.ok) {
                throw new Error("API Request Failed");
            }

            setOtpSent(true);
            setResendTimer(300);
        } catch (err) {
            setError("Failed to send code. Please check your Textbee API Key and Device ID.");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setMsg({ type: "", text: "" });
        setLoading(true);

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedOtp(otpCode);

        const formattedPhone = "+63" + regForm.phone.trim();

        const apiKey = import.meta.env.VITE_TEXTBEE_API_KEY;
        const deviceId = import.meta.env.VITE_TEXTBEE_DEVICE_ID;

        try {
            const response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey
                },
                body: JSON.stringify({
                    recipients: [formattedPhone],
                    message: `Crispy Pata sa A.Luna: Your NEW verification code is ${otpCode}. Do not share this with anyone.`
                })
            });

            if (!response.ok) {
                throw new Error("API Request Failed");
            }

            setSuccess("Verification code resent successfully.");
            setResendTimer(300);
        } catch (err) {
            setError("Failed to resend code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const verifyAndCreateAccount = async (e) => {
        e.preventDefault();
        setMsg({ type: "", text: "" });
        setLoading(true);

        if (enteredOtp !== generatedOtp) {
            setError("Invalid verification code.");
            setLoading(false);
            return;
        }

        const first = regForm.first_name.trim();
        const last = regForm.last_name.trim();
        const email = regForm.email.trim();
        const formattedPhone = "+63" + regForm.phone.trim();

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password: regForm.password,
                options: {
                    data: {
                        first_name: first,
                        last_name: last,
                        full_name: `${first} ${last}`,
                        phone: formattedPhone,
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

            if (data?.user?.id) {
                await upsertProfile(data.user.id, first, last, formattedPhone);
                setPageState("redirecting");
                const { data: prof } = await supabase.from("profiles").select("is_admin").eq("user_id", data.user.id).single();
                if (prof?.is_admin) navigate("/admin/dashboard", { replace: true });
                else navigate("/home", { replace: true });
            }
        } catch (err) {
            setError(err.message || "Register failed.");
        } finally {
            setLoading(false);
        }
    };

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

                        <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-600 leading-relaxed">
                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">1. Introduction</h4>
                                <p>
                                    Welcome to <strong>Crispy Pata sa A. Luna</strong>. By accessing our website and placing an order,
                                    you agree to comply with and be bound by the following Terms and Conditions.
                                    If you do not agree with these terms, please refrain from using our system.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">2. Nature of Service</h4>
                                <p>
                                    This system is strictly for <strong>pickup orders only</strong>.
                                    We do not provide delivery services. Customers are responsible
                                    for personally claiming their orders at our store location.
                                </p>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-gray-400">
                                    <li>No delivery or shipping services are offered.</li>
                                    <li>Customers must pick up orders within the agreed pickup time.</li>
                                    <li>Failure to claim orders on time may result in food quality deterioration, for which we are not liable.</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">3. Ordering & Acceptance</h4>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-gray-400">
                                    <li>All orders are subject to confirmation and availability.</li>
                                    <li>Submission of an order does not automatically guarantee acceptance.</li>
                                    <li>We reserve the right to refuse or cancel any order at our discretion.</li>
                                    <li>Items added to cart are not reserved until checkout is completed.</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">4. Pricing & Payment</h4>
                                <p>
                                    All prices are listed in Philippine Peso (PHP) and may change without prior notice.
                                    Customers agree to provide accurate and complete payment information.
                                </p>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-gray-400">
                                    <li>Orders will only be processed once payment is confirmed (for online payments).</li>
                                    <li>We are not responsible for payment delays caused by third-party payment providers.</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">5. Cancellations & Refund Policy</h4>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-gray-400">
                                    <li>Orders cannot be cancelled once food preparation has started.</li>
                                    <li>Refunds are only applicable for incorrect or missing items.</li>
                                    <li>Concerns must be reported immediately upon pickup.</li>
                                    <li>No refunds will be issued for failure to pick up orders.</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">6. Limitation of Liability</h4>
                                <p>
                                    We are not liable for delays caused by unforeseen circumstances, system errors,
                                    force majeure events, or customer-provided incorrect information.
                                </p>
                                <p>
                                    Once the order has been picked up, responsibility transfers to the customer.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">7. User Responsibilities</h4>
                                <ul className="list-disc pl-5 space-y-1.5 marker:text-gray-400">
                                    <li>Provide accurate contact details.</li>
                                    <li>Arrive on time for pickup.</li>
                                    <li>Present valid proof of order upon claiming.</li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-gray-900 text-base">8. Privacy Policy</h4>
                                <p>
                                    We collect personal information such as name, phone number, and email
                                    solely for order processing and communication purposes.
                                    We do not sell or share customer data with third parties except
                                    as required for payment processing or legal compliance.
                                </p>
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
                        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
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
                                    setOtpSent(false);
                                    setResendTimer(0);
                                }}
                            >
                                Log In
                            </button>
                            <button
                                className={tabBtn(activeTab === "register")}
                                onClick={() => {
                                    setMsg({ type: "", text: "" });
                                    setActiveTab("register");
                                    setOtpSent(false);
                                    setResendTimer(0);
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

                        {activeTab === "register" && !otpSent && (
                            <form onSubmit={sendOtp} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="first_name" className={labelClass}>
                                            First Name
                                        </label>
                                        <input
                                            type="text"
                                            id="first_name"
                                            className={inputClass}
                                            placeholder="First Name"
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
                                            placeholder="Last Name"
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
                                    <div className="flex shadow-sm rounded-lg">
                                        <span className="inline-flex items-center px-4 text-sm text-gray-900 bg-gray-100 border border-r-0 border-gray-300 rounded-l-lg font-bold">
                                            +63
                                        </span>
                                        <input
                                            type="tel"
                                            id="phone"
                                            className="rounded-none rounded-r-lg bg-gray-50 border border-gray-300 text-gray-900 focus:ring-black focus:border-black block flex-1 min-w-0 w-full text-sm p-2.5 outline-none transition-colors duration-200"
                                            placeholder="9XXXXXXXXX"
                                            maxLength={10}
                                            required
                                            value={regForm.phone}
                                            onChange={(e) => setRegForm((p) => ({ ...p, phone: cleanPhone10(e.target.value) }))}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">Enter the remaining 10 digits (e.g., 9171234567)</p>
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
                                        <p className="mt-1 text-[11px] text-gray-500">Min 8 chars, 1 uppercase, 1 number, 1 special char.</p>
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

                                <div className="flex items-start pt-1">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="terms"
                                            type="checkbox"
                                            className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-primary-300 accent-black cursor-pointer"
                                            required
                                            checked={regForm.agree}
                                            onChange={(e) => setRegForm((p) => ({ ...p, agree: e.target.checked }))}
                                        />
                                    </div>
                                    <label htmlFor="terms" className="ml-2 text-sm font-medium text-gray-900 cursor-pointer">
                                        I agree with the{" "}
                                        <button
                                            type="button"
                                            className="text-black hover:underline font-bold cursor-pointer"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setShowTerms(true);
                                            }}
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
                                            <span>Sending Code...</span>
                                        </div>
                                    ) : (
                                        "Send Verification Code"
                                    )}
                                </button>
                            </form>
                        )}

                        {activeTab === "register" && otpSent && (
                            <form onSubmit={verifyAndCreateAccount} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-blue-50 text-black rounded-full flex items-center justify-center mx-auto mb-4">
                                        <i className="fa-solid fa-comment-sms text-4xl"></i>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-1">We sent a verification code to</p>
                                    <p className="font-bold text-xl text-gray-900 tracking-wider">
                                        {`+63 ${regForm.phone.slice(0, 3)} **** ${regForm.phone.slice(-3)}`}
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-2 text-center text-gray-700">Enter 6-Digit Code</label>
                                    <input
                                        required
                                        type="text"
                                        maxLength="6"
                                        value={enteredOtp}
                                        onChange={e => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                                        className="w-full border-2 border-gray-300 rounded-xl px-4 py-4 text-center text-3xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-colors"
                                        placeholder="------"
                                    />
                                </div>
                                <div className="flex flex-col gap-3 pt-2">
                                    <button
                                        disabled={loading || enteredOtp.length !== 6}
                                        type="submit"
                                        className="w-full bg-black text-white py-3.5 rounded-xl font-bold text-base hover:bg-gray-800 disabled:opacity-50 transition-all cursor-pointer shadow-md active:scale-[0.99]"
                                    >
                                        {loading ? "Verifying..." : "Verify & Create Account"}
                                    </button>

                                    <div className="flex items-center justify-between mt-2 px-1">
                                        <button
                                            type="button"
                                            onClick={handleResendOtp}
                                            disabled={loading || resendTimer > 0}
                                            className="text-sm font-semibold text-gray-700 hover:text-black hover:underline transition-colors cursor-pointer disabled:opacity-50 disabled:no-underline"
                                        >
                                            {resendTimer > 0 ? `Resend Code (${formatTimer(resendTimer)})` : "Resend Code"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOtpSent(false);
                                                setEnteredOtp("");
                                                setResendTimer(0);
                                            }}
                                            className="text-sm font-semibold text-gray-500 hover:text-black transition-colors cursor-pointer"
                                        >
                                            Change Phone Number
                                        </button>
                                    </div>
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