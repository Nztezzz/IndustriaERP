import { createFileRoute } from "@tanstack/react-router"
import { ProfilePage } from "@/features/settings/profile-page"

export const Route = createFileRoute("/_authenticated/settings/profile")({
  component: ProfilePage,
})
