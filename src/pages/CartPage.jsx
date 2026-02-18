import { useCart } from "../context/Cart"

function CartPage() {
    const { cart, removeFromCart, totalPrice } = useCart();

    if (cart.length === 0) {
        return <p className="p-4">Your cart is empty.</p>;
    }

    return (
        <div className="max-w-4xl mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Your Cart</h1>

            <div className="flex flex-col gap-4">
                {cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center border p-4">
                        <div>
                            <h2 className="font-semibold">{item.name}</h2>
                            <p>₱{item.price} × {item.quantity}</p>
                        </div>

                        <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-red-500"
                        >
                            Remove
                        </button>
                    </div>
                ))}
            </div>

            <div className="mt-6 text-right">
                <h2 className="text-xl font-bold">
                    Total: ₱{totalPrice}
                </h2>
            </div>
        </div>
    );
}

export default CartPage