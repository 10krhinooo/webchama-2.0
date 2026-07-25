import { useKeycloak } from "@react-keycloak/web"

interface Props {
  className?: string
  children: React.ReactNode
}

/** Sends a new visitor into Keycloak's self-service registration flow, landing back on My Chamas to create their first chama. */
export default function StartChamaCta({ className, children }: Props) {
  const { keycloak } = useKeycloak()

  return (
    <button
      type="button"
      onClick={() => keycloak.register({ redirectUri: `${window.location.origin}/my-chamas` })}
      className={className}
    >
      {children}
    </button>
  )
}
