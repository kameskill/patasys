import { useCart } from "../context/Cart";
import supabase from "../config/Client";

function CartModal({ open, onClose }) {
    const {
        cart,
        removeFromCart,
        totalPrice,
        clearCart,
        increaseQty,
        decreaseQty,
        setQty,
    } = useCart();

    if (!open) return null;

    const handleCheckout = async () => {
        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                alert("Please login before checkout!");
                window.location.href = "/login";
                return;
            }

            if (cart.length === 0) {
                alert("Your cart is empty!");
                return;
            }

            const { error } = await supabase.from("orders").insert([
                {
                    user_id: user.id,
                    items: cart.map((item) => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                    })),
                    total: totalPrice,
                },
            ]);

            if (error) throw error;

            alert("Order placed successfully!");
            clearCart();
            onClose();
        } catch (err) {
            console.error("Checkout failed:", err);
            alert(err.message || "Something went wrong. Check console for details.");
        }
    };

    return (
        <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            <div className="absolute right-0 top-0 h-full w-full sm:w-96 bg-white p-4 flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-xl font-bold"
                    aria-label="Close"
                >
                    &times;
                </button>

                <h2 className="text-xl font-bold mb-4">Your Cart</h2>

                {cart.length === 0 ? (
                    <p className="text-gray-500">Your cart is empty.</p>
                ) : (
                    <div className="flex-1 overflow-y-auto flex flex-col gap-4">
                        {cart.map((item) => (
                            <div
                                key={item.id}
                                className="flex justify-between items-start border-b pb-3"
                            >
                                <div className="min-w-0">
                                    <h3 className="font-semibold truncate">{item.name}</h3>
                                    <p className="text-sm text-gray-600">₱{item.price}</p>

                                    <div className="flex items-center gap-2 mt-2">
                                        <button
                                            onClick={() => decreaseQty(item.id)}
                                            className="w-9 h-9 rounded-full border border-gray-300 text-lg font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                            disabled={item.quantity <= 1}
                                            aria-label="Decrease quantity"
                                        >
                                            -
                                        </button>

                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            value={item.quantity}
                                            onChange={(e) => setQty(item.id, e.target.value)}
                                            className="w-16 h-9 text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black/20"
                                            aria-label="Quantity"
                                        />

                                        <button
                                            onClick={() => increaseQty(item.id)}
                                            className="w-9 h-9 rounded-full border border-gray-300 text-lg font-bold text-gray-700 hover:bg-gray-50"
                                            aria-label="Increase quantity"
                                        >
                                            +
                                        </button>

                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            className="ml-2 text-red-500 text-sm hover:underline"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>

                                <div className="font-bold whitespace-nowrap">
                                    ₱{Number(item.price) * Number(item.quantity)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span>₱{totalPrice}</span>
                    </div>

                    <button
                        onClick={handleCheckout}
                        className="mt-4 w-full bg-black text-white py-2 rounded font-semibold hover:bg-neutral-800 disabled:opacity-60"
                        disabled={cart.length === 0}
                    >
                        Checkout
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CartModal;
