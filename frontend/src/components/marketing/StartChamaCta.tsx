import { useKeycloak } from "@react-keycloak/web"
import { useReducedMotion } from "../../hooks/useReducedMotion"
import { leaveThen } from "../../lib/leaveTransition"

interface Props {
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

/** Sends a new visitor into Keycloak's self-service registration flow, landing back on My Chamas to create their first chama. */
export default function StartChamaCta({ className, children, onClick }: Props) {
  const { keycloak } = useKeycloak()
  const reducedMotion = useReducedMotion()

  return (
    <button
      type="button"
      onClick={() => {
        onClick?.()
        // Keycloak is a different origin, so nothing can animate across the navigation itself.
        // This is the half on this side: the page hands over rather than cutting to a white flash.
        leaveThen(
          () => keycloak.register({ redirectUri: `${window.location.origin}/my-chamas` }),
          reducedMotion,
        )
      }}
      className={className}
    >
      {children}
    </button>
  )
}
