import {Outlet} from "react-router-dom";
import Navbar from "../navbar/navbar";

export default function Layout() {
    return (
        <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-100 overflow-hidden">
            <Navbar />
            <main className="flex-1 min-h-0 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
}
