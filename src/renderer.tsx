import {createRoot} from "react-dom/client";
import React from "react";
import {HashRouter, Route, Routes} from "react-router-dom";
import Layout from "./components/layout/layout";
import Home from "./components/home/home";
import Admin from "./components/settings/admin";
import ServerSettings from "./components/settings/server";
import Statistics from "./components/statistics/statistics";
import {ToastProvider} from "./components/shared/toast-context";
import ToastContainer from "./components/shared/toast-container";
import Directory from "./components/settings/directory";

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <React.StrictMode>
        <ToastProvider>
            <HashRouter>
                <Routes>
                    <Route element={<Layout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/statistics" element={<Statistics />} />
                        <Route path="/settings/directory" element={<Directory />} />
                        <Route path="/settings/settings" element={<ServerSettings />} />
                    </Route>
                </Routes>
            </HashRouter>
            <ToastContainer />
        </ToastProvider>
    </React.StrictMode>
);
