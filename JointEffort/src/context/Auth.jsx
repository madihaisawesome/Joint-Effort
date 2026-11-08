import { createContext, useContext, useMemo } from "react"
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react"
import { useNavigate } from "react-router-dom"
import { safeReturn } from "../lib/geo.js"

const AuthContext = createContext(null)

export const authConfigured = Boolean(
  import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID,
)

const stub = {
  configured: false,
  isLoading: false,
  isAuthenticated: false,
  user: null,
  error: "",
  login: () => {},
  logout: () => {},
}

function AuthBridge({ children }) {
  const auth = useAuth0()
  const value = useMemo(
    () => ({
      configured: true,
      isLoading: auth.isLoading,
      isAuthenticated: auth.isAuthenticated,
      user: auth.user,
      error: auth.error?.message || "",
      login: (returnTo) =>
        auth.loginWithRedirect({
          appState: { returnTo: safeReturn(returnTo) },
        }),
      logout: () =>
        auth.logout({
          logoutParams: { returnTo: window.location.origin },
        }),
    }),
    [auth],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthRoot({ children }) {
  const navigate = useNavigate()
  if (!authConfigured) {
    return <AuthContext.Provider value={stub}>{children}</AuthContext.Provider>
  }
  return (
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{ redirect_uri: window.location.origin }}
      cacheLocation="localstorage"
      onRedirectCallback={(appState) => {
        navigate(safeReturn(appState?.returnTo), { replace: true })
      }}
    >
      <AuthBridge>{children}</AuthBridge>
    </Auth0Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthRoot")
  return value
}
