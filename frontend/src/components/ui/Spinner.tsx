export default function Spinner({
  size = 'md',
  color = 'primary',
}: {
  size?: 'sm' | 'md' | 'lg'
  color?: 'primary' | 'white'
}) {
  const sz = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }[size]
  const track = color === 'white' ? 'border-white/30' : 'border-primary/20'
  const spin = color === 'white' ? 'border-t-white' : 'border-t-primary'
  return (
    <div className={`relative ${sz}`}>
      <div className={`absolute inset-0 rounded-full border-2 ${track}`} />
      <div className={`absolute inset-0 rounded-full border-2 border-transparent ${spin} animate-spin`} />
    </div>
  )
}
