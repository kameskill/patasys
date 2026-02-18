import React from "react";

function Footer() {
    return (
        <footer className="w-full bg-white border-t border-gray-300 mt-12">
            <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-700 flex flex-col gap-2">

                <div className="flex flex-wrap justify-center items-center gap-4">
                    <span className="flex items-center gap-1">
                        <i className="fa-regular fa-clock" />
                        9:00AM to 7:00PM | Monday to Saturday
                    </span>

                    <span className="flex items-center gap-1">
                        <i className="fa-solid fa-location-dot" />
                        140 F. Vergel De Dios Street, Concepcion, Baliwag, Bulacan
                    </span>
                </div>

                <div className="flex justify-center items-center gap-1">
                    <i className="fa-solid fa-phone" />
                    Phone Number: (+63) 913 456 7890
                </div>

                <div className="flex justify-center items-center gap-2">
                    <i className="fa-brands fa-facebook text-lg" />
                    Crispy Pata sa A.Luna
                </div>

                <div className="text-xs text-gray-500 mt-2">
                    Copyright © {new Date().getFullYear()} Crispy Pata sa A.Luna All Rights Reserved.
                </div>

            </div>
        </footer>
    );
}

export default Footer;
