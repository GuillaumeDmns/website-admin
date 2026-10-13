import type { RouteObject } from "react-router-dom";

import Layout from "./components/Layout";
import AccountsPage from "./pages/AccountsPage";
import Actions from "./pages/Actions";
import NetworkPage from "./pages/NetworkPage";
import NotFound from "./pages/NotFound";
import Overview from "./pages/Overview";
import SystemPage from "./pages/SystemPage";
import Usage from "./pages/Usage";

/** The pages of a signed-in admin */
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Overview /> },
      { path: "usage", element: <Usage /> },
      { path: "accounts", element: <AccountsPage /> },
      { path: "network", element: <NetworkPage /> },
      { path: "system", element: <SystemPage /> },
      { path: "actions", element: <Actions /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];
