import ChamaMark from "../marketing/ChamaMark"

export default function PublicFooter() {
  return (
    <footer className="bg-night text-on-dark/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center">
        <ChamaMark className="h-8 w-8 text-on-dark/40" />
        <p className="font-heading text-sm font-semibold">Webchama</p>
        <p className="text-xs text-on-dark/50">
          &copy; {new Date().getFullYear()} Webchama. Built for chamas, not spreadsheets.
        </p>
      </div>
    </footer>
  )
}
