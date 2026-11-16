import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false } } });
const root = ReactDOM.createRoot(document.getElementById("root")!);

if (!publishableKey) {
  root.render(<div className="fatal"><h1>Konfigurasi tidak lengkap</h1><p>VITE_CLERK_PUBLISHABLE_KEY tidak ada. Autentikasi wajib dan tidak pernah diganti mock.</p></div>);
} else {
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/" signInFallbackRedirectUrl="/app" signUpFallbackRedirectUrl="/app"
        appearance={{ variables: { colorPrimary: "#7aa2ff", colorBackground: "#0f1729", colorText: "#e9edf8", colorInputBackground: "#0b1120", colorInputText: "#e9edf8", borderRadius: "10px" } }}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter><App /></BrowserRouter>
        </QueryClientProvider>
      </ClerkProvider>
    </React.StrictMode>,
  );
}
