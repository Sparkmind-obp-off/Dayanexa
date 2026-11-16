import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Show } from "@clerk/react";
import { SessionProvider } from "./lib/session";
import { Loading } from "./components/ui";
import { Catalog, Contact, Faq, HowItWorks, Landing, Legal, Pricing, PublicLayout, SignInPage, SignUpPage } from "./pages/Public";

const AppShell = lazy(() => import("./pages/AppShell"));

function Protected() {
  return <>
    <Show when="signed-in"><SessionProvider><Suspense fallback={<Loading label="Memuat aplikasi…" />}><AppShell /></Suspense></SessionProvider></Show>
    <Show when="signed-out"><Navigate to="/sign-in" replace /></Show>
  </>;
}

export default function App() {
  return <Routes>
    <Route element={<PublicLayout />}>
      <Route index element={<Landing />} />
      <Route path="how-it-works" element={<HowItWorks />} />
      <Route path="catalog" element={<Catalog />} />
      <Route path="pricing" element={<Pricing />} />
      <Route path="faq" element={<Faq />} />
      <Route path="contact" element={<Contact />} />
      <Route path="terms" element={<Legal doc="terms" />} />
      <Route path="privacy" element={<Legal doc="privacy" />} />
      <Route path="refund-policy" element={<Legal doc="refund-policy" />} />
      <Route path="contributor-terms" element={<Legal doc="contributor-terms" />} />
      <Route path="sign-in/*" element={<SignInPage />} />
      <Route path="sign-up/*" element={<SignUpPage />} />
    </Route>
    <Route path="app/*" element={<Protected />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
