import React, { useEffect, useMemo, useState } from "react";
import supabase from "../config/Client";
import { useCart } from "../context/Cart";
import MenuCard from "../components/MenuCard";
import MenuItemModal from "../components/MenuItemModal";
import { useNavigate } from "react-router-dom";

const COOKING_TIME = {
    "Crispy Pata XXL": 20,
    "Crispy Pata XL": 20,
    "Crispy Pata L": 20,
    "Crispy Liempo": 15,
    "Fried Chicken": 15,
    "Pork Lumpia": 10,
    "Crispy Ulo": 25,
    "Pork Belly": 20,
    "Chicharon Bulaklak": 15
};

const KAWALI_CAPACITY = 4;

function estimateCookingTime(cartItems) {
    if (!cartItems || cartItems.length === 0) return 0;
    let times = [];
    cartItems.forEach(item => {
        const time = COOKING_TIME[item.name] || 15;
        for (let i = 0; i < item.quantity; i++) {
            times.push(time);
        }
    });
    times.sort((a, b) => b - a);
    let total = 0;
    while (times.length > 0) {
        const batch = times.splice(0, KAWALI_CAPACITY);
        total += Math.max(...batch);
    }
    return total;
}

function Home() {
    const navigate = useNavigate();

    const {
        cart,
        setCart,
        addToCart,
        decreaseQty,
        removeFromCart,
        clearCart,
        totalPrice,
    } = useCart();

    const [user, setUser] = useState(null);
    const [active, setActive] = useState("menu");

    const [orderTab, setOrderTab] = useState("active");
    const [cancellingId, setCancellingId] = useState(null);

    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState(null);

    const [menu, setMenu] = useState([]);
    const [loadingMenu, setLoadingMenu] = useState(true);

    const [orders, setOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const [notifications, setNotifications] = useState([]);
    const [showNotifs, setShowNotifs] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const [placing, setPlacing] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });

    const [modalOpen, setModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const [selectedOrder, setSelectedOrder] = useState(null);

    const PICKUP_ADDRESS = "124 F.Vergel Concepcion Baliuag Bulacan (Pickup Only)";
    const PHONE_NUMBER = "(+63) 913 456 7890";

    const [profile, setProfile] = useState({
        full_name: "",
        phone: "",
        is_blocked: false,
    });

    const [editProfile, setEditProfile] = useState({
        full_name: "",
        phone: "",
        email: ""
    });
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const [loadingProfile, setLoadingProfile] = useState(true);
    const [isProfileLoaded, setIsProfileLoaded] = useState(false);

    const [checkout, setCheckout] = useState({
        phone: "",
        notes: "",
        payment: "pickup",
    });

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showPw, setShowPw] = useState(false);

    const setError = (text) => setMsg({ type: "error", text });
    const setSuccess = (text) => setMsg({ type: "success", text });

    const cleanPhone10 = (v) => String(v || "").replace(/\D/g, "").slice(0, 10);
    const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const menuImageMap = useMemo(() => {
        const map = {};
        menu.forEach(item => {
            map[item.id] = item.image_url;
        });
        return map;
    }, [menu]);

    useEffect(() => {
        if (msg.text) {
            const timer = setTimeout(() => {
                setMsg({ type: "", text: "" });
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [msg]);

    const getFullNameFromUser = (u) => {
        const first = u?.user_metadata?.first_name || u?.user_metadata?.firstname || "";
        const last = u?.user_metadata?.last_name || u?.user_metadata?.lastname || "";
        const combined = `${first} ${last}`.trim();
        return combined || u?.user_metadata?.full_name || u?.email || "";
    };

    const cartBadgeCount = useMemo(
        () => cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        [cart]
    );

    const itemsPayload = useMemo(
        () =>
            cart.map((item) => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity === "" ? 1 : Number(item.quantity),
                image_url: item.image_url
            })),
        [cart]
    );

    const estimatedCookingTime = useMemo(() => {
        return estimateCookingTime(cart);
    }, [cart]);

    const fillCheckoutFromProfile = (p) => {
        setCheckout((prev) => ({
            ...prev,
            phone: prev.phone?.trim() ? prev.phone : p.phone?.replace("+63", "") || "",
        }));
    };

    const handleQuantityChange = (id, val) => {
        const numericVal = val.replace(/\D/g, '');
        const menuItem = menu.find(m => m.id === id);
        const maxStock = menuItem ? menuItem.stock_quantity : 999;

        setCart(prev => prev.map(item => {
            if (item.id === id) {
                if (numericVal === "") return { ...item, quantity: "" };
                let num = parseInt(numericVal, 10);
                if (num > maxStock) num = maxStock;
                return { ...item, quantity: num };
            }
            return item;
        }));
    };

    const handleQuantityBlur = (id, val) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                if (val === "" || Number(val) <= 0 || isNaN(Number(val))) {
                    return { ...item, quantity: 1 };
                }
            }
            return item;
        }));
    };

    const handleIncreaseCartQty = (id) => {
        const menuItem = menu.find(m => m.id === id);
        const maxStock = menuItem ? menuItem.stock_quantity : 999;

        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = (Number(item.quantity) || 1) + 1;
                return { ...item, quantity: newQty > maxStock ? maxStock : newQty };
            }
            return item;
        }));
    };

    const fetchNotificationsManual = async (userId) => {
        try {
            const { data, error } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (error) return;

            if (!data || data.length === 0) {
                const welcomeNotif = {
                    id: "temp-" + Date.now(),
                    user_id: userId,
                    title: "Welcome to A.Luna!",
                    message: "We're glad you're here. Browse our menu and place your first crispy pata order today!",
                    is_read: false,
                    created_at: new Date().toISOString()
                };

                setNotifications([welcomeNotif]);
                setUnreadCount(1);

                await supabase.from("notifications").insert([{
                    user_id: userId,
                    title: welcomeNotif.title,
                    message: welcomeNotif.message,
                    is_read: false
                }]);
            } else {
                setNotifications(data);
                setUnreadCount(data.filter((n) => !n.is_read).length);
            }
        } catch (err) { }
    };

    useEffect(() => {
        const loadInitialData = async () => {
            const { data: { user: u } } = await supabase.auth.getUser();
            if (!u) {
                navigate("/login");
                return;
            }
            setUser(u);

            const { data: prof, error: profError } = await supabase
                .from("profiles")
                .select("full_name, phone, cart_data, is_admin, is_blocked, is_banned")
                .eq("user_id", u.id)
                .maybeSingle();

            if (prof?.is_banned) {
                await supabase.auth.signOut();
                navigate("/");
                return;
            }
            if (prof?.is_admin) {
                navigate("/admin/dashboard", { replace: true });
                return;
            }

            if (!prof && !profError) {
                const fullName = getFullNameFromUser(u);
                await supabase.from("profiles").insert([{
                    user_id: u.id,
                    full_name: fullName,
                    phone: u.user_metadata?.phone || "",
                    cart_data: [],
                    is_blocked: false,
                    is_banned: false
                }]);
                setProfile({
                    full_name: fullName,
                    phone: u.user_metadata?.phone || "",
                    is_blocked: false,
                });
                setEditProfile({
                    full_name: fullName,
                    phone: (u.user_metadata?.phone || "").replace("+63", ""),
                    email: u.email || ""
                });
            } else if (prof) {
                setProfile({
                    full_name: prof.full_name || "",
                    phone: prof.phone || "",
                    is_blocked: prof.is_blocked || false,
                });
                setEditProfile({
                    full_name: prof.full_name || "",
                    phone: (prof.phone || "").replace("+63", ""),
                    email: u.email || ""
                });
                fillCheckoutFromProfile(prof);
                if (prof.cart_data && Array.isArray(prof.cart_data) && prof.cart_data.length > 0) {
                    setCart(prof.cart_data);
                }
            }
            setIsProfileLoaded(true);
            setLoadingProfile(false);

            setLoadingMenu(true);
            const { data: menuData } = await supabase.from("menu_items").select("*").order("id", { ascending: true });
            if (menuData) setMenu(menuData);
            setLoadingMenu(false);

            const { data: orderData } = await supabase.from("orders").select("*").eq("user_id", u.id).order("created_at", { ascending: false });
            if (orderData) setOrders(orderData);
            await fetchNotificationsManual(u.id);
        };

        loadInitialData();
    }, [navigate, setCart]);

    useEffect(() => {
        if (!user?.id) return;

        const channel = supabase.channel(`home_realtime_${user.id}`);

        channel
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, (payload) => {
                setMenu((prevMenu) => prevMenu.map((item) =>
                    item.id === payload.new.id ? { ...item, ...payload.new } : item
                ));
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
                setNotifications((prev) => {
                    if (prev.some(n => n.id === payload.new.id)) return prev;
                    setUnreadCount(count => count + 1);
                    return [payload.new, ...prev];
                });
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, (payload) => {
                setOrders((prev) => prev.map((o) => (o.id === payload.new.id ? payload.new : o)));
                fetchNotificationsManual(user.id);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${user.id}` }, (payload) => {
                if (payload.new.is_banned) {
                    supabase.auth.signOut().then(() => navigate("/"));
                    return;
                }
                if ('is_blocked' in payload.new) {
                    setProfile(p => {
                        if (payload.new.is_blocked === true && p.is_blocked === false) {
                            setError("Your account has been restricted from placing orders.");
                        } else if (payload.new.is_blocked === false && p.is_blocked === true) {
                            setSuccess("Your account restriction has been lifted!");
                        }
                        return { ...p, is_blocked: payload.new.is_blocked };
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, navigate]);

    useEffect(() => {
        if (!user || !isProfileLoaded) return;
        const timer = setTimeout(async () => {
            try {
                await supabase.from("profiles").update({ cart_data: itemsPayload }).eq("user_id", user.id);
            } catch (err) { }
        }, 2000);
        return () => clearTimeout(timer);
    }, [itemsPayload, user, isProfileLoaded]);

    const markAsRead = async (notifId) => {
        try {
            const targetNotif = notifications.find(n => n.id === notifId);
            if (targetNotif && !targetNotif.is_read) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
            }
            setNotifications((prev) =>
                prev.map((n) => (n.id === notifId ? { ...n, is_read: true } : n))
            );

            if (notifId && !String(notifId).startsWith("temp-")) {
                await supabase.from("notifications").update({ is_read: true }).eq("id", notifId);
            }
        } catch (error) { }
    };

    const markAllAsRead = async () => {
        if (unreadCount === 0) return;

        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);

        const ids = notifications.filter(n => !n.is_read && !String(n.id).startsWith("temp-")).map(n => n.id);

        if (ids.length > 0) {
            await supabase.from("notifications").update({ is_read: true }).in("id", ids);
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    const setTab = async (id) => {
        setMsg({ type: "", text: "" });
        setActive(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (id === "orders") {
            setLoadingOrders(true);
            const { data } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
            setOrders(data || []);
            setLoadingOrders(false);
        }
        if (id === "cart") {
            fillCheckoutFromProfile(profile);
        }
    };

    const handleSaveProfile = async () => {
        if (!editProfile.email.trim()) return setError("Email cannot be empty.");
        if (editProfile.phone.length !== 10 || !editProfile.phone.startsWith("9")) {
            return setError("Phone must be exactly 10 digits and start with 9.");
        }

        setIsSavingProfile(true);
        const formattedPhone = "+63" + editProfile.phone;

        try {
            if (editProfile.email !== user.email) {
                const { error: updateError } = await supabase.auth.updateUser({ email: editProfile.email });
                if (updateError) throw updateError;
                setSuccess("Please check your new email to confirm the change.");
            }

            const { error } = await supabase
                .from("profiles")
                .update({ phone: formattedPhone })
                .eq("user_id", user.id);

            if (error) throw error;

            setProfile(prev => ({ ...prev, phone: formattedPhone }));
            if (editProfile.email === user.email) {
                setSuccess("Profile updated successfully.");
            }
        } catch (err) {
            setError(err.message || "Failed to update profile.");
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setMsg({ type: "", text: "" });

        if (newPassword !== confirmNewPassword) {
            return setError("New passwords do not match.");
        }
        if (newPassword.length < 8) {
            return setError("New password must be at least 8 characters long.");
        }

        setIsChangingPassword(true);

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            });

            if (signInError) {
                throw new Error("Incorrect current password.");
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            setSuccess("Password updated successfully.");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
            setShowPw(false);
        } catch (err) {
            setError(err.message || "Failed to update password.");
        } finally {
            setIsChangingPassword(false);
        }
    };

    const hasProfileChanges = () => {
        const cleanSavedPhone = profile.phone.replace("+63", "");
        return editProfile.email !== user?.email || editProfile.phone !== cleanSavedPhone;
    };

    const placeOrder = async () => {
        setMsg({ type: "", text: "" });

        if (profile.is_blocked) {
            return setError("Your account is restricted. You cannot place orders at this time.");
        }
        if (cart.length === 0) return setError("Your cart is empty.");

        setPlacing(true);

        try {
            const cartItemIds = cart.map(item => item.id);
            const { data: liveMenuItems, error: menuError } = await supabase
                .from("menu_items")
                .select("id, name, is_available, stock_quantity")
                .in("id", cartItemIds);

            if (menuError) throw new Error("Failed to verify item availability. Please try again.");

            const unavailableItems = [];
            for (const cartItem of cart) {
                const liveItem = liveMenuItems?.find(m => m.id === cartItem.id);
                if (!liveItem || !liveItem.is_available || liveItem.stock_quantity < cartItem.quantity) {
                    unavailableItems.push(cartItem.name);
                }
            }

            if (unavailableItems.length > 0) {
                setPlacing(false);
                const { data } = await supabase.from("menu_items").select("*").order("id", { ascending: true });
                if (data) setMenu(data);

                return setError(`Cannot proceed. Some items are out of stock or unavailable: ${unavailableItems.join(", ")}.`);
            }

            const cleanCheckoutPhone = cleanPhone10(checkout.phone);
            if (cleanCheckoutPhone.length !== 10 || !cleanCheckoutPhone.startsWith("9")) {
                setPlacing(false);
                return setError("Please enter a valid 10-digit phone number starting with 9.");
            }

            const dbFormattedPhone = "+63" + cleanCheckoutPhone;

            const effective = {
                phone: dbFormattedPhone,
                notes: checkout.notes?.trim() ? checkout.notes : "",
                payment: checkout.payment,
            };

            const { error } = await supabase.from("orders").insert([{
                user_id: user.id,
                items: itemsPayload,
                total: totalPrice,
                phone: effective.phone,
                notes: effective.notes || null,
                pickup_address: PICKUP_ADDRESS,
                payment_method: effective.payment,
                status: "pending",
            }]);

            if (error) throw error;

            for (const item of cart) {
                const liveItem = liveMenuItems.find(m => m.id === item.id);
                if (liveItem) {
                    await supabase.from("menu_items").update({
                        stock_quantity: liveItem.stock_quantity - item.quantity
                    }).eq("id", item.id);
                }
            }

            if (effective.phone !== profile.phone) {
                await supabase.from("profiles").update({ phone: effective.phone }).eq("user_id", user.id);
                setProfile(prev => ({ ...prev, phone: effective.phone }));
                setEditProfile(prev => ({ ...prev, phone: cleanCheckoutPhone }));
            }

            const newNotif = {
                user_id: user.id,
                title: "Order Placed",
                message: `Thank you for your order! Your total is ₱${fmtMoney(totalPrice)}. We are now reviewing it.`,
                is_read: false
            };

            const { data: insertedNotif } = await supabase.from("notifications").insert([newNotif]).select();

            if (insertedNotif && insertedNotif.length > 0) {
                setNotifications(prev => [insertedNotif[0], ...prev]);
                setUnreadCount(prev => prev + 1);
            }

            await supabase.from("profiles").update({ cart_data: [] }).eq('user_id', user.id);
            setSuccess("Order placed successfully!");
            clearCart();
            setActive("orders");
            setPlacing(false);

            const { data: orderData } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
            if (orderData) setOrders(orderData);

        } catch (err) {
            setError(err.message || "Checkout failed. Please try again.");
            setPlacing(false);
        }
    };

    const handleCancelClick = (orderId) => {
        setOrderToCancel(orderId);
        setShowCancelModal(true);
    };

    const confirmCancelOrder = async () => {
        if (!orderToCancel) return;

        setCancellingId(orderToCancel);
        setShowCancelModal(false);

        try {
            const { data: currentOrder, error: fetchError } = await supabase
                .from('orders')
                .select('status, items')
                .eq('id', orderToCancel)
                .single();

            if (fetchError) throw new Error("Could not fetch order status.");

            if (currentOrder.status !== 'pending') {
                setError("Cannot cancel. The kitchen is already preparing this order.");
                const { data } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
                setOrders(data || []);
                return;
            }

            const { data: menuData } = await supabase.from("menu_items").select("id, stock_quantity");
            if (menuData && currentOrder.items) {
                for (const item of currentOrder.items) {
                    const currentMenuItem = menuData.find(m => m.id === item.id);
                    if (currentMenuItem) {
                        await supabase.from("menu_items").update({
                            stock_quantity: currentMenuItem.stock_quantity + item.quantity
                        }).eq("id", item.id);
                    }
                }
            }

            const { error: updateError } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', orderToCancel);

            if (updateError) throw updateError;

            const newNotif = {
                user_id: user.id,
                title: "Order Cancelled",
                message: `Order #${String(orderToCancel).slice(0, 8)} has been cancelled successfully.`,
                is_read: false
            };

            const { data: insertedNotif } = await supabase.from("notifications").insert([newNotif]).select();

            if (insertedNotif && insertedNotif.length > 0) {
                setNotifications(prev => [insertedNotif[0], ...prev]);
                setUnreadCount(prev => prev + 1);
            }

            setSuccess("Order cancelled successfully.");
            const { data: orderData } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
            if (orderData) setOrders(orderData);

        } catch (err) {
            setError(err.message || "Failed to cancel order.");
        } finally {
            setCancellingId(null);
            setOrderToCancel(null);
        }
    };

    const openItemModal = (item) => {
        if (!item.is_available || item.stock_quantity < 1) return;
        setSelectedItem(item);
        setModalOpen(true);
    };

    const getStatusBadge = (status) => {
        const s = (status || "pending").toLowerCase();
        let classes = "bg-gray-100 text-gray-600";
        let label = s;
        if (s === "completed" || s === "served") classes = "bg-green-100 text-green-700 border border-green-200";
        if (s === "pending") classes = "bg-yellow-50 text-yellow-700 border border-yellow-200";
        if (s === "cancelled") classes = "bg-red-50 text-red-700 border border-red-200";
        if (s === "preparing") classes = "bg-blue-50 text-blue-700 border border-blue-200";
        if (s === "ready") {
            classes = "bg-emerald-50 text-emerald-700 border border-emerald-200";
            label = "ready for pickup";
        }
        return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${classes}`}>{label}</span>;
    };

    const getItemImage = (item) => {
        return item.image_url || menuImageMap[item.id];
    };

    const activeOrders = orders.filter(o => ['pending', 'preparing', 'ready'].includes((o.status || 'pending').toLowerCase()));
    const historyOrders = orders.filter(o => !['pending', 'preparing', 'ready'].includes((o.status || '').toLowerCase()));
    const displayedOrders = orderTab === 'active' ? activeOrders : historyOrders;

    if (!user) {
        return (
            <div className="min-h-screen grid place-items-center bg-gray-50">
                <div className="flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <div className="text-gray-500 font-medium">Loading session...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 font-sans selection:bg-black selection:text-white relative">
            <MenuItemModal
                open={modalOpen}
                item={selectedItem}
                onClose={() => { setModalOpen(false); setSelectedItem(null); }}
                onAddToCart={(item, qty = 1) => {
                    if (!item.is_available) return;
                    for (let i = 0; i < qty; i++) {
                        addToCart(item);
                    }
                    setSuccess(`Added ${qty}x ${item.name} to cart!`);
                    setModalOpen(false);
                }}
            />

            {showCancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fa-solid fa-triangle-exclamation text-red-600 text-xl"></i>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Cancel Order?</h3>
                            <p className="text-gray-500 text-sm mb-6">
                                Are you sure you want to cancel this order? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setShowCancelModal(false)} className="px-5 py-2.5 rounded-full border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition cursor-pointer">No, Keep Order</button>
                                <button onClick={confirmCancelOrder} className="px-5 py-2.5 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 shadow-md transition cursor-pointer">Yes, Cancel Order</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showLogoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fa-solid fa-arrow-right-from-bracket text-red-600 text-xl"></i>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Log Out?</h3>
                            <p className="text-gray-500 text-sm mb-6">Are you sure you want to log out?</p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setShowLogoutModal(false)} className="px-5 py-2.5 rounded-full border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition cursor-pointer">Cancel</button>
                                <button onClick={logout} className="px-5 py-2.5 rounded-full bg-red-600 text-white font-medium hover:bg-red-700 shadow-md transition cursor-pointer">Yes, Log Out</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold">Order Details</h3>
                                <p className="text-xs text-gray-500 font-mono">#{selectedOrder.id}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="h-8 w-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-50 transition cursor-pointer"><i className="fa-solid fa-xmark"></i></button>
                        </div>
                        <div className="p-4 md:p-6 space-y-6 overflow-y-auto">
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Items</h4>
                                {selectedOrder.items?.map((item, idx) => {
                                    const imgSrc = getItemImage(item);
                                    return (
                                        <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                                                    {imgSrc ? (
                                                        <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fa-solid fa-utensils text-xs"></i></div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-gray-900 font-bold leading-tight">{item.name}</span>
                                                    <span className="text-xs text-gray-500 font-medium">Qty: {item.quantity} × ₱{fmtMoney(item.price)}</span>
                                                </div>
                                            </div>
                                            <span className="text-gray-900 font-bold whitespace-nowrap">₱{fmtMoney(item.price * item.quantity)}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-center">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Payment Method</span>
                                        <span className="font-bold uppercase text-xs text-gray-700">{selectedOrder.payment_method}</span>
                                    </div>
                                    <div className="flex justify-between items-end mt-2 pt-2 border-t border-gray-200">
                                        <span className="text-gray-500 font-medium text-sm">Total Amount</span>
                                        <span className="font-black text-xl text-black">₱{fmtMoney(selectedOrder.total)}</span>
                                    </div>
                                </div>
                            </div>

                            {selectedOrder.notes && (
                                <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-sm text-yellow-800">
                                    <span className="font-bold block mb-1 flex items-center gap-2"><i className="fa-regular fa-comment-dots"></i> Special Instructions:</span>
                                    <p className="italic">{selectedOrder.notes}</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button onClick={() => setSelectedOrder(null)} className="px-6 py-2.5 bg-black text-white rounded-full font-medium hover:bg-gray-800 transition cursor-pointer">Close Details</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="bg-white border-b border-gray-200 sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 transition-all duration-200">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between relative">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setTab("menu")}>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Crispy Pata sa A.Luna</h1>
                    </div>

                    <nav className="hidden md:flex items-center gap-1 bg-gray-100/50 p-1 rounded-full">
                        {['menu', 'orders', 'profile'].map((tab) => (
                            <button key={tab} onClick={() => setTab(tab)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${active === tab ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="relative">
                            <button onClick={() => setShowNotifs(!showNotifs)} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 transition cursor-pointer">
                                <i className={`fa-regular fa-bell text-lg ${showNotifs ? "text-black" : "text-gray-600"}`}></i>
                                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}
                            </button>
                            {showNotifs && (
                                <>
                                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowNotifs(false)}></div>
                                    <div className="absolute right-0 top-12 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
                                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                            <h3 className="font-bold text-gray-900">Notifications</h3>
                                            {unreadCount > 0 && <button onClick={markAllAsRead} className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer">Mark all read</button>}
                                        </div>
                                        <div className="max-h-75 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center text-gray-500 text-sm"><i className="fa-regular fa-bell-slash mb-2 text-xl block opacity-50"></i>No notifications yet</div>
                                            ) : (
                                                <ul className="divide-y divide-gray-50">
                                                    {notifications.map((n) => (
                                                        <li key={n.id} onClick={() => markAsRead(n.id)} className={`p-4 hover:bg-gray-50 transition cursor-pointer flex gap-3 items-start ${n.is_read ? "opacity-60" : "bg-blue-50/30"}`}>
                                                            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.is_read ? "bg-gray-300" : "bg-blue-500"}`}></div>
                                                            <div>
                                                                <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                                                                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{n.message}</p>
                                                                <p className="text-[10px] text-gray-400 mt-2">{new Date(n.created_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</p>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <button onClick={() => setTab("cart")} className="group relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors cursor-pointer">
                            <i className={`fa-solid fa-cart-shopping transition-colors ${active === 'cart' ? 'text-black' : 'text-gray-600'}`}></i>
                            {cartBadgeCount > 0 && <span className="absolute -top-1 -right-1 bg-black text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white transform group-hover:scale-110 transition-transform">{cartBadgeCount}</span>}
                        </button>
                    </div>
                </div>
            </header>

            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex justify-around items-center px-2 py-3 pb-safe">
                {[
                    { id: 'menu', icon: 'fa-utensils', label: 'Menu' },
                    { id: 'orders', icon: 'fa-receipt', label: 'Orders' },
                    { id: 'cart', icon: 'fa-cart-shopping', label: 'Cart', badge: cartBadgeCount },
                    { id: 'profile', icon: 'fa-user', label: 'Profile' }
                ].map((item) => (
                    <button key={item.id} onClick={() => setTab(item.id)} className={`flex flex-col items-center gap-1 w-full relative cursor-pointer ${active === item.id ? "text-black" : "text-gray-400"}`}>
                        <div className="relative">
                            <i className={`fa-solid ${item.icon} text-lg ${active === item.id ? "scale-110" : ""} transition-transform`}></i>
                            {item.badge > 0 && <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full border border-white">{item.badge}</span>}
                        </div>
                        <span className="text-[10px] font-medium">{item.label}</span>
                    </button>
                ))}
            </div>

            {msg.text && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-[fadeIn_0.3s_ease-out]">
                    <div className={`rounded-xl shadow-lg border p-4 flex items-start gap-3 backdrop-blur-sm ${msg.type === "error" ? "bg-red-50/90 border-red-200 text-red-800" : "bg-green-50/90 border-green-200 text-green-800"}`}>
                        <i className={`fa-solid ${msg.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} mt-0.5`}></i>
                        <p className="text-sm font-medium">{msg.text}</p>
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto p-4 md:p-4">
                {active === "menu" && (
                    <div className="animate-[fadeIn_0.3s_ease-out]">
                        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                            <div><h2 className="text-3xl font-bold tracking-tight text-gray-900">Menu</h2></div>
                        </div>
                        {loadingMenu ? (
                            <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                                {[1, 2, 3, 4].map((i) => (<div key={i} className="bg-white rounded-2xl h-80 animate-pulse border border-gray-100"></div>))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full">
                                {menu.map((item) => (
                                    <div key={item.id} className="relative group">
                                        <MenuCard
                                            image={item.image_url}
                                            name={item.name}
                                            description={item.description}
                                            weight={item.weight}
                                            prepTime={`${item.prep_time} mins`}
                                            price={item.price}
                                            onAdd={() => {
                                                if (!item.is_available || item.stock_quantity < 1) return;
                                                addToCart(item);
                                                setSuccess(`${item.name} added to cart!`);
                                            }}
                                            onImageClick={() => openItemModal(item)}
                                            disabled={!item.is_available || profile.is_blocked || item.stock_quantity < 1}
                                        />

                                        {(!item.is_available || item.stock_quantity < 1) && (
                                            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-2xl border border-gray-100">
                                                <div className="bg-red-100 text-red-800 px-4 py-2 rounded-full font-bold text-sm shadow-sm border border-red-200 transform -rotate-12">
                                                    Sold Out
                                                </div>
                                            </div>
                                        )}

                                        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 items-end">
                                            {item.is_available && item.stock_quantity > 0 ? (
                                                <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full border border-green-200 shadow-sm">Available</span>
                                            ) : (
                                                <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full border border-gray-200 shadow-sm">Unavailable</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {active === "cart" && (
                    <div className="animate-[fadeIn_0.3s_ease-out]">
                        <h2 className="text-3xl font-bold mb-6">Your Cart</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            <div className="lg:col-span-8 space-y-4">
                                {profile.is_blocked && (
                                    <div className="p-4 mb-2 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 shadow-sm">
                                        <i className="fa-solid fa-ban mt-0.5 text-lg"></i>
                                        <div className="text-sm">
                                            <strong className="block mb-1 text-base">Account Restricted</strong>
                                            <p>You have been blocked from placing new orders. If you believe this is a mistake, please contact support.</p>
                                        </div>
                                    </div>
                                )}

                                {cart.length === 0 ? (
                                    <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fa-solid fa-basket-shopping text-gray-300 text-2xl"></i></div>
                                        <h3 className="text-lg font-bold text-gray-900">Your cart is empty</h3>
                                        <p className="text-gray-500 mt-1 mb-6">Looks like you haven't added anything yet.</p>
                                        <button onClick={() => setTab("menu")} className="px-6 py-2 bg-black text-white rounded-full font-semibold hover:bg-gray-800 transition cursor-pointer">Browse Menu</button>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                        {cart.map((item, idx) => {
                                            const liveMenuItem = menu.find(m => m.id === item.id);
                                            const isSoldOut = liveMenuItem ? (!liveMenuItem.is_available || liveMenuItem.stock_quantity < 1) : false;
                                            const maxStock = liveMenuItem ? liveMenuItem.stock_quantity : 999;

                                            return (
                                                <div key={item.id} className={`p-4 md:p-6 flex gap-4 items-start ${idx !== cart.length - 1 ? "border-b border-gray-100" : ""} ${isSoldOut ? "bg-red-50/40 opacity-75" : ""}`}>
                                                    <div className="w-20 h-20 bg-gray-100 rounded-lg shrink-0 overflow-hidden relative">
                                                        {item.image_url ? <img src={item.image_url} alt={item.name} className={`w-full h-full object-cover ${isSoldOut ? "grayscale" : ""}`} /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fa-solid fa-image"></i></div>}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <h4 className="font-bold text-gray-900 truncate pr-4">
                                                                {item.name}
                                                                {isSoldOut && <span className="ml-2 inline-block px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider border border-red-200">Sold Out</span>}
                                                            </h4>
                                                            <span className="font-bold text-gray-900">₱{fmtMoney(Number(item.price) * (Number(item.quantity) || 1))}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-500 mb-2">₱{fmtMoney(item.price)} each</p>
                                                        {!isSoldOut && (
                                                            <span className="inline-block mb-3 bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">
                                                                Stock: {maxStock}
                                                            </span>
                                                        )}
                                                        <div className="flex items-center justify-between">
                                                            <div className={`flex items-center gap-1 bg-gray-50 rounded-full p-1 border border-gray-200 ${isSoldOut ? "opacity-50 pointer-events-none" : ""}`}>
                                                                <button onClick={() => decreaseQty(item.id)} disabled={item.quantity <= 1 || isSoldOut} className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:text-black disabled:opacity-50 cursor-pointer"><i className="fa-solid fa-minus text-xs"></i></button>
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    pattern="[0-9]*"
                                                                    value={item.quantity}
                                                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                                    onBlur={(e) => handleQuantityBlur(item.id, e.target.value)}
                                                                    disabled={isSoldOut}
                                                                    className="w-8 text-sm font-bold text-center bg-transparent outline-none focus:ring-0 p-0 m-0 border-none"
                                                                />
                                                                <button onClick={() => handleIncreaseCartQty(item.id)} disabled={isSoldOut || item.quantity >= maxStock} className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 hover:text-black cursor-pointer disabled:opacity-50"><i className="fa-solid fa-plus text-xs"></i></button>
                                                            </div>
                                                            <button onClick={() => removeFromCart(item.id)} className="text-xs font-semibold text-gray-400 hover:text-red-600 underline transition cursor-pointer">Remove</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end"><button onClick={clearCart} className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer">Clear All Items</button></div>
                                    </div>
                                )}
                            </div>
                            <div className="lg:col-span-4 sticky top-24">
                                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-xl font-bold mb-4">Checkout Details</h3>
                                    <div className="space-y-4">
                                        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Pickup Location</p>
                                            <p className="text-sm font-medium text-gray-900">{PICKUP_ADDRESS}</p>
                                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1 mt-2">Phone Number</p>
                                            <p className="text-sm font-medium text-gray-900">{PHONE_NUMBER}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Payment Method</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {['pickup', 'gcash'].map((method) => (
                                                    <button key={method} type="button" onClick={() => setCheckout((p) => ({ ...p, payment: method }))} className={`py-2.5 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${checkout.payment === method ? "bg-black text-white border-black shadow-md" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}>{method === 'pickup' ? 'Cash on Pickup' : 'GCash'}</button>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2 leading-relaxed">{checkout.payment === "gcash" ? "Pay via GCash now or wait for our confirmation call." : "Pay strictly upon pickup at the store."}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Contact Number</label>
                                            <div className="flex shadow-sm rounded-lg">
                                                <span className="inline-flex items-center px-3 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-200 rounded-l-lg">
                                                    +63
                                                </span>
                                                <input
                                                    value={checkout.phone}
                                                    onChange={(e) => setCheckout((p) => ({ ...p, phone: cleanPhone10(e.target.value) }))}
                                                    className="w-full bg-white border border-gray-200 rounded-r-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                                                    placeholder="9XXXXXXXXX"
                                                    maxLength={10}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Special Instructions</label>
                                            <textarea value={checkout.notes} onChange={(e) => setCheckout((p) => ({ ...p, notes: e.target.value }))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none resize-none" placeholder="e.g. Extra spicy sauce..." rows={2} />
                                        </div>

                                        <div className="border-t border-gray-100 pt-4 mt-2">
                                            <div className="flex justify-between items-end mb-4">
                                                <span className="text-gray-600">Total Amount</span>
                                                <span className="text-3xl font-bold tracking-tight">₱{fmtMoney(totalPrice)}</span>
                                            </div>

                                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl mt-3 mb-4">
                                                <p className="text-sm font-semibold text-yellow-900">
                                                    Estimated Cooking Time: {estimatedCookingTime} minutes
                                                </p>
                                                <p className="text-xs text-yellow-700 mt-1">
                                                    Based on 4 kawali cooking capacity
                                                </p>
                                            </div>

                                            <button onClick={placeOrder} disabled={placing || cart.length === 0 || profile.is_blocked} className="w-full bg-black text-white py-3.5 rounded-full font-bold text-lg hover:bg-gray-800 hover:shadow-lg disabled:opacity-50 disabled:hover:shadow-none active:scale-[0.98] transition-all cursor-pointer">
                                                {placing ? <span className="flex items-center justify-center gap-2"><i className="fa-solid fa-circle-notch animate-spin"></i> Processing...</span> : "Place Order"}
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {active === "orders" && (
                    <div className="max-w-4xl mx-auto animate-[fadeIn_0.3s_ease-out]">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                            <h2 className="text-2xl font-bold">My Orders</h2>
                            <div className="flex bg-gray-100 p-1 rounded-lg self-start">
                                <button onClick={() => setOrderTab("active")} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer ${orderTab === "active" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>Active Orders</button>
                                <button onClick={() => setOrderTab("history")} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all cursor-pointer ${orderTab === "history" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>Past History</button>
                            </div>
                        </div>
                        {loadingOrders ? (
                            <div className="space-y-4">{[1, 2].map(i => <div key={i} className="h-32 bg-white rounded-xl animate-pulse"></div>)}</div>
                        ) : displayedOrders.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><i className={`fa-solid ${orderTab === 'active' ? 'fa-utensils' : 'fa-clock-rotate-left'} text-gray-400 text-2xl`}></i></div>
                                <p className="text-gray-500">No {orderTab} orders found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {displayedOrders.map((o) => (
                                    <div key={o.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                                        <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1"><span className="font-bold text-lg">#{String(o.id).slice(0, 8)}</span>{getStatusBadge(o.status)}</div>
                                                <p className="text-xs text-gray-500 flex items-center gap-1"><i className="fa-regular fa-clock"></i>{new Date(o.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                                            </div>
                                            <span className="font-bold text-xl">₱{fmtMoney(o.total)}</span>
                                        </div>
                                        {orderTab === 'active' && o.status !== 'cancelled' && (
                                            <div className="px-5 py-4 bg-white border-b border-gray-50">
                                                <div className="flex items-center justify-between text-xs font-semibold text-gray-400 mb-2">
                                                    <span className="text-black">Placed order</span>
                                                    <span className={o.status === 'preparing' || o.status === 'completed' || o.status === 'ready' ? "text-black" : ""}>Preparing</span>
                                                    <span className={o.status === 'completed' || o.status === 'ready' ? "text-black" : ""}>Ready</span>
                                                </div>
                                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                                    <div className="bg-black h-full transition-all duration-500 ease-out" style={{ width: o.status === 'pending' ? '33%' : o.status === 'preparing' ? '66%' : o.status === 'completed' || o.status === 'ready' ? '100%' : '5%' }}></div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-5 flex-1 flex flex-col justify-between cursor-pointer group" onClick={() => setSelectedOrder(o)}>
                                            <div className="mb-4">
                                                <div className="flex justify-between items-end mb-2">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Items</p>
                                                </div>
                                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                    {(o.items || []).slice(0, 4).map((item, idx) => {
                                                        const imgSrc = getItemImage(item);
                                                        return (
                                                            <div key={idx} className="relative w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 shrink-0 overflow-hidden group-hover:border-gray-300 transition-colors">
                                                                {imgSrc ? (
                                                                    <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fa-solid fa-utensils text-xs"></i></div>
                                                                )}
                                                                {item.quantity > 1 && (
                                                                    <div className="absolute bottom-0 right-0 bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded-tl-md font-bold">x{item.quantity}</div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {(o.items || []).length > 4 && (
                                                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                                                            +{(o.items || []).length - 4}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 line-clamp-1 font-medium mt-1">{o.items.map(i => i.name).join(", ")}</p>
                                            </div>
                                        </div>

                                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col gap-2">
                                            {o.status === 'pending' && (
                                                <button onClick={() => handleCancelClick(o.id)} disabled={cancellingId === o.id} className="w-full py-2 rounded-lg border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition active:scale-[0.98] cursor-pointer">{cancellingId === o.id ? "Cancelling..." : "Cancel Order"}</button>
                                            )}
                                            <button onClick={() => setSelectedOrder(o)} className="w-full py-2 rounded-lg border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition active:scale-[0.98] cursor-pointer">View Full Details</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {active === "profile" && (
                    <div className="max-w-2xl mx-auto animate-[fadeIn_0.3s_ease-out]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-3xl font-bold">Your Profile</h2>
                            {hasProfileChanges() && (
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={isSavingProfile}
                                    className="px-5 py-2 bg-black text-white text-sm font-bold rounded-full shadow-md hover:bg-gray-800 transition active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingProfile ? "Saving..." : "Save Changes"}
                                </button>
                            )}
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-gray-100 border-b border-l border-gray-200 text-gray-500 text-xs font-bold px-3 py-1.5 rounded-bl-xl flex items-center gap-1.5 shadow-sm">
                                <i className="fa-solid fa-lock text-[10px]"></i> Secured
                            </div>

                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md">
                                    {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : <i className="fa-solid fa-user"></i>}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">{profile.full_name || "Guest User"}</h3>
                                    <p className="text-gray-500 text-sm font-medium">{user.email}</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-2">
                                            Full Name <span className="text-[10px] font-normal bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Cannot be changed</span>
                                        </label>
                                        <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 font-medium cursor-not-allowed">
                                            {profile.full_name || editProfile.full_name}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-gray-700 mb-1.5 block">Phone Number</label>
                                        <div className="flex shadow-sm rounded-xl">
                                            <span className="inline-flex items-center px-4 text-sm text-gray-600 bg-gray-50 border border-r-0 border-gray-300 rounded-l-xl font-medium">
                                                +63
                                            </span>
                                            <input
                                                type="tel"
                                                value={editProfile.phone}
                                                onChange={(e) => setEditProfile(p => ({ ...p, phone: cleanPhone10(e.target.value) }))}
                                                className="w-full bg-white border border-gray-300 rounded-r-xl px-4 py-3 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                                                placeholder="9XXXXXXXXX"
                                                maxLength={10}
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-bold text-gray-700 mb-1.5 block">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            value={editProfile.email}
                                            onChange={(e) => setEditProfile(p => ({ ...p, email: e.target.value }))}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 font-medium focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                                            placeholder="Enter your email"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="text-sm font-bold text-gray-700 mb-1.5 block">Account Status</label>
                                        {profile.is_blocked ? (
                                            <div className="w-full bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-bold flex items-center gap-2 cursor-not-allowed">
                                                <i className="fa-solid fa-user-lock text-red-600"></i> Blocked Account
                                            </div>
                                        ) : (
                                            <div className="w-full bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-bold flex items-center gap-2 cursor-not-allowed">
                                                <i className="fa-solid fa-shield-check text-green-600"></i> Verified Account
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Change Password</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2 relative">
                                        <label className="text-sm font-bold text-gray-700 mb-1.5 block">Current Password</label>
                                        <input
                                            type={showPw ? "text" : "password"}
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none pr-10"
                                            placeholder="Enter current password"
                                        />
                                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-9 text-gray-400 hover:text-gray-600">
                                            <i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <label className="text-sm font-bold text-gray-700 mb-1.5 block">New Password</label>
                                        <input
                                            type={showPw ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                                            placeholder="Enter new password"
                                        />
                                    </div>
                                    <div className="relative">
                                        <label className="text-sm font-bold text-gray-700 mb-1.5 block">Re-enter New Password</label>
                                        <input
                                            type={showPw ? "text" : "password"}
                                            value={confirmNewPassword}
                                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-black focus:border-transparent transition-all outline-none"
                                            placeholder="Confirm new password"
                                        />
                                    </div>
                                    <div className="md:col-span-2 flex justify-end mt-2">
                                        <button
                                            onClick={handleChangePassword}
                                            disabled={isChangingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                                            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl shadow-md hover:bg-black transition active:scale-95 cursor-pointer disabled:opacity-50"
                                        >
                                            {isChangingPassword ? "Updating..." : "Update Password"}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-8 pt-6 border-t border-gray-100">
                                <button onClick={() => setShowLogoutModal(true)} className="px-8 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm rounded-full transition-all active:scale-[0.98] cursor-pointer">
                                    Log Out
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default Home;