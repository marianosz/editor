'use client'

import type { AnyNodeId } from '@pascal-app/core'
import { emitter, LevelNode, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { Command } from 'cmdk'
import {
  AppWindow,
  ArrowRight,
  Box,
  Building2,
  Camera,
  ChevronRight,
  Copy,
  DoorOpen,
  Eye,
  EyeOff,
  FileJson,
  Grid3X3,
  Hexagon,
  Layers,
  Map,
  Maximize2,
  Minimize2,
  Moon,
  MousePointer2,
  Package,
  PencilLine,
  Plus,
  Redo2,
  Search,
  Square,
  SquareStack,
  Sun,
  Trash2,
  Undo2,
  Video,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'
import { Dialog, DialogContent } from './../../../components/ui/primitives/dialog'
import type { StructureTool } from './../../../store/use-editor'
import useEditor from './../../../store/use-editor'

// ---------------------------------------------------------------------------
// Open-state store — imported by icon-rail to trigger the palette
// ---------------------------------------------------------------------------
interface CommandPaletteStore {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useCommandPalette = create<CommandPaletteStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5">
      {keys.map((k) => (
        <kbd
          className="flex min-w-4.5 items-center justify-center rounded border border-border/60 bg-muted/60 px-1 py-0.5 text-[10px] text-muted-foreground leading-none"
          key={k}
        >
          {k}
        </kbd>
      ))}
    </span>
  )
}

function Item({
  icon,
  label,
  onSelect,
  shortcut,
  disabled = false,
  keywords = [],
  badge,
  navigate = false,
}: {
  icon: React.ReactNode
  label: string
  onSelect: () => void
  shortcut?: string[]
  disabled?: boolean
  keywords?: string[]
  badge?: string
  navigate?: boolean
}) {
  return (
    <Command.Item
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground text-sm transition-colors data-[disabled=true]:cursor-not-allowed data-[selected=true]:bg-accent data-[disabled=true]:opacity-40"
      disabled={disabled}
      keywords={keywords}
      onSelect={onSelect}
      value={label}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {badge}
        </span>
      )}
      {shortcut && <Shortcut keys={shortcut} />}
      {(badge || navigate) && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
    </Command.Item>
  )
}

function OptionItem({
  label,
  isActive = false,
  onSelect,
  icon,
  disabled = false,
}: {
  label: string
  isActive?: boolean
  onSelect: () => void
  icon?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <Command.Item
      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground text-sm transition-colors data-[disabled=true]:cursor-not-allowed data-[selected=true]:bg-accent data-[disabled=true]:opacity-40"
      disabled={disabled}
      onSelect={onSelect}
      value={label}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
        {isActive ? <div className="h-1.5 w-1.5 rounded-full bg-primary" /> : icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
    </Command.Item>
  )
}

// ---------------------------------------------------------------------------
// Sub-page label map
// ---------------------------------------------------------------------------
const PAGE_LABEL: Record<string, string> = {
  'wall-mode': 'Modo de muros',
  'level-mode': 'Modo de niveles',
  'rename-level': 'Renombrar nivel',
  'goto-level': 'Ir a nivel',
  'camera-view': 'Captura de cámara',
  'camera-scope': '', // dynamic — overridden in breadcrumb
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function CommandPalette() {
  const { open, setOpen } = useCommandPalette()
  const [meta, setMeta] = useState('⌘')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pages, setPages] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const [cameraScope, setCameraScope] = useState<{ nodeId: string; label: string } | null>(null)

  const page = pages[pages.length - 1]

  const { setPhase, setMode, setTool, setStructureLayer, isPreviewMode, setPreviewMode } =
    useEditor()

  const cameraMode = useViewer((s) => s.cameraMode)
  const setCameraMode = useViewer((s) => s.setCameraMode)
  const levelMode = useViewer((s) => s.levelMode)
  const setLevelMode = useViewer((s) => s.setLevelMode)
  const wallMode = useViewer((s) => s.wallMode)
  const setWallMode = useViewer((s) => s.setWallMode)
  const theme = useViewer((s) => s.theme)
  const setTheme = useViewer((s) => s.setTheme)
  const selection = useViewer((s) => s.selection)
  const exportScene = useViewer((s) => s.exportScene)

  const activeLevelId = selection.levelId
  const activeLevelNode = useScene((s) => (activeLevelId ? s.nodes[activeLevelId] : null))
  const isLevelZero =
    activeLevelNode?.type === 'level' && (activeLevelNode as LevelNode).level === 0

  // Reactive snapshot status for the selected camera scope
  const cameraScopeNode = useScene((s) =>
    cameraScope ? s.nodes[cameraScope.nodeId as AnyNodeId] : null,
  )
  const hasScopeSnapshot = !!(cameraScopeNode as any)?.camera

  const allLevels = useScene(
    useShallow((s) =>
      (Object.values(s.nodes).filter((n) => n.type === 'level') as LevelNode[]).sort(
        (a, b) => a.level - b.level,
      ),
    ),
  )

  const hasSelection = selection.selectedIds.length > 0

  // Platform detection
  useEffect(() => {
    setMeta(/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl')
  }, [])

  // Fullscreen tracking
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Cmd/Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setOpen])

  // Reset sub-pages when palette closes
  useEffect(() => {
    if (!open) {
      setPages([])
      setInputValue('')
      setCameraScope(null)
    }
  }, [open])

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------
  const goBack = () => {
    const leavingPage = pages[pages.length - 1]
    if (leavingPage === 'camera-scope') setCameraScope(null)
    setPages((p) => p.slice(0, -1))
    setInputValue('')
  }

  const navigateTo = (p: string) => {
    // Pre-fill the rename input with the current level name
    if (p === 'rename-level' && activeLevelId) {
      const level = useScene.getState().nodes[activeLevelId] as LevelNode
      setInputValue(level?.name ?? '')
    } else {
      setInputValue('')
    }
    setPages((prev) => [...prev, p])
  }

  const navigateToCameraScope = (nodeId: string, label: string) => {
    setCameraScope({ nodeId, label })
    setInputValue('')
    setPages((prev) => [...prev, 'camera-scope'])
  }

  // ---------------------------------------------------------------------------
  // Action helpers
  // ---------------------------------------------------------------------------
  const run = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  const activateTool = (tool: StructureTool) => {
    run(() => {
      setPhase('structure')
      setMode('build')
      if (tool === 'zone') setStructureLayer('zones')
      setTool(tool)
    })
  }

  const wallModeLabel: Record<'cutaway' | 'up' | 'down', string> = {
    cutaway: 'Corte',
    up: 'Completo',
    down: 'Bajo',
  }
  const levelModeLabel: Record<'manual' | 'stacked' | 'exploded' | 'solo', string> = {
    manual: 'Manual',
    stacked: 'Apilado',
    exploded: 'Explotado',
    solo: 'Solo',
  }

  const deleteSelection = () => {
    if (!hasSelection) return
    run(() => {
      useScene.getState().deleteNodes(selection.selectedIds as any[])
    })
  }

  // Level management
  const addLevel = () =>
    run(() => {
      const { nodes } = useScene.getState()
      const building = Object.values(nodes).find((n) => n.type === 'building')
      if (!building) return
      const newLevel = LevelNode.parse({
        level: building.children.length,
        children: [],
        parentId: building.id,
      })
      useScene.getState().createNode(newLevel, building.id)
      useViewer.getState().setSelection({ levelId: newLevel.id })
    })

  const deleteActiveLevel = () => {
    if (!activeLevelId || isLevelZero) return
    run(() => {
      useScene.getState().deleteNode(activeLevelId as AnyNodeId)
      const { nodes } = useScene.getState()
      const level0 = Object.values(nodes).find(
        (n) => n.type === 'level' && (n as LevelNode).level === 0,
      )
      if (level0) useViewer.getState().setSelection({ levelId: level0.id as `level_${string}` })
    })
  }

  const confirmRename = () => {
    if (!(activeLevelId && inputValue.trim())) return
    run(() => {
      useScene.getState().updateNode(activeLevelId as AnyNodeId, { name: inputValue.trim() } as any)
    })
  }

  // Camera snapshot (scoped to the currently selected camera scope)
  const takeSnapshot = () => {
    if (!cameraScope) return
    run(() => emitter.emit('camera-controls:capture', { nodeId: cameraScope.nodeId as AnyNodeId }))
  }

  const viewSnapshot = () => {
    if (!(cameraScope && hasScopeSnapshot)) return
    run(() => emitter.emit('camera-controls:view', { nodeId: cameraScope.nodeId as AnyNodeId }))
  }

  const clearSnapshot = () => {
    if (!(cameraScope && hasScopeSnapshot)) return
    run(() => {
      useScene.getState().updateNode(cameraScope.nodeId as AnyNodeId, { camera: undefined } as any)
    })
  }

  // Export helpers
  const exportJson = () =>
    run(() => {
      const { nodes, rootNodeIds } = useScene.getState()
      const blob = new Blob([JSON.stringify({ nodes, rootNodeIds }, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `scene_${new Date().toISOString().split('T')[0]}.json`,
      })
      a.click()
      URL.revokeObjectURL(url)
    })

  const copyShareLink = () =>
    run(() => {
      navigator.clipboard.writeText(window.location.href)
    })

  const takeScreenshot = () =>
    run(() => {
      const canvas = document.querySelector('canvas')
      if (!canvas) return
      const a = Object.assign(document.createElement('a'), {
        href: canvas.toDataURL('image/png'),
        download: `screenshot_${new Date().toISOString().split('T')[0]}.png`,
      })
      a.click()
    })

  const toggleFullscreen = () =>
    run(() => {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
    })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0" showCloseButton={false}>
        <Command
          className="**:[[cmdk-group-heading]]:px-2.5 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:text-[10px] **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wider"
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !inputValue && pages.length > 0) {
              e.preventDefault()
              goBack()
            }
          }}
          shouldFilter={page !== 'rename-level'}
        >
          {/* Search bar */}
          <div className="flex items-center border-border/50 border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            {page && (
              <button
                className="mr-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/70"
                onClick={goBack}
                type="button"
              >
                {page === 'camera-scope'
                  ? (cameraScope?.label ?? 'Captura')
                  : (PAGE_LABEL[page] ?? page)}
              </button>
            )}
            <Command.Input
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onValueChange={setInputValue}
              placeholder={
                page === 'rename-level'
                  ? 'Escribe un nombre nuevo…'
                  : page
                    ? 'Filtrar opciones…'
                    : 'Buscar acciones…'
              }
              value={inputValue}
            />
          </div>

          <Command.List className="max-h-100 overflow-y-auto p-1.5">
            <Command.Empty className="py-8 text-center text-muted-foreground text-sm">
              No se encontraron comandos.
            </Command.Empty>

            {/* ── Root view ─────────────────────────────────────────────── */}
            {!page && (
              <>
                {/* Scene / Tools */}
                <Command.Group heading="Escena">
                  <Item
                    icon={<Square className="h-4 w-4" />}
                    keywords={['draw', 'build', 'structure']}
                    label="Herramienta Muro"
                    onSelect={() => activateTool('wall')}
                  />
                  <Item
                    icon={<Layers className="h-4 w-4" />}
                    keywords={['floor', 'build']}
                    label="Herramienta Losa"
                    onSelect={() => activateTool('slab')}
                  />
                  <Item
                    icon={<Grid3X3 className="h-4 w-4" />}
                    keywords={['top', 'build']}
                    label="Herramienta Cielo"
                    onSelect={() => activateTool('ceiling')}
                  />
                  <Item
                    icon={<DoorOpen className="h-4 w-4" />}
                    keywords={['opening', 'entrance']}
                    label="Herramienta Puerta"
                    onSelect={() => activateTool('door')}
                  />
                  <Item
                    icon={<AppWindow className="h-4 w-4" />}
                    keywords={['opening', 'glass']}
                    label="Herramienta Ventana"
                    onSelect={() => activateTool('window')}
                  />
                  <Item
                    icon={<Package className="h-4 w-4" />}
                    keywords={['furniture', 'object', 'asset', 'furnish']}
                    label="Herramienta Ítem"
                    onSelect={() => activateTool('item')}
                  />
                  <Item
                    icon={<Hexagon className="h-4 w-4" />}
                    keywords={['area', 'room', 'space']}
                    label="Herramienta Zona"
                    onSelect={() => activateTool('zone')}
                  />
                  <Item
                    disabled={!hasSelection}
                    icon={<Trash2 className="h-4 w-4" />}
                    keywords={['remove', 'erase']}
                    label="Eliminar selección"
                    onSelect={deleteSelection}
                    shortcut={['⌫']}
                  />
                </Command.Group>

                {/* Levels */}
                <Command.Group heading="Niveles">
                  <Item
                    disabled={allLevels.length === 0}
                    icon={<ArrowRight className="h-4 w-4" />}
                    keywords={['level', 'floor', 'go', 'navigate', 'switch', 'select']}
                    label="Ir a nivel"
                    navigate
                    onSelect={() => navigateTo('goto-level')}
                  />
                  <Item
                    icon={<Plus className="h-4 w-4" />}
                    keywords={['level', 'floor', 'add', 'create', 'new']}
                    label="Agregar nivel"
                    onSelect={addLevel}
                  />
                  <Item
                    disabled={!activeLevelId}
                    icon={<PencilLine className="h-4 w-4" />}
                    keywords={['level', 'floor', 'rename', 'name']}
                    label="Renombrar nivel"
                    navigate
                    onSelect={() => navigateTo('rename-level')}
                  />
                  <Item
                    disabled={!activeLevelId || isLevelZero}
                    icon={<Trash2 className="h-4 w-4" />}
                    keywords={['level', 'floor', 'delete', 'remove']}
                    label="Eliminar nivel"
                    onSelect={deleteActiveLevel}
                  />
                </Command.Group>

                {/* Viewer Controls */}
                <Command.Group heading="Controles del visor">
                  <Item
                    badge={wallModeLabel[wallMode]}
                    icon={<Layers className="h-4 w-4" />}
                    keywords={['wall', 'cutaway', 'up', 'down', 'view']}
                    label="Modo de muros"
                    onSelect={() => navigateTo('wall-mode')}
                  />
                  <Item
                    badge={levelModeLabel[levelMode]}
                    icon={<SquareStack className="h-4 w-4" />}
                    keywords={['level', 'floor', 'exploded', 'stacked', 'solo']}
                    label="Modo de niveles"
                    onSelect={() => navigateTo('level-mode')}
                  />
                  <Item
                    icon={<Video className="h-4 w-4" />}
                    keywords={['camera', 'ortho', 'perspective', '2d', '3d', 'view']}
                    label={`Cámara: cambiar a ${cameraMode === 'perspective' ? 'Ortográfica' : 'Perspectiva'}`}
                    onSelect={() =>
                      run(() =>
                        setCameraMode(
                          cameraMode === 'perspective' ? 'orthographic' : 'perspective',
                        ),
                      )
                    }
                  />
                  <Item
                    icon={
                      theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
                    }
                    keywords={['theme', 'dark', 'light', 'appearance', 'color']}
                    label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                    onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
                  />
                  <Item
                    icon={<Camera className="h-4 w-4" />}
                    keywords={['camera', 'snapshot', 'capture', 'save', 'view', 'bookmark']}
                    label="Captura de cámara"
                    navigate
                    onSelect={() => navigateTo('camera-view')}
                  />
                </Command.Group>

                {/* View / Mode */}
                <Command.Group heading="Vista">
                  <Item
                    icon={
                      isPreviewMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />
                    }
                    keywords={['preview', 'view', 'read-only', 'present']}
                    label={isPreviewMode ? 'Salir de previsualización' : 'Entrar en previsualización'}
                    onSelect={() => run(() => setPreviewMode(!isPreviewMode))}
                  />
                  <Item
                    icon={
                      isFullscreen ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )
                    }
                    keywords={['fullscreen', 'maximize', 'expand', 'window']}
                    label={isFullscreen ? 'Salir de pantalla completa' : 'Entrar en pantalla completa'}
                    onSelect={toggleFullscreen}
                  />
                </Command.Group>

                {/* History */}
                <Command.Group heading="Historial">
                  <Item
                    icon={<Undo2 className="h-4 w-4" />}
                    keywords={['undo', 'revert', 'back']}
                    label="Deshacer"
                    onSelect={() => run(() => useScene.temporal.getState().undo())}
                    shortcut={[meta, 'Z']}
                  />
                  <Item
                    icon={<Redo2 className="h-4 w-4" />}
                    keywords={['redo', 'forward', 'repeat']}
                    label="Rehacer"
                    onSelect={() => run(() => useScene.temporal.getState().redo())}
                    shortcut={[meta, '⇧', 'Z']}
                  />
                </Command.Group>

                {/* Export / Share */}
                <Command.Group heading="Exportar y compartir">
                  <Item
                    icon={<FileJson className="h-4 w-4" />}
                    keywords={['export', 'download', 'json', 'save', 'data']}
                    label="Exportar escena (JSON)"
                    onSelect={exportJson}
                  />
                  {exportScene && (
                    <Item
                      icon={<Box className="h-4 w-4" />}
                      keywords={['export', 'glb', 'gltf', '3d', 'model', 'download']}
                      label="Exportar modelo 3D (GLB)"
                      onSelect={() => run(() => exportScene())}
                    />
                  )}
                  <Item
                    icon={<Copy className="h-4 w-4" />}
                    keywords={['share', 'copy', 'url', 'link']}
                    label="Copiar enlace"
                    onSelect={copyShareLink}
                  />
                  <Item
                    icon={<Camera className="h-4 w-4" />}
                    keywords={['screenshot', 'capture', 'image', 'photo', 'png']}
                    label="Tomar captura"
                    onSelect={takeScreenshot}
                  />
                </Command.Group>
              </>
            )}

            {/* ── Wall Mode sub-page ────────────────────────────────────── */}
            {page === 'wall-mode' && (
              <Command.Group heading="Modo de muros">
                {(['cutaway', 'up', 'down'] as const).map((mode) => (
                  <OptionItem
                    isActive={wallMode === mode}
                    key={mode}
                    label={wallModeLabel[mode]}
                    onSelect={() => run(() => setWallMode(mode))}
                  />
                ))}
              </Command.Group>
            )}

            {/* ── Level Mode sub-page ───────────────────────────────────── */}
            {page === 'level-mode' && (
              <Command.Group heading="Modo de niveles">
                {(['stacked', 'exploded', 'solo'] as const).map((mode) => (
                  <OptionItem
                    isActive={levelMode === mode}
                    key={mode}
                    label={levelModeLabel[mode]}
                    onSelect={() => run(() => setLevelMode(mode))}
                  />
                ))}
              </Command.Group>
            )}

            {/* ── Go to Level sub-page ──────────────────────────────────── */}
            {page === 'goto-level' && (
              <Command.Group heading="Ir a nivel">
                {allLevels.map((level) => (
                  <OptionItem
                    isActive={level.id === activeLevelId}
                    key={level.id}
                    label={level.name ?? `Nivel ${level.level}`}
                    onSelect={() =>
                      run(() => useViewer.getState().setSelection({ levelId: level.id }))
                    }
                  />
                ))}
              </Command.Group>
            )}

            {/* ── Rename Level sub-page ─────────────────────────────────── */}
            {page === 'rename-level' && (
              <Command.Group heading="Renombrar nivel">
                <Command.Item
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground text-sm transition-colors data-[disabled=true]:cursor-not-allowed data-[selected=true]:bg-accent data-[disabled=true]:opacity-40"
                  disabled={!inputValue.trim()}
                  onSelect={confirmRename}
                  value="confirm-rename"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                    <PencilLine className="h-4 w-4" />
                  </span>
                  <span className="flex-1 truncate">
                    {inputValue.trim() ? (
                      <>
                        Renombrar a <span className="font-medium">"{inputValue.trim()}"</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Escribe un nombre arriba…</span>
                    )}
                  </span>
                </Command.Item>
              </Command.Group>
            )}

            {/* ── Camera Snapshot: scope picker ─────────────────────────── */}
            {page === 'camera-view' && (
              <Command.Group heading="Captura de cámara — Seleccionar alcance">
                <OptionItem
                  icon={<Map className="h-4 w-4" />}
                  label="Sitio"
                  onSelect={() => {
                    const { rootNodeIds } = useScene.getState()
                    const siteId = rootNodeIds[0]
                    if (siteId) navigateToCameraScope(siteId, 'Sitio')
                  }}
                />
                <OptionItem
                  icon={<Building2 className="h-4 w-4" />}
                  label="Edificio"
                  onSelect={() => {
                    const building = Object.values(useScene.getState().nodes).find(
                      (n) => n.type === 'building',
                    )
                    if (building) navigateToCameraScope(building.id, 'Edificio')
                  }}
                />
                <OptionItem
                  disabled={!activeLevelId}
                  icon={<Layers className="h-4 w-4" />}
                  label="Nivel"
                  onSelect={() => {
                    if (activeLevelId) navigateToCameraScope(activeLevelId, 'Nivel')
                  }}
                />
                <OptionItem
                  disabled={!hasSelection}
                  icon={<MousePointer2 className="h-4 w-4" />}
                  label="Selección"
                  onSelect={() => {
                    const firstId = selection.selectedIds[0]
                    if (firstId) navigateToCameraScope(firstId, 'Selección')
                  }}
                />
              </Command.Group>
            )}

            {/* ── Camera Snapshot: actions for selected scope ───────────── */}
            {page === 'camera-scope' && cameraScope && (
              <Command.Group heading={`Captura de ${cameraScope.label}`}>
                <OptionItem
                  icon={<Camera className="h-4 w-4" />}
                  label={hasScopeSnapshot ? 'Actualizar captura' : 'Tomar captura'}
                  onSelect={takeSnapshot}
                />
                {hasScopeSnapshot && (
                  <OptionItem
                    icon={<Eye className="h-4 w-4" />}
                    label="Ver captura"
                    onSelect={viewSnapshot}
                  />
                )}
                {hasScopeSnapshot && (
                  <OptionItem
                    icon={<Trash2 className="h-4 w-4" />}
                    label="Borrar captura"
                    onSelect={clearSnapshot}
                  />
                )}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer hint */}
          <div className="flex items-center justify-between border-border/50 border-t px-3 py-2">
            <span className="text-[11px] text-muted-foreground">
              <Shortcut keys={['↑', '↓']} /> navegar
            </span>
            <span className="text-[11px] text-muted-foreground">
              <Shortcut keys={['↵']} /> seleccionar
            </span>
            {page ? (
              <span className="text-[11px] text-muted-foreground">
                <Shortcut keys={['⌫']} /> volver
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                <Shortcut keys={['Esc']} /> cerrar
              </span>
            )}
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
