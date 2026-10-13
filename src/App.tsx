import { RouterProvider, type createBrowserRouter } from "react-router-dom";

import { useSession } from "./auth/sessionContext";
import { RefreshProvider } from "./refresh";
import SignIn from "./pages/SignIn";

/** The pages for an admin, the sign-in page otherwise */
export default function App({ router }: { router: ReturnType<typeof createBrowserRouter> }) {
  const { state } = useSession();
  if (state.status === "loading") {
    return <title>Administration</title>;
  }
  if (state.status === "signedOut") {
    return <SignIn state={state} />;
  }
  return (
    <RefreshProvider>
      <RouterProvider router={router} />
    </RefreshProvider>
  );
}
