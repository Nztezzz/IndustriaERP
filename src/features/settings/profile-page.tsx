import { PageHeader } from "@/components/layout/page-header"
import { ModulePlaceholder } from "@/components/layout/module-placeholder"

export function ProfilePage() {
  return (
    <>
      <PageHeader title="My Profile" description="Account details." />
      <ModulePlaceholder note="Profile page is built alongside the auth backend pass." />
    </>
  )
}
