import { emitter, useScene } from '@pascal-app/core'
import { useViewer } from '@pascal-app/viewer'
import { TreeView, VisualJson } from '@visual-json/react'
import { Camera, Download, Save, Trash2 } from 'lucide-react'
import {
  type KeyboardEvent,
  type SyntheticEvent,
  useCallback,
  useMemo,
  useState,
} from 'react'
import { Button } from './../../../../../components/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from './../../../../../components/ui/primitives/dialog'
import { Switch } from './../../../../../components/ui/primitives/switch'
import useEditor from './../../../../../store/use-editor'
import { AudioSettingsDialog } from './audio-settings-dialog'
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog'

type SceneNode = Record<string, unknown> & {
  id?: unknown
  type?: unknown
  name?: unknown
  parentId?: unknown
  children?: unknown
}

type SceneGraphNode = {
  id: string
  type: string
  name: string | null
  parentId: string | null
  children: SceneGraphNode[]
  missing?: true
  cycle?: true
}

type SceneGraphValue = {
  roots: SceneGraphNode[]
  detachedNodes?: SceneGraphNode[]
}

const isSceneNode = (value: unknown): value is SceneNode => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as { id: unknown }).id === 'string'
  )
}

const getChildIdsFromNode = (node: SceneNode): string[] => {
  if (!Array.isArray(node.children)) {
    return []
  }

  const childIds = new Set<string>()

  for (const child of node.children) {
    if (typeof child === 'string') {
      childIds.add(child)
      continue
    }

    if (isSceneNode(child)) {
      childIds.add(child.id as string)
    }
  }

  return Array.from(childIds)
}

const buildSceneGraphValue = (
  nodes: Record<string, SceneNode>,
  rootNodeIds: string[],
): SceneGraphValue => {
  const childIdsByParent = new Map<string, Set<string>>()

  for (const [id, node] of Object.entries(nodes)) {
    const childIds = getChildIdsFromNode(node)
    if (childIds.length > 0) {
      childIdsByParent.set(id, new Set(childIds))
    }
  }

  for (const [id, node] of Object.entries(nodes)) {
    if (typeof node.parentId !== 'string') {
      continue
    }

    const siblings = childIdsByParent.get(node.parentId) ?? new Set<string>()
    siblings.add(id)
    childIdsByParent.set(node.parentId, siblings)
  }

  const visited = new Set<string>()

  const buildNode = (id: string, path: Set<string>): SceneGraphNode => {
    const node = nodes[id]
    if (!node) {
      return {
        id,
        type: 'missing',
        name: null,
        parentId: null,
        missing: true,
        children: [],
      }
    }

    const nodeType = typeof node.type === 'string' ? node.type : 'unknown'
    const nodeName = typeof node.name === 'string' ? node.name : null
    const parentId = typeof node.parentId === 'string' ? node.parentId : null

    if (path.has(id)) {
      return {
        id,
        type: nodeType,
        name: nodeName,
        parentId,
        cycle: true,
        children: [],
      }
    }

    visited.add(id)
    const nextPath = new Set(path)
    nextPath.add(id)

    const childIds = Array.from(childIdsByParent.get(id) ?? [])
    return {
      id,
      type: nodeType,
      name: nodeName,
      parentId,
      children: childIds.map((childId) => buildNode(childId, nextPath)),
    }
  }

  const roots = rootNodeIds.map((id) => buildNode(id, new Set()))
  const detachedNodeIds = Object.keys(nodes).filter((id) => !visited.has(id))

  if (detachedNodeIds.length === 0) {
    return { roots }
  }

  return {
    roots,
    detachedNodes: detachedNodeIds.map((id) => buildNode(id, new Set())),
  }
}

export interface ProjectVisibility {
  isPrivate: boolean
  showScansPublic: boolean
  showGuidesPublic: boolean
}

export interface SettingsPanelProps {
  projectId?: string
  readOnly?: boolean
  onSugopSave?: (fileName?: string) => void
  onSugopFileNameReset?: () => void
  defaultSaveFileName?: string
  projectVisibility?: ProjectVisibility
  onVisibilityChange?: (
    field: 'isPrivate' | 'showScansPublic' | 'showGuidesPublic',
    value: boolean,
  ) => Promise<void>
}

export function SettingsPanel({
  projectId,
  readOnly = false,
  onSugopSave,
  onSugopFileNameReset,
  defaultSaveFileName,
  projectVisibility,
  onVisibilityChange,
}: SettingsPanelProps = {}) {
  const nodes = useScene((state) => state.nodes)
  const rootNodeIds = useScene((state) => state.rootNodeIds)
  const clearScene = useScene((state) => state.clearScene)
  const resetSelection = useViewer((state) => state.resetSelection)
  const exportScene = useViewer((state) => state.exportScene)
  const setPhase = useEditor((state) => state.setPhase)
  const setMode = useEditor((state) => state.setMode)
  const setTool = useEditor((state) => state.setTool)
  const setStructureLayer = useEditor((state) => state.setStructureLayer)
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false)
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [saveFileName, setSaveFileName] = useState('')
  const sceneGraphValue = useMemo(
    () => buildSceneGraphValue(nodes as Record<string, SceneNode>, rootNodeIds),
    [nodes, rootNodeIds],
  )
  const blockSceneGraphMutations = useCallback((event: SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])
  const blockSceneGraphDeletion = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      event.stopPropagation()
    }
  }, [])

  const isLocalProject = true // Internal fork: cloud/community settings are disabled

  const handleExport = async () => {
    if (exportScene) {
      await exportScene()
    }
  }

  const handleSaveBuild = () => {
    if (onSugopSave) {
      const currentFileName = defaultSaveFileName?.trim() ?? ''

      if (currentFileName) {
        onSugopSave(currentFileName)
        return
      }

      setSaveFileName('')
      setIsSaveDialogOpen(true)
      return
    }

    const sceneData = { nodes, rootNodeIds }
    const json = JSON.stringify(sceneData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const date = new Date().toISOString().split('T')[0]
    link.download = `layout_${date}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleConfirmSugopSave = () => {
    const fileName = saveFileName.trim()
    if (!fileName) return
    onSugopSave?.(fileName || undefined)
    setIsSaveDialogOpen(false)
  }

  const handleResetToDefault = () => {
    clearScene()
    resetSelection()
    setPhase('structure')
    setStructureLayer('elements')
    setMode('build')
    setTool('wall')
    setSaveFileName('')
    onSugopFileNameReset?.()
  }

  const handleGenerateThumbnail = () => {
    if (!projectId) return
    setIsGeneratingThumbnail(true)
    emitter.emit('camera-controls:generate-thumbnail', { projectId })
    setTimeout(() => setIsGeneratingThumbnail(false), 3000)
  }

  const handleVisibilityChange = async (
    field: 'isPrivate' | 'showScansPublic' | 'showGuidesPublic',
    value: boolean,
  ) => {
    await onVisibilityChange?.(field, value)
  }

  return (
    <div className="flex flex-col gap-6 p-3">
      {/* Visibility Section (only for cloud projects) */}
      {projectId && !isLocalProject && (
        <div className="space-y-3">
          <label className="font-medium text-muted-foreground text-xs uppercase">Visibility</label>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Public</div>
              <div className="text-muted-foreground text-xs">
                {projectVisibility?.isPrivate ? 'Only you' : 'Anyone'} can view
              </div>
            </div>
            <Switch
              checked={!(projectVisibility?.isPrivate ?? false)}
              onCheckedChange={(checked) => handleVisibilityChange('isPrivate', !checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Show 3D Scans</div>
              <div className="text-muted-foreground text-xs">Visible to public viewers</div>
            </div>
            <Switch
              checked={projectVisibility?.showScansPublic ?? true}
              onCheckedChange={(checked) => handleVisibilityChange('showScansPublic', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Show Floorplans</div>
              <div className="text-muted-foreground text-xs">Visible to public viewers</div>
            </div>
            <Switch
              checked={projectVisibility?.showGuidesPublic ?? true}
              onCheckedChange={(checked) => handleVisibilityChange('showGuidesPublic', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Show Grid</div>
              <div className="text-muted-foreground text-xs">Visible only in the editor</div>
            </div>
            <Switch
              checked={useViewer((state) => state.showGrid)}
              onCheckedChange={(checked) => useViewer.getState().setShowGrid(checked)}
            />
          </div>
        </div>
      )}

      {/* Export Section */}
      <div className="space-y-2">
        <label className="font-medium text-muted-foreground text-xs uppercase">Exportar</label>
        <Button className="w-full justify-start gap-2" onClick={handleExport} variant="outline">
          <Download className="size-4" />
          Exportar modelo 3D
        </Button>
      </div>

      {/* Thumbnail Section (only for cloud projects) */}
      {projectId && !isLocalProject && (
        <div className="space-y-2">
          <label className="font-medium text-muted-foreground text-xs uppercase">Thumbnail</label>
          <Button
            className="w-full justify-start gap-2"
            disabled={isGeneratingThumbnail}
            onClick={handleGenerateThumbnail}
            variant="outline"
          >
            <Camera className="size-4" />
            {isGeneratingThumbnail ? 'Generating...' : 'Generate Thumbnail'}
          </Button>
        </div>
      )}

      {/* Save Section */}
      <div className="space-y-2">
        <label className="font-medium text-muted-foreground text-xs uppercase">Guardar</label>

        <Button
          className="w-full justify-start gap-2"
          disabled={readOnly}
          onClick={handleSaveBuild}
          variant="outline"
        >
          <Save className="size-4" />
          Guardar
        </Button>

        {defaultSaveFileName?.trim() && (
          <p className="text-muted-foreground text-xs">
            Nombre actual: <span className="text-foreground">{defaultSaveFileName.trim()}</span>
          </p>
        )}

        <Dialog onOpenChange={setIsSaveDialogOpen} open={isSaveDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogTitle>Guardar</DialogTitle>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-medium text-sm" htmlFor="save-filename">
                  Nombre de archivo
                </label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  id="save-filename"
                  onChange={(e) => setSaveFileName(e.target.value)}
                  placeholder=""
                  value={saveFileName}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button onClick={() => setIsSaveDialogOpen(false)} type="button" variant="outline">
                  Cancelar
                </Button>
                <Button disabled={!saveFileName.trim()} onClick={handleConfirmSugopSave} type="button">
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Audio Section */}
      <div className="space-y-2">
        <label className="font-medium text-muted-foreground text-xs uppercase">Audio</label>
        <AudioSettingsDialog />
      </div>

      {/* Keyboard Section */}
      <div className="space-y-2">
        <label className="font-medium text-muted-foreground text-xs uppercase">Teclado</label>
        <KeyboardShortcutsDialog />
      </div>

      {/* Scene Graph */}
      <div className="space-y-1">
        <label className="font-medium text-muted-foreground text-xs uppercase">Árbol de escena</label>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-auto justify-start p-0 text-sm" variant="link">
              Explorar árbol de escena
            </Button>
          </DialogTrigger>
          <DialogContent className="h-[80vh] max-w-[95vw] gap-0 overflow-hidden border-0 bg-[#1e1e1e] p-0 shadow-none sm:max-w-5xl">
            <DialogTitle className="sr-only">Árbol de escena</DialogTitle>
            <div
              className="flex h-full min-h-0 w-full min-w-0 *:h-full *:w-full *:overflow-y-auto"
              onContextMenuCapture={blockSceneGraphMutations}
              onDragStartCapture={blockSceneGraphMutations}
              onDropCapture={blockSceneGraphMutations}
              onKeyDownCapture={blockSceneGraphDeletion}
            >
              <VisualJson value={sceneGraphValue}>
                <TreeView showCounts />
              </VisualJson>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Danger Zone */}
      <div className="space-y-2">
        <label className="font-medium text-destructive text-xs uppercase">Zona de riesgo</label>

        <Button
          className="w-full justify-start gap-2"
          disabled={readOnly}
          onClick={handleResetToDefault}
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Limpiar y empezar nuevo
        </Button>
      </div>
    </div>
  )
}
