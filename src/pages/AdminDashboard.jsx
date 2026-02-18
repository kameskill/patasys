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

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate("/");
    };

    const getItemImage = (item) => {
        return item.image_url || menuImageMap[item.id];
    };

    if (checking) return <div className="min-h-screen grid place-items-center">Loading...</div>;
    if (!isAdmin) return null;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            {showLogoutModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <i className="fa-solid fa-arrow-right-from-bracket text-red-600 text-xl"></i>
                            </div>
                            <h3 className="text-lg font-bold mb-2">Log Out</h3>
                            <p className="text-gray-600 mb-6">Are you sure you want to log out?</p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setShowLogoutModal(false)} className="flex-1 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium transition">Cancel</button>
                                <button onClick={handleLogout} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition">Log Out</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {confirmModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold mb-2">Confirm Action</h3>
                        <p className="text-gray-600 mb-6">Change order status to <span className="font-bold uppercase">{confirmModal.newStatus}</span>?</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setConfirmModal({ open: false, orderId: null, newStatus: null })} className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium">Cancel</button>
                            <button onClick={() => executeStatusUpdate(confirmModal.orderId, confirmModal.newStatus)} className="px-4 py-2 rounded-lg bg-black text-white hover:bg-gray-800 font-medium">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold">Order #{String(selectedOrder.id).slice(0, 8)}</h3>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-black"><i className="fa-solid fa-xmark text-xl"></i></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Items</h4>
                                {selectedOrder.items?.map((item, idx) => {
                                    const imgSrc = getItemImage(item);
                                    return (
                                        <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                                            <div className="flex items-center gap-4">
                                                <div className="h-14 w-14 rounded-md bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                                                    {imgSrc ? (
                                                        <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fa-solid fa-utensils"></i></div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg">{item.quantity}x</span>
                                                        <span className="font-medium text-gray-900">{item.name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="font-medium">₱{fmtMoney(item.price * item.quantity)}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <span className="block text-gray-500 text-xs mb-1">Customer</span>
                                    <span className="font-semibold">{userNames[selectedOrder.user_id] || "Unknown"}</span>
                                    <div className="text-gray-600">{selectedOrder.phone}</div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <span className="block text-gray-500 text-xs mb-1">Payment</span>
                                    <span className="font-semibold uppercase">{selectedOrder.payment_method}</span>
                                    <div className="text-gray-600">Total: <span className="font-bold text-black">₱{fmtMoney(selectedOrder.total)}</span></div>
                                </div>
                            </div>
                            {selectedOrder.notes && (
                                <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800">
                                    <span className="font-bold block mb-1">Note:</span>
                                    {selectedOrder.notes}
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button onClick={() => setSelectedOrder(null)} className="px-6 py-2 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-100">Close</button>
                        </div>
                    </div>
                </div>
            )}

            <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-8">
                            <h1 className="text-xl font-black tracking-tight">ADMIN PANEL</h1>
                            <nav className="hidden md:flex gap-1 bg-gray-100 p-1 rounded-lg">
                                <button onClick={() => setActiveTab("orders")} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === "orders" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>Orders</button>
                                <button onClick={() => setActiveTab("menu")} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === "menu" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"}`}>Menu Manager</button>
                            </nav>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => window.location.reload()} className="p-2 text-gray-400 hover:text-black transition"><i className="fa-solid fa-rotate-right"></i></button>
                            <button onClick={() => setShowLogoutModal(true)} className="text-sm font-semibold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition">Log out</button>
                        </div>
                    </div>
                </div>
                <div className="md:hidden px-4 pb-3 flex gap-2">
                    <button onClick={() => setActiveTab("orders")} className={`flex-1 py-2 text-sm font-bold border-b-2 ${activeTab === "orders" ? "border-black text-black" : "border-transparent text-gray-400"}`}>Orders</button>
                    <button onClick={() => setActiveTab("menu")} className={`flex-1 py-2 text-sm font-bold border-b-2 ${activeTab === "menu" ? "border-black text-black" : "border-transparent text-gray-400"}`}>Menu</button>
                </div>
            </header>

            {msg.text && (
                <div className="fixed top-20 right-4 z-50 animate-[fadeIn_0.3s_ease-out]">
                    <div className={`px-4 py-3 rounded-lg shadow-lg text-sm font-semibold text-white ${msg.type === "error" ? "bg-red-600" : "bg-green-600"}`}>{msg.text}</div>
                </div>
            )}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === "orders" && (
                    <div>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                            <div className="flex bg-white border border-gray-200 rounded-lg p-1">
                                <button onClick={() => { setOrderView("active"); setFilterStatus("all"); }} className={`px-4 py-2 rounded-md text-sm font-bold transition ${orderView === "active" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"}`}>Active Orders</button>
                                <button onClick={() => { setOrderView("history"); setFilterStatus("all"); }} className={`px-4 py-2 rounded-md text-sm font-bold transition ${orderView === "history" ? "bg-black text-white" : "text-gray-500 hover:bg-gray-50"}`}>History</button>
                            </div>
                            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                                {orderView === "active" ? (
                                    ["all", "pending", "confirmed", "preparing", "ready"].map(s => (
                                        <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase border transition whitespace-nowrap ${filterStatus === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{s}</button>
                                    ))
                                ) : (
                                    ["all", "completed", "cancelled"].map(s => (
                                        <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase border transition whitespace-nowrap ${filterStatus === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"}`}>{s}</button>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="mb-6">
                            <input type="text" placeholder="Search by ID, Phone, or Name..." className="w-full md:max-w-md px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-black focus:border-transparent outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>

                        {loading ? (
                            <div className="text-center py-12 text-gray-500">Loading orders...</div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300"><p className="text-gray-500 font-medium">No orders found in {orderView} view.</p></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredOrders.map(order => (
                                    <div key={order.id} className={`bg-white border rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col ${order._saving ? "opacity-70 pointer-events-none" : ""}`}>
                                        <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-lg">#{String(order.id).slice(0, 6)}</span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : order.status === 'ready' ? 'bg-green-100 text-green-800' : order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{order.status}</span>
                                                </div>
                                                <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-xl">₱{fmtMoney(order.total)}</div>
                                                <div className="text-xs text-gray-500 uppercase">{order.payment_method}</div>
                                            </div>
                                        </div>

                                        <div className="p-5 flex-1 space-y-4 cursor-pointer" onClick={() => setSelectedOrder(order)}>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Customer</p>
                                                <p className="font-medium text-sm">{userNames[order.user_id] || "Guest"}</p>
                                                <p className="text-sm text-gray-500">{order.phone}</p>
                                            </div>

                                            {order.notes && (
                                                <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-800 border border-yellow-100 line-clamp-2"><span className="font-bold">Note:</span> {order.notes}</div>
                                            )}

                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Items</p>
                                                <div className="flex gap-2 mb-2 overflow-x-auto pb-1 scrollbar-hide">
                                                    {(order.items || []).slice(0, 4).map((item, idx) => {
                                                        const imgSrc = getItemImage(item);
                                                        return (
                                                            <div key={idx} className="relative w-12 h-12 rounded-lg border border-gray-100 bg-gray-50 shrink-0 overflow-hidden">
                                                                {imgSrc ? (
                                                                    <img src={imgSrc} alt={item.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-300"><i className="fa-solid fa-utensils text-xs"></i></div>
                                                                )}
                                                                {item.quantity > 1 && (
                                                                    <div className="absolute bottom-0 right-0 bg-black/75 text-white text-[9px] px-1.5 py-0.5 rounded-tl-md font-bold leading-none">
                                                                        x{item.quantity}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {(order.items || []).length > 4 && (
                                                        <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                                            +{(order.items || []).length - 4}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 line-clamp-1">{order.items.map(i => i.name).join(", ")}</p>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-gray-50 border-t border-gray-100 rounded-b-xl">
                                            <div className="grid grid-cols-2 gap-2">
                                                {orderView === "active" ? (
                                                    <select className="col-span-2 w-full bg-white border border-gray-300 text-gray-700 text-sm rounded-lg p-2.5 focus:ring-black focus:border-black outline-none" value={order.status} onChange={(e) => handleStatusChange(order.id, e.target.value)}>
                                                        {STATUS_FLOW.map(s => (<option key={s} value={s}>{s.toUpperCase()}</option>))}
                                                    </select>
                                                ) : (
                                                    <button onClick={() => setSelectedOrder(order)} className="col-span-2 w-full py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100">View Details</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "menu" && (
                    <div className="animate-[fadeIn_0.3s_ease-out]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">Menu Management</h2>
                            <button onClick={fetchMenu} className="text-sm text-blue-600 hover:underline">Refresh List</button>
                        </div>
                        {loadingMenu ? (
                            <div className="text-center py-12">Loading menu items...</div>
                        ) : (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-xs font-bold">
                                        <tr><th className="px-6 py-4">Item Name</th><th className="px-6 py-4">Price</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Action</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {menuItems.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                                                <td className="px-6 py-4 text-gray-500">₱{fmtMoney(item.price)}</td>
                                                <td className="px-6 py-4">
                                                    {item.is_available ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Available</span> : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Unavailable</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => toggleMenuAvailability(item)} className={`px-3 py-1.5 rounded-md text-xs font-bold border transition ${item.is_available ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>{item.is_available ? "Mark Unavailable" : "Mark Available"}</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default AdminDashboard;