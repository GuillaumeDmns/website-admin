import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router-dom";

import App from "./App";
import { SessionProvider } from "./auth/session";
import { routes } from "./routes";
import "./styles/global.css";

const router = createBrowserRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <App router={router} />
    </SessionProvider>
  </StrictMode>,
);
