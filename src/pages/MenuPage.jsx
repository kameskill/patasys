import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import CartModal from "../components/CartModal";
import { useCart } from "../context/Cart";
import supabase from "../config/Client";
import MenuCard from "../components/MenuCard";
import MenuItemModal from "../components/MenuItemModal";

function MenuPage() {
  const navigate = useNavigate();

  const [cartOpen, setCartOpen] = useState(false);
  const { cart, addToCart } = useCart();

  const [open, setOpen] = useState(false);
  const [featuredMenu, setFeaturedMenu] = useState([]);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  const [itemOpen, setItemOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [msg, setMsg] = useState({ type: "", text: "" });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const setSuccess = (text) => setMsg({ type: "success", text });
  const setError = (text) => setMsg({ type: "error", text });

  useEffect(() => {
    if (msg.text) {
      const timer = setTimeout(() => {
        setMsg({ type: "", text: "" });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  const cartBadgeCount = useMemo(
    () => (cart || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [cart]
  );

  const openItemModal = (item) => {
    if (!item.is_available) return;
    setSelectedItem(item);
    setItemOpen(true);
  };

  const handleAddToCart = (item, qty = 1) => {
    if (!item.is_available) {
      setError("Sorry, this item is currently unavailable.");
      return;
    }

    for (let i = 0; i < qty; i++) {
      addToCart(item);
    }
    setSuccess(`Added ${qty}x ${item.name} to cart!`);
  };

  const handleCartClick = () => {
    if (isLoggedIn) {
      navigate("/home", { state: { openCart: true } });
    } else {
      setShowLoginPrompt(true);
    }
  };

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const user = data?.session?.user;
      if (user?.id) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
    };

    check();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: featured, error: fErr } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_featured", true)
        .order("name", { ascending: true });

      const { data: regular, error: rErr } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_featured", false)
        .order("name", { ascending: true });

      if (fErr || rErr) {
        console.error(fErr || rErr);
      } else {
        setFeaturedMenu(featured || []);
        setMenu(regular || []);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const navBtnClass = ({ isActive }) =>
    [
      "font-semibold transition-all duration-200 decoration-2 underline-offset-4",
      isActive
        ? "text-black underline decoration-black"
        : "text-gray-700 hover:underline hover:decoration-gray-300",
    ].join(" ");

  return (
    <>
      {msg.text && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`px-6 py-3 rounded-full shadow-lg flex items-center gap-3 border ${msg.type === "error"
            ? "bg-red-50 border-red-200 text-red-800"
            : "bg-black text-white border-black"
            }`}>
            <i className={`fa-solid ${msg.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check text-green-400'}`} />
            <span className="font-semibold text-sm">{msg.text}</span>
          </div>
        </div>
      )}

      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-right-to-bracket text-blue-600 text-xl"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Login Required</h3>
              <p className="text-gray-500 text-sm mb-6">
                Please log in or sign up to proceed to checkout and view your cart details.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate("/login")}
                  className="w-full px-5 py-2.5 rounded-full bg-black text-white font-medium hover:bg-gray-800 shadow-md transition cursor-pointer"
                >
                  Log In / Sign Up
                </button>
                <button
                  onClick={() => setShowLoginPrompt(false)}
                  className="w-full px-5 py-2.5 rounded-full border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition cursor-pointer"
                >
                  Continue Browsing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="w-full bg-white border-b border-gray-300 sticky top-0 z-30">
        <div className="flex items-center justify-between max-w-7xl mx-auto p-4 md:p-6 gap-3">
          <h1 className="text-lg md:text-3xl font-bold truncate flex-1 md:flex-none">Crispy Pata sa A.Luna</h1>

          <nav className="hidden md:block">
            <ul className="flex items-center gap-6 text-sm">
              <li>
                <NavLink to="/" className={navBtnClass}>
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink to="/menu" className={navBtnClass}>
                  Menu
                </NavLink>
              </li>
              {!isLoggedIn && (
                <li>
                  <NavLink to="/login" className={navBtnClass}>
                    Log in / Sign up
                  </NavLink>
                </li>
              )}

              <li>
                <button
                  type="button"
                  onClick={handleCartClick}
                  className="relative px-3 py-1 rounded-full bg-black text-white font-semibold hover:bg-neutral-800 active:scale-95 transition flex flex-row gap-2 items-center cursor-pointer"
                >
                  <i className="fa-solid fa-cart-shopping" />
                  Cart
                  {cartBadgeCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-white text-black text-xs font-bold rounded-full px-2">
                      {cartBadgeCount}
                    </span>
                  )}
                </button>
              </li>
            </ul>
          </nav>

          <div className="md:hidden flex items-center gap-3">
            <button
              type="button"
              onClick={handleCartClick}
              className="relative p-2.5 rounded-full bg-black text-white hover:bg-neutral-800 active:scale-95 transition flex items-center justify-center cursor-pointer"
            >
              <i className="fa-solid fa-cart-shopping text-sm" />
              {cartBadgeCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center border-2 border-white">
                  {cartBadgeCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setOpen((v) => !v)}
              className="p-2 rounded-md border border-gray-200 flex items-center justify-center text-gray-700"
              aria-label="Toggle menu"
            >
              {open ? (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ${open ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
            }`}
        >
          <nav className="px-4 pb-6 border-b border-gray-100">
            <ul className="flex flex-col gap-4 text-base items-center text-center">
              <li>
                <NavLink
                  to="/"
                  onClick={() => setOpen(false)}
                  className={navBtnClass}
                >
                  Home
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/menu"
                  onClick={() => setOpen(false)}
                  className={navBtnClass}
                >
                  Menu
                </NavLink>
              </li>

              {!isLoggedIn && (
                <li>
                  <NavLink
                    to="/login"
                    onClick={() => setOpen(false)}
                    className={navBtnClass}
                  >
                    Log in / Sign up
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </header>

      <main className="flex min-h-screen flex-col w-full space-y-6 max-w-7xl mx-auto p-4">
        <section className="flex flex-col gap-4 w-full">
          <h2 className="text-2xl font-bold">Featured menu</h2>

          {loading ? (
            <div className="text-gray-700">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 w-full">
              {featuredMenu.map((item) => (
                <div key={item.id} className="relative group">
                  <MenuCard
                    image={item.image_url}
                    name={item.name}
                    description={item.description}
                    weight={item.weight}
                    prepTime={`${item.prep_time} mins`}
                    price={item.price}
                    onAdd={() => handleAddToCart(item)}
                    onImageClick={() => openItemModal(item)}
                    disabled={!item.is_available}
                  />

                  {!item.is_available && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-2xl border border-gray-100 cursor-not-allowed">
                      <div className="bg-red-100 text-red-800 px-4 py-2 rounded-full font-bold text-sm shadow-sm border border-red-200 transform -rotate-12">
                        Sold Out
                      </div>
                    </div>
                  )}

                  <div className="absolute top-3 right-3 z-20">
                    {item.is_available ? (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full border border-green-200 shadow-sm">
                        Available
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full border border-gray-200 shadow-sm">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-2xl font-bold">Menu</h2>

          {loading ? (
            <div className="text-gray-700">Loading...</div>
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
                    onAdd={() => handleAddToCart(item)}
                    onImageClick={() => openItemModal(item)}
                    disabled={!item.is_available}
                  />

                  {!item.is_available && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-2xl border border-gray-100 cursor-not-allowed">
                      <div className="bg-red-100 text-red-800 px-4 py-2 rounded-full font-bold text-sm shadow-sm border border-red-200 transform -rotate-12">
                        Sold Out
                      </div>
                    </div>
                  )}

                  <div className="absolute top-3 right-3 z-20">
                    {item.is_available ? (
                      <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full border border-green-200 shadow-sm">
                        Available
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded-full border border-gray-200 shadow-sm">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <CartModal
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          onCheckoutClick={() => {
            setCartOpen(false);
            handleCartClick();
          }}
        />

        <MenuItemModal
          open={itemOpen}
          onClose={() => setItemOpen(false)}
          item={selectedItem}
          onAddToCart={(item, qty) => {
            handleAddToCart(item, qty);
            setItemOpen(false);
          }}
        />
      </main>
    </>
  );
}

export default MenuPage;