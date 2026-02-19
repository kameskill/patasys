import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../config/Client";

const STATUS_FLOW = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];

function AdminDashboard() {
    const navigate = useNavigate();

    const [checking, setChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [activeTab, setActiveTab] = useState("orders");

    const [orders, setOrders] = useState([]);
    const ordersRef = useRef([]);
    const [userNames, setUserNames] = useState({});

    const [menuImageMap, setMenuImageMap] = useState({});

    const [loading, setLoading] = useState(false);
    const [orderView, setOrderView] = useState("active");
    const [filterStatus, setFilterStatus] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    const [menuItems, setMenuItems] = useState([]);
    const [loadingMenu, setLoadingMenu] = useState(false);

    const [editingPriceId, setEditingPriceId] = useState(null);
    const [editPriceValue, setEditPriceValue] = useState("");

    const [msg, setMsg] = useState({ type: "", text: "" });
    const [confirmModal, setConfirmModal] = useState({ open: false, orderId: null, newStatus: null });
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const setError = (t) => setMsg({ type: "error", text: t });
    const setSuccess = (t) => setMsg({ type: "success", text: t });
    const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatDateTime = (iso) => iso ? new Date(iso).toLocaleString() : "";

    useEffect(() => {
        let mounted = true;
        const init = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return navigate("/login", { replace: true });

                const { data: prof } = await supabase
                    .from("profiles")
                    .select("is_admin")
                    .eq("user_id", user.id)
                    .maybeSingle();

                if (!prof?.is_admin) return navigate("/home", { replace: true });

                if (mounted) setIsAdmin(true);
            } catch (e) {
                navigate("/home", { replace: true });
            } finally {
                if (mounted) setChecking(false);
            }
        };
        init();
        return () => { mounted = false; };
    }, [navigate]);

    useEffect(() => {
        if (!isAdmin) return;
        const fetchImages = async () => {
            const { data } = await supabase.from("menu_items").select("id, image_url");
            if (data) {
                const map = {};
                data.forEach(item => {
                    map[item.id] = item.image_url;
                });
                setMenuImageMap(map);
            }
        };
        fetchImages();
    }, [isAdmin]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("orders")
                .select("*")
                .order("created_at", { ascending: true });
            if (error) throw error;

            setOrders(data || []);
            ordersRef.current = data || [];
            fetchUserNames(data || []);
        } catch (e) {
            setError("Failed to load orders.");
        } finally {
            setLoading(false);
        }
    };

    const fetchMenu = async () => {
        setLoadingMenu(true);
        try {
            const { data, error } = await supabase
                .from("menu_items")
                .select("id, name, price, description, is_available, image_url")
                .order("name", { ascending: true });
            if (error) throw error;
            setMenuItems(data || []);
        } catch (e) {
            setError("Failed to load menu.");
        } finally {
            setLoadingMenu(false);
        }
    };

    const fetchUserNames = async (ordersList) => {
        const ids = [...new Set(ordersList.map(o => o.user_id).filter(Boolean))];
        if (!ids.length) return;
        const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
        const map = {};
        (data || []).forEach(p => map[p.user_id] = p.full_name);
        setUserNames(prev => ({ ...prev, ...map }));
    };

    useEffect(() => {
        if (isAdmin) {
            if (activeTab === "orders") fetchOrders();
            if (activeTab === "menu") fetchMenu();
        }
    }, [isAdmin, activeTab]);

    useEffect(() => {
        if (msg.text) {
            const t = setTimeout(() => setMsg({ type: "", text: "" }), 3000);
            return () => clearTimeout(t);
        }
    }, [msg]);

    const filteredOrders = useMemo(() => {
        let list = orders;

        if (orderView === "active") {
            list = list.filter(o => !["completed", "cancelled"].includes((o.status || "").toLowerCase()));
        } else {
            list = list.filter(o => ["completed", "cancelled"].includes((o.status || "").toLowerCase()));
        }

        if (filterStatus !== "all") {
            list = list.filter(o => (o.status || "").toLowerCase() === filterStatus);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(o =>
                String(o.id).toLowerCase().includes(q) ||
                String(o.phone).includes(q) ||
                (userNames[o.user_id] || "").toLowerCase().includes(q)
            );
        }

        return list;
    }, [orders, orderView, filterStatus, searchQuery, userNames]);

    const handleStatusChange = (orderId, newStatus) => {
        if (["completed", "cancelled", "ready"].includes(newStatus)) {
            setConfirmModal({ open: true, orderId, newStatus });
        } else {
            executeStatusUpdate(orderId, newStatus);
        }
    };

    const executeStatusUpdate = async (orderId, status) => {
        setConfirmModal({ open: false, orderId: null, newStatus: null });
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status, _saving: true } : o));

        try {
            const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
            if (error) throw error;
            setSuccess(`Order updated to ${status}`);
            fetchOrders();
        } catch (e) {
            setError("Update failed.");
            fetchOrders();
        }
    };

    const toggleMenuAvailability = async (item) => {
        const newVal = !item.is_available;
        setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, is_available: newVal } : m));

        try {
            const { error } = await supabase
                .from("menu_items")
                .update({ is_available: newVal })
                .eq("id", item.id);

            if (error) throw error;
            setSuccess(`${item.name} is now ${newVal ? "Available" : "Unavailable"}`);
        } catch (e) {
            console.error(e);
            setError("Failed to update status. Check permissions.");
            fetchMenu();
        }
    };

    const handleEditPriceClick = (item) => {
        setEditingPriceId(item.id);
        setEditPriceValue(item.price.toString());
    };

    const handleSavePrice = async (item) => {
        const newPrice = parseFloat(editPriceValue);
        if (isNaN(newPrice) || newPrice < 0) {
            setError("Please enter a valid price.");
            return;
        }

        setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, price: newPrice } : m));
        setEditingPriceId(null);

        try {
            const { error } = await supabase
                .from("menu_items")
                .update({ price: newPrice })
                .eq("id", item.id);

            if (error) throw error;
            setSuccess(`${item.name} price updated.`);
        } catch (e) {
            console.error(e);
            setError("Failed to update price.");
            fetchMenu();
        }
    };

    const handleCancelEditPrice = () => {
        setEditingPriceId(null);
        setEditPriceValue("");
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    const getItemImage = (item) => {
        return item.image_url || menuImageMap[item.id];
    };

    const getStatusBadge = (status) => {
        const s = (status || "pending").toLowerCase();
        let classes = "bg-gray-100 text-gray-600 border-gray-200";
        if (s === "completed" || s === "served") classes = "bg-green-100 text-green-700 border-green-200";
        if (s === "pending") classes = "bg-yellow-100 text-yellow-700 border-yellow-200";
        if (s === "cancelled") classes = "bg-red-100 text-red-700 border-red-200";
        if (s === "preparing") classes = "bg-blue-100 text-blue-700 border-blue-200";
        if (s === "ready") classes = "bg-emerald-100 text-emerald-700 border-emerald-200";

        return <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${classes}`}>{s}</span>;
    };

    if (checking) return <div className="min-h-screen grid place-items-center">Loading...</div>;
    if (!isAdmin) return null;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {showLogoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fa-solid fa-arrow-right-from-bracket text-red-600 text-xl"></i>
                            </div>
                            <h3 className="text-lg font-bold mb-2">Log Out?</h3>
                            <p className="text-gray-500 text-sm mb-6">Are you sure you want to log out?</p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setShowLogoutModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium transition cursor-pointer">Cancel</button>
                                <button onClick={handleLogout} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition cursor-pointer">Yes, Log Out</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {confirmModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
                        <div className="p-6 text-center">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i className="fa-solid fa-circle-question text-blue-600 text-xl"></i>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Action</h3>
                            <p className="text-gray-500 text-sm mb-6">
                                Change order status to <span className="font-bold uppercase text-black">{confirmModal.newStatus}</span>?
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => setConfirmModal({ open: false, orderId: null, newStatus: null })} className="flex-1 px-5 py-2.5 rounded-full border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition cursor-pointer">Cancel</button>
                                <button onClick={() => executeStatusUpdate(confirmModal.orderId, confirmModal.newStatus)} className="flex-1 px-5 py-2.5 rounded-full bg-black text-white font-medium hover:bg-gray-800 shadow-md transition cursor-pointer">Confirm</button>
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <span className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Customer Info</span>
                                    <span className="font-bold text-gray-900 block">{userNames[selectedOrder.user_id] || "Guest"}</span>
                                    <div className="text-gray-600 text-sm mt-1 flex items-center gap-2"><i className="fa-solid fa-phone text-xs opacity-50"></i> {selectedOrder.phone}</div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col justify-center">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">Payment Method</span>
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

            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-8">
                            <h1 className="text-xl font-black tracking-tight">ADMIN PANEL</h1>
                            <nav className="hidden md:flex gap-1 bg-gray-100 p-1 rounded-full">
                                <button onClick={() => setActiveTab("orders")} className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all cursor-pointer ${activeTab === "orders" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>Orders</button>
                                <button onClick={() => setActiveTab("menu")} className={`px-5 py-1.5 rounded-full text-sm font-bold transition-all cursor-pointer ${activeTab === "menu" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>Menu Manager</button>
                            </nav>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => window.location.reload()} className="h-10 w-10 rounded-full bg-gray-50 border border-gray-200 text-gray-500 hover:text-black hover:bg-gray-100 transition flex items-center justify-center cursor-pointer" title="Refresh Page"><i className="fa-solid fa-rotate-right"></i></button>
                            <button onClick={() => setShowLogoutModal(true)} className="h-10 px-4 rounded-full bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition flex items-center justify-center gap-2 cursor-pointer"><i className="fa-solid fa-arrow-right-from-bracket"></i> <span className="hidden sm:inline">Log Out</span></button>
                        </div>
                    </div>
                </div>
                <div className="md:hidden px-2 pb-2 pt-1 flex gap-1 bg-white border-t border-gray-100">
                    <button onClick={() => setActiveTab("orders")} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "orders" ? "bg-black text-white" : "bg-gray-100 text-gray-500"}`}>Orders</button>
                    <button onClick={() => setActiveTab("menu")} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "menu" ? "bg-black text-white" : "bg-gray-100 text-gray-500"}`}>Menu Manager</button>
                </div>
            </header>

            {msg.text && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-[fadeIn_0.3s_ease-out]">
                    <div className={`rounded-xl shadow-lg border p-4 flex items-start gap-3 backdrop-blur-sm ${msg.type === "error" ? "bg-red-50/90 border-red-200 text-red-800" : "bg-green-50/90 border-green-200 text-green-800"}`}>
                        <i className={`fa-solid ${msg.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} mt-0.5`}></i>
                        <p className="text-sm font-medium">{msg.text}</p>
                    </div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                {activeTab === "orders" && (
                    <div className="animate-[fadeIn_0.2s_ease-out]">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div className="flex bg-gray-100 rounded-lg p-1 w-full md:w-auto shrink-0">
                                <button onClick={() => { setOrderView("active"); setFilterStatus("all"); }} className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold transition cursor-pointer ${orderView === "active" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>Active Orders</button>
                                <button onClick={() => { setOrderView("history"); setFilterStatus("all"); }} className={`flex-1 md:flex-none px-6 py-2 rounded-md text-sm font-bold transition cursor-pointer ${orderView === "history" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>Past History</button>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                                    {orderView === "active" ? (
                                        ["all", "pending", "confirmed", "preparing", "ready"].map(s => (
                                            <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-full text-xs font-bold uppercase border transition whitespace-nowrap cursor-pointer ${filterStatus === s ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{s}</button>
                                        ))
                                    ) : (
                                        ["all", "completed", "cancelled"].map(s => (
                                            <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-full text-xs font-bold uppercase border transition whitespace-nowrap cursor-pointer ${filterStatus === s ? "bg-black text-white border-black" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{s}</button>
                                        ))
                                    )}
                                </div>
                                <div className="relative shrink-0">
                                    <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                    <input type="text" placeholder="Search orders..." className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-black focus:border-transparent transition" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse"></div>)}
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
                                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"><i className={`fa-solid ${orderView === 'active' ? 'fa-clipboard-list' : 'fa-clock-rotate-left'} text-gray-400 text-2xl`}></i></div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">No Orders Found</h3>
                                <p className="text-gray-500 text-sm">There are no {filterStatus !== 'all' ? filterStatus : ''} orders in the {orderView} view.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredOrders.map(order => (
                                    <div key={order.id} className={`bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden ${order._saving ? "opacity-60 pointer-events-none" : ""}`}>
                                        <div className="p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50/30">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-black text-lg text-gray-900">#{String(order.id).slice(0, 6)}</span>
                                                    {getStatusBadge(order.status)}
                                                </div>
                                                <p className="text-xs text-gray-500 flex items-center gap-1"><i className="fa-regular fa-clock"></i> {formatDateTime(order.created_at)}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-xl text-gray-900">₱{fmtMoney(order.total)}</div>
                                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{order.payment_method}</div>
                                            </div>
                                        </div>

                                        <div className="p-5 flex-1 flex flex-col justify-between cursor-pointer group" onClick={() => setSelectedOrder(order)}>
                                            <div className="mb-4">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Items</p>
                                                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                                    {(order.items || []).slice(0, 4).map((item, idx) => {
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
                                                    {(order.items || []).length > 4 && (
                                                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                                                            +{(order.items || []).length - 4}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 line-clamp-1 font-medium mt-1">{order.items.map(i => i.name).join(", ")}</p>
                                            </div>

                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className="h-8 w-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shrink-0">
                                                    <i className="fa-solid fa-user text-xs"></i>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 truncate">{userNames[order.user_id] || "Guest"}</p>
                                                    <p className="text-xs text-gray-500 truncate">{order.phone}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 border-t border-gray-100 bg-gray-50">
                                            {orderView === "active" ? (
                                                <div className="relative">
                                                    <select
                                                        className="w-full appearance-none bg-white border border-gray-300 text-gray-900 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black focus:border-transparent transition cursor-pointer pr-10"
                                                        value={order.status}
                                                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                    >
                                                        {STATUS_FLOW.map(s => (<option key={s} value={s}>{s.toUpperCase()}</option>))}
                                                    </select>
                                                    <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs"></i>
                                                </div>
                                            ) : (
                                                <button onClick={() => setSelectedOrder(order)} className="w-full py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition cursor-pointer shadow-sm">View Full Details</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "menu" && (
                    <div className="animate-[fadeIn_0.2s_ease-out]">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <h2 className="text-2xl font-bold">Menu Management</h2>
                            <button onClick={fetchMenu} disabled={loadingMenu} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-50 transition cursor-pointer flex items-center gap-2">
                                <i className={`fa-solid fa-rotate-right ${loadingMenu ? 'animate-spin' : ''}`}></i> Refresh
                            </button>
                        </div>

                        {loadingMenu ? (
                            <div className="bg-white rounded-2xl border border-gray-200 h-64 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-gray-500 font-medium text-sm">Loading Menu...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                                <div className="overflow-x-auto w-full">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                                            <tr>
                                                <th className="px-6 py-4 rounded-tl-2xl">Item Info</th>
                                                <th className="px-6 py-4">Price</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-right rounded-tr-2xl">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {menuItems.map((item) => (
                                                <tr key={item.id} className="hover:bg-gray-50/50 transition">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                                                                {item.image_url ? (
                                                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fa-solid fa-image text-xs"></i></div>
                                                                )}
                                                            </div>
                                                            <span className="font-bold text-gray-900">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {editingPriceId === item.id ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="relative">
                                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₱</span>
                                                                    <input
                                                                        type="number"
                                                                        autoFocus
                                                                        className="w-24 pl-6 pr-2 py-1.5 bg-white border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-black focus:border-transparent font-bold text-sm"
                                                                        value={editPriceValue}
                                                                        onChange={(e) => setEditPriceValue(e.target.value)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && handleSavePrice(item)}
                                                                    />
                                                                </div>
                                                                <button onClick={() => handleSavePrice(item)} className="h-8 w-8 bg-black text-white rounded-lg hover:bg-gray-800 transition flex items-center justify-center cursor-pointer shadow-sm" title="Save"><i className="fa-solid fa-check text-xs"></i></button>
                                                                <button onClick={handleCancelEditPrice} className="h-8 w-8 bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 hover:text-black transition flex items-center justify-center cursor-pointer shadow-sm" title="Cancel"><i className="fa-solid fa-xmark text-xs"></i></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-3 group">
                                                                <span className="font-black text-gray-900 text-base">₱{fmtMoney(item.price)}</span>
                                                                <button
                                                                    onClick={() => handleEditPriceClick(item)}
                                                                    className="opacity-0 group-hover:opacity-100 h-7 w-7 bg-white border border-gray-200 text-gray-500 hover:text-black hover:border-gray-300 rounded-md transition-all flex items-center justify-center cursor-pointer shadow-sm"
                                                                    title="Edit Price"
                                                                >
                                                                    <i className="fa-solid fa-pen text-[10px]"></i>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {item.is_available ?
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-green-50 text-green-700 border border-green-200 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>Available</span> :
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-200 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>Sold Out</span>
                                                        }
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => toggleMenuAvailability(item)}
                                                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition shadow-sm cursor-pointer ${item.is_available ? "bg-white border-red-200 text-red-600 hover:bg-red-50" : "bg-black border-black text-white hover:bg-gray-800"}`}
                                                        >
                                                            {item.is_available ? "Mark Sold Out" : "Restore Item"}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default AdminDashboard;