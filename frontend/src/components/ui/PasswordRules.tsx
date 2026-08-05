const RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number (0–9)', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character (!@#$%^&*)', test: (p: string) => /[!@#$%^&*]/.test(p) },
]

export function passwordValid(p: string) {
  return RULES.every((r) => r.test(p))
}

export default function PasswordRules({ password }: { password: string }) {
  if (!password) return null
  return (
    <ul className="mt-2 space-y-1">
      {RULES.map((r) => {
        const ok = r.test(password)
        return (
          <li key={r.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-success' : 'text-muted'}`}>
            <span className="font-bold">{ok ? '✓' : '✗'}</span>
            {r.label}
          </li>
        )
      })}
    </ul>
  )
}
