export function WallHelper() {
  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-border bg-background/95 px-4 py-2 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm">
        <kbd className="rounded bg-muted px-2 py-1 font-medium text-xs">Shift</kbd>
        <span className="text-muted-foreground">Permitir ángulos distintos de 45°</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <kbd className="rounded bg-muted px-2 py-1 font-medium text-xs">Esc</kbd>
        <span className="text-muted-foreground">Cancelar</span>
      </div>
    </div>
  )
}
