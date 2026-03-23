import { Keyboard } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './../../../../../components/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './../../../../../components/ui/primitives/dialog'

type Shortcut = {
  keys: string[]
  action: string
  note?: string
}

type ShortcutCategory = {
  title: string
  shortcuts: Shortcut[]
}

const KEY_DISPLAY_MAP: Record<string, string> = {
  'Arrow Up': '↑',
  'Arrow Down': '↓',
  Esc: '⎋',
  Shift: '⇧',
  Space: '␣',
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Navegación del editor',
    shortcuts: [
      { keys: ['1'], action: 'Cambiar a fase Sitio' },
      { keys: ['2'], action: 'Cambiar a fase Estructura' },
      { keys: ['3'], action: 'Cambiar a fase Mobiliario' },
      { keys: ['S'], action: 'Cambiar a capa Estructura' },
      { keys: ['F'], action: 'Cambiar a capa Mobiliario' },
      { keys: ['Z'], action: 'Cambiar a capa Zonas' },
      {
        keys: ['Cmd/Ctrl', 'Arrow Up'],
        action: 'Seleccionar el siguiente nivel en el edificio activo',
      },
      {
        keys: ['Cmd/Ctrl', 'Arrow Down'],
        action: 'Seleccionar el nivel anterior en el edificio activo',
      },
      { keys: ['Cmd/Ctrl', 'B'], action: 'Mostrar/ocultar barra lateral' },
    ],
  },
  {
    title: 'Modos e historial',
    shortcuts: [
      { keys: ['V'], action: 'Cambiar a modo Selección' },
      { keys: ['B'], action: 'Cambiar a modo Construcción' },
      {
        keys: ['Esc'],
        action: 'Cancelar herramienta activa, limpiar selección y salir de construcción',
      },
      { keys: ['Delete / Backspace'], action: 'Eliminar objetos seleccionados' },
      { keys: ['Cmd/Ctrl', 'Z'], action: 'Deshacer' },
      { keys: ['Cmd/Ctrl', 'Shift', 'Z'], action: 'Rehacer' },
    ],
  },
  {
    title: 'Selección',
    shortcuts: [
      {
        keys: ['Cmd/Ctrl', 'Click'],
        action: 'Agregar o quitar un objeto de la multiselección',
        note: 'Funciona en modo Selección.',
      },
    ],
  },
  {
    title: 'Herramientas de dibujo',
    shortcuts: [
      {
        keys: ['Shift'],
        action: 'Desactivar temporalmente el ajuste de ángulo al dibujar muros, losas y cielos',
        note: 'Mantén presionado mientras dibujas.',
      },
    ],
  },
  {
    title: 'Colocación de ítems',
    shortcuts: [
      { keys: ['R'], action: 'Rotar ítem 90° en sentido horario' },
      { keys: ['T'], action: 'Rotar ítem 90° en sentido antihorario' },
      {
        keys: ['Shift'],
        action: 'Omitir temporalmente las validaciones de colocación',
        note: 'Mantén presionado mientras colocas.',
      },
    ],
  },
  {
    title: 'Cámara',
    shortcuts: [
      {
        keys: ['Space', 'Drag'],
        action: 'Desplazar cámara',
        note: 'Mantén Espacio mientras arrastras con el mouse.',
      },
    ],
  },
]

function getDisplayKey(key: string, isMac: boolean): string {
  if (key === 'Cmd/Ctrl') return isMac ? '⌘' : 'Ctrl'
  if (key === 'Delete / Backspace') return isMac ? '⌫' : 'Backspace'
  return KEY_DISPLAY_MAP[key] ?? key
}

function ShortcutKeys({ keys }: { keys: string[] }) {
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-1">
      {keys.map((key, index) => (
        <div className="flex items-center gap-1" key={`${key}-${index}`}>
          {index > 0 ? <span className="text-[10px] text-muted-foreground">+</span> : null}
          <kbd
            className="inline-flex h-6 items-center rounded border border-border bg-muted px-2 font-medium font-mono text-[11px] text-muted-foreground"
            title={key}
          >
            {getDisplayKey(key, isMac)}
          </kbd>
        </div>
      ))}
    </div>
  )
}

export function KeyboardShortcutsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full justify-start gap-2" variant="outline">
          <Keyboard className="size-4" />
          Atajos de teclado
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>
            Los atajos dependen del contexto y de la fase o herramienta actual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {SHORTCUT_CATEGORIES.map((category) => (
            <section className="space-y-2" key={category.title}>
              <h3 className="font-medium text-sm">{category.title}</h3>
              <div className="overflow-hidden rounded-md border border-border/80">
                {category.shortcuts.map((shortcut, index) => (
                  <div
                    className="grid grid-cols-[minmax(130px,220px)_1fr] gap-3 px-3 py-2"
                    key={`${category.title}-${shortcut.action}`}
                  >
                    <ShortcutKeys keys={shortcut.keys} />
                    <div>
                      <p className="text-sm">{shortcut.action}</p>
                      {shortcut.note ? (
                        <p className="text-muted-foreground text-xs">{shortcut.note}</p>
                      ) : null}
                    </div>
                    {index < category.shortcuts.length - 1 ? (
                      <div className="col-span-2 border-border/60 border-b" />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
