import { createBrowserRouter, RouterProvider } from "react-router";
import { PlayLayout } from "@/app/layouts/PlayLayout";
import { paths } from "@/shared/config/routes";
import { HomePage } from "@/pages/HomePage";
import { ShuffleboardPlayPage } from "@/pages/ShuffleboardPlayPage";
import { ShuffleboardTvPage } from "@/pages/ShuffleboardTvPage";

const router = createBrowserRouter([
  { path: paths.shuffleboard, element: <ShuffleboardTvPage /> },
  {
    element: <PlayLayout />,
    children: [
      { path: paths.home, element: <HomePage /> },
      { path: paths.playShuffleboard, element: <ShuffleboardPlayPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
