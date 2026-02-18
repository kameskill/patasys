import { createContext, useContext, useMemo, useState } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
    const [cart, setCart] = useState([]);

    const addToCart = (item) => {
        setCart((prev) => {
            const exists = prev.find((p) => p.id === item.id);
            if (exists) {
                return prev.map((p) =>
                    p.id === item.id
                        ? { ...p, quantity: (Number(p.quantity) || 1) + 1 }
                        : p
                );
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    };

    const increaseQty = (id) => {
        setCart((prev) =>
            prev.map((p) =>
                p.id === id ? { ...p, quantity: (Number(p.quantity) || 1) + 1 } : p
            )
        );
    };

    const decreaseQty = (id) => {
        setCart((prev) =>
            prev
                .map((p) => {
                    if (p.id !== id) return p;
                    const newQty = (Number(p.quantity) || 1) - 1;
                    if (newQty <= 0) return null;
                    return { ...p, quantity: newQty };
                })
                .filter(Boolean)
        );
    };

    const setQty = (id, qty) => {
        const nextQty = Number(qty);

        setCart((prev) =>
            prev
                .map((p) => {
                    if (p.id !== id) return p;
                    if (!Number.isFinite(nextQty) || nextQty <= 0) return null;
                    return { ...p, quantity: Math.floor(nextQty) };
                })
                .filter(Boolean)
        );
    };

    const removeFromCart = (id) => {
        setCart((prev) => prev.filter((p) => p.id !== id));
    };

    const clearCart = () => setCart([]);

    const totalPrice = useMemo(() => {
        return cart.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const qty = Number(item.quantity) || 0;
            return sum + price * qty;
        }, 0);
    }, [cart]);

    return (
        <CartContext.Provider
            value={{
                cart,
                setCart,
                addToCart,
                increaseQty,
                decreaseQty,
                setQty,
                removeFromCart,
                clearCart,
                totalPrice,
            }}
        >
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used within CartProvider");
    return ctx;
}
