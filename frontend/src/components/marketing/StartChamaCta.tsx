import { useKeycloak } from "@react-keycloak/web"

interface Props {
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

/** Sends a new visitor into Keycloak's self-service registration flow, landing back on My Chamas to create their first chama. */
export default function StartChamaCta({ className, children, onClick }: Props) {
  const { keycloak } = useKeycloak()

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.()
        keycloak.register({ redirectUri: `${window.location.origin}/my-chamas` })
      }}
      className={className}
    >
      {children}
    </button>
  )
}
