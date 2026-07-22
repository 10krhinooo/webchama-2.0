import WeaveMark from "../marketing/WeaveMark"

export default function PublicFooter() {
  return (
    <footer className="bg-night text-paper/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center">
        <WeaveMark className="h-8 w-8 text-paper/40" />
        <p className="font-heading text-sm font-semibold">Webchama</p>
        <p className="text-xs text-paper/50">
          &copy; {new Date().getFullYear()} Webchama. Built for chamas, not spreadsheets.
        </p>
      </div>
    </footer>
  )
}
