import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../context/Cart";
import supabase from "../config/Client";
import MenuCard from "../components/MenuCard";
import Footer from "../components/Footer";
import MenuItemModal from "../components/MenuItemModal";

const HERO_SLIDES = [
  {
    id: 1,
    image: "/pataXXL.jpg",
    title: "Crispy Pata",
    subtitle: "The crunch you crave. Perfectly seasoned and golden-fried.",
  },
  {
    id: 2,
    image: "/chicken.jpg",
    title: "Fried Chicken",
    subtitle: "Juicy on the inside, crispy on the outside.",
  },
  {
    id: 3,
    image: "/ulo.jpg",
    title: "Fried Ulo",
    subtitle: "The perfect pulutan or ulam for any occasion.",
  }
];

function LandingPage() {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const [open, setOpen] = useState(false);
  const [featuredMenu, setFeaturedMenu] = useState([]);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  const [itemOpen, setItemOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [msg, setMsg] = useState({ type: "", text: "" });

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

  const openItemModal = (item) => {
    if (!item.is_available) return;
    setSelectedItem(item);
    setItemOpen(true);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe) nextSlide();
    if (isRightSwipe) prevSlide();
  };

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const user = data?.session?.user;
      if (user?.id) navigate("/home", { replace: true });
    };
    check();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) navigate("/home", { replace: true });
    });
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: featured, error: fErr } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_featured", true);
      const { data: regular, error: rErr } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_featured", false);

      if (fErr || rErr) console.error(fErr || rErr);
      else {
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
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-[fadeIn_0.3s_ease-out]">
          <div className={`rounded-xl shadow-lg border p-4 flex items-start gap-3 backdrop-blur-sm ${msg.type === "error" ? "bg-red-50/90 border-red-200 text-red-800" : "bg-green-50/90 border-green-200 text-green-800"}`}>
            <i className={`fa-solid ${msg.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} mt-0.5`}></i>
            <p className="text-sm font-medium">{msg.text}</p>
          </div>
        </div>
      )}

      <header className="w-full bg-white border-b border-gray-300 sticky top-0 z-30">
        <div className="flex items-center justify-between max-w-7xl mx-auto p-4 md:p-6 gap-3">
          <h1 className="text-lg md:text-3xl font-bold truncate flex-1 md:flex-none">
            Crispy Pata sa A.Luna
          </h1>

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
              <li>
                <NavLink to="/login" className={navBtnClass}>
                  Log in / Sign up
                </NavLink>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => navigate("/menu")}
                  className="relative px-3 py-1 rounded-full bg-black text-white font-semibold hover:bg-neutral-800 active:scale-95 transition flex flex-row gap-2 items-center"
                >
                  <i className="fa-solid fa-cart-shopping" />
                  Order Now!
                </button>
              </li>
            </ul>
          </nav>

          <div className="md:hidden flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/menu")}
              className="relative p-2.5 rounded-full bg-black text-white hover:bg-neutral-800 active:scale-95 transition flex items-center justify-center"
              aria-label="Order Now"
            >
              <i className="fa-solid fa-cart-shopping text-sm" />
            </button>

            <button
              onClick={() => setOpen((v) => !v)}
              className="p-2 rounded-md border border-gray-200 flex items-center justify-center text-gray-700"
              aria-label="Toggle menu"
            >
              {open ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className={`md:hidden overflow-hidden transition-all duration-300 ${open ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}>
          <nav className="px-4 pb-6 border-b border-gray-100">
            <ul className="flex flex-col gap-4 text-base items-center text-center">
              <li>
                <NavLink to="/" onClick={() => setOpen(false)} className={navBtnClass}>
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink to="/menu" onClick={() => setOpen(false)} className={navBtnClass}>
                  Menu
                </NavLink>
              </li>
              <li>
                <NavLink to="/login" onClick={() => setOpen(false)} className={navBtnClass}>
                  Log in / Sign up
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="flex flex-col gap-4 p-4 md:p-0 max-w-7xl mx-auto">
        <section
          className="relative w-full h-125 md:h-162.5 lg:h-175 md:mt-4 overflow-hidden rounded-2xl group bg-gray-900 shadow-xl"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {HERO_SLIDES.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-5000 ease-linear"
                style={{
                  backgroundImage: `url('${slide.image}')`,
                  transform: index === currentSlide ? "scale(1.1)" : "scale(1)"
                }}
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />

              <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12 pb-12 md:pb-16 text-white">
                <div className={`transform transition-all duration-700 delay-200 ${index === currentSlide ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>

                  <h1 className="text-3xl md:text-5xl font-extrabold leading-tight drop-shadow-md mb-3">
                    {slide.title}
                  </h1>

                  <p className="text-white/90 text-sm md:text-lg max-w-xl leading-relaxed drop-shadow-sm mb-6">
                    {slide.subtitle}
                  </p>

                  <button
                    onClick={() => navigate("/menu")}
                    className="px-6 py-3 rounded-full bg-white text-black font-bold hover:bg-gray-100 active:scale-95 transition shadow-lg"
                  >
                    Order Now
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="absolute bottom-6 left-0 w-full flex justify-center gap-2 z-20">
            {HERO_SLIDES.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${currentSlide === idx ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                  }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 mx-auto p-4 md:p-0">
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

        <MenuItemModal
          open={itemOpen}
          onClose={() => setItemOpen(false)}
          item={selectedItem}
          onAddToCart={handleAddToCart}
        />
      </main>
      <Footer />
    </>
  );
}

export default LandingPage;