import React, { useEffect, useState } from "react";

export default function MenuItemModal({ open, onClose, item, onAddToCart }) {
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (open) setQuantity(1);
    }, [open, item]);

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") onClose?.();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    if (!open || !item) return null;

    const handleIncrement = () => setQuantity((p) => p + 1);
    const handleDecrement = () => setQuantity((p) => (p > 1 ? p - 1 : 1));

    const handleAddToCart = () => {
        onAddToCart(item, quantity);
        onClose();
    };

    const formatPrice = (p) =>
        new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
        }).format(p);

    const totalPrice = (item.price || 0) * quantity;
    const prep = item.prep_time ? `${item.prep_time} mins` : "";
    const weight = item.weight ? item.weight : "";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            role="dialog"
            aria-modal="true"
        >
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-transform active:scale-95"
                >
                    <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="h-64 w-full bg-gray-100 shrink-0">
                    {item.image_url ? (
                        <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <i className="fa-solid fa-image text-4xl" />
                        </div>
                    )}
                </div>

                <div className="flex flex-col flex-1 p-6 overflow-y-auto">
                    <div className="flex justify-between items-start gap-4 mb-2">
                        <h3 className="text-2xl font-bold text-gray-900 leading-tight">
                            {item.name}
                        </h3>
                        <span className="text-xl font-bold text-black">
                            ₱{item.price}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-4 font-medium">
                        {prep && (
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md">
                                <i className="fa-regular fa-clock" /> {prep}
                            </span>
                        )}
                        {weight && (
                            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-md">
                                <i className="fa-solid fa-weight-hanging" /> {weight}
                            </span>
                        )}
                    </div>

                    <p className="text-gray-600 leading-relaxed mb-6">
                        {item.description || "Made fresh to order, perfectly seasoned and crispy."}
                    </p>

                    <div className="mt-auto pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between gap-4">

                            <div className="flex items-center border border-gray-300 rounded-full px-1 py-1">
                                <button
                                    onClick={handleDecrement}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition text-lg font-medium"
                                >
                                    −
                                </button>
                                <span className="w-8 text-center font-bold text-lg">{quantity}</span>
                                <button
                                    onClick={handleIncrement}
                                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200 transition text-lg font-medium"
                                >
                                    +
                                </button>
                            </div>

                            <button
                                onClick={handleAddToCart}
                                className="flex-1 bg-black text-white font-bold py-3 px-4 rounded-full hover:bg-neutral-800 active:scale-95 transition flex justify-between items-center shadow-lg"
                            >
                                <span>Add to Order</span>
                                <span>{formatPrice(totalPrice)}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}