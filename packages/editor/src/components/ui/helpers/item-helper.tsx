interface ItemHelperProps {
  showEsc?: boolean
}

export function ItemHelper({ showEsc }: ItemHelperProps) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-40 flex flex-col gap-2 rounded-lg border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm">
        <kbd className="rounded bg-muted px-2 py-1 font-medium text-xs">R</kbd>
        <span className="text-muted-foreground">Rotar en sentido antihorario</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <kbd className="rounded bg-muted px-2 py-1 font-medium text-xs">T</kbd>
        <span className="text-muted-foreground">Rotar en sentido horario</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <kbd className="rounded bg-muted px-2 py-1 font-medium text-xs">Shift</kbd>
        <span className="text-muted-foreground">Ubicación libre</span>
      </div>
      {showEsc && (
        <div className="flex items-center gap-2 text-sm">
          <kbd className="rounded bg-muted px-2 py-1 font-medium text-xs">Esc</kbd>
          <span className="text-muted-foreground">Cancelar</span>
        </div>
      )}
    </div>
  )
}
