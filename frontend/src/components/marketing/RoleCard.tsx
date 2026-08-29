interface RoleCardProps {
  role: string
  items: string[]
}

export default function RoleCard({ role, items }: RoleCardProps) {
  return (
    <div className="rounded-lg border border-border bg-paper p-6 shadow-card">
      <h3 className="font-heading text-sm font-semibold uppercase tracking-widest text-brand">{role}</h3>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-sm text-ink/80">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
