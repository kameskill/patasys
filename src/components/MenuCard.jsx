import React from "react";

export default function MenuCard({
    image,
    name,
    description,
    weight,
    prepTime,
    price,
    onAdd,
    onImageClick,
}) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
            <div className="relative overflow-hidden">
                <img
                    src={image}
                    alt={name}
                    onClick={onImageClick}
                    className="w-full h-32 md:h-48 object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                />
            </div>

            <div className="p-3 md:p-4 flex flex-col flex-1 justify-between gap-2">
                <div>
                    <div className="flex justify-between items-start gap-1">
                        <h3
                            className="text-sm md:text-lg font-bold text-gray-900 leading-tight cursor-pointer line-clamp-2"
                            onClick={onImageClick}
                        >
                            {name}
                        </h3>
                    </div>

                    {description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 md:line-clamp-3">
                            {description}
                        </p>
                    )}

                    <div className="flex items-center gap-2 text-[10px] md:text-sm text-gray-400 mt-2 font-medium">
                        {weight && <span>{weight}</span>}
                        {weight && prepTime && <span>•</span>}
                        {prepTime && <span>{prepTime}</span>}
                    </div>
                </div>

                <div className="flex items-center justify-between pt-2 mt-auto">
                    <p className="text-sm md:text-lg font-bold text-black">₱{price}</p>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onAdd?.();
                        }}
                        className="group flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-black text-white font-semibold hover:bg-neutral-800 active:scale-95 transition cursor-pointer"
                    >
                        <i className="fa-solid fa-plus text-xs" />
                        <span className="text-xs md:text-sm hidden md:inline">Add</span>
                    </button>
                </div>
            </div>
        </div>
    );
}