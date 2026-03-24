'use client'

import { useViewer } from '@pascal-app/viewer'
import { Box, Camera, Diamond, Image, Layers, Layers2 } from 'lucide-react'
import { cn, withBasePath } from '../../../lib/utils'
import { ActionButton } from './action-button'

const levelModeLabels: Record<'stacked' | 'exploded' | 'solo', string> = {
  stacked: 'Apilado',
  exploded: 'Explotado',
  solo: 'Solo',
}

const levelModeOrder: ('stacked' | 'exploded' | 'solo')[] = ['stacked', 'exploded', 'solo']

type WallMode = 'up' | 'cutaway' | 'down'

const wallModeConfig: Record<
  WallMode,
  { icon: React.FC<React.ComponentProps<'img'>>; label: string }
> = {
  up: {
    icon: (props) => (
      <img alt="Altura completa" height={20} src={withBasePath('/icons/room.png')} width={20} {...props} />
    ),
    label: 'Altura completa',
  },
  cutaway: {
    icon: (props) => (
      <img alt="Corte" height={20} src={withBasePath('/icons/wallcut.png')} width={20} {...props} />
    ),
    label: 'Corte',
  },
  down: {
    icon: (props) => <img alt="Bajo" height={20} src={withBasePath('/icons/walllow.png')} width={20} {...props} />,
    label: 'Bajo',
  },
}

const wallModeOrder: WallMode[] = ['cutaway', 'up', 'down']

export function ViewToggles() {
  const cameraMode = useViewer((state) => state.cameraMode)
  const setCameraMode = useViewer((state) => state.setCameraMode)
  const levelMode = useViewer((state) => state.levelMode)
  const setLevelMode = useViewer((state) => state.setLevelMode)
  const wallMode = useViewer((state) => state.wallMode)
  const setWallMode = useViewer((state) => state.setWallMode)
  const showScans = useViewer((state) => state.showScans)
  const setShowScans = useViewer((state) => state.setShowScans)
  const showGuides = useViewer((state) => state.showGuides)
  const setShowGuides = useViewer((state) => state.setShowGuides)

  const toggleCameraMode = () => {
    setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')
  }

  const cycleLevelMode = () => {
    if (levelMode === 'manual') {
      setLevelMode('stacked')
      return
    }
    const currentIndex = levelModeOrder.indexOf(levelMode as 'stacked' | 'exploded' | 'solo')
    const nextIndex = (currentIndex + 1) % levelModeOrder.length
    const nextMode = levelModeOrder[nextIndex]
    if (nextMode) setLevelMode(nextMode)
  }

  const cycleWallMode = () => {
    const currentIndex = wallModeOrder.indexOf(wallMode)
    const nextIndex = (currentIndex + 1) % wallModeOrder.length
    const nextMode = wallModeOrder[nextIndex]
    if (nextMode) setWallMode(nextMode)
  }

  return (
    <div className="flex items-center gap-1">
      {/* Camera Mode */}
      <ActionButton
        className={cn(
          cameraMode === 'orthographic'
            ? 'bg-violet-500/20 text-violet-400'
            : 'hover:text-violet-400',
        )}
        label={`Cámara: ${cameraMode === 'perspective' ? 'Perspectiva' : 'Ortográfica'}`}
        onClick={toggleCameraMode}
        size="icon"
        variant="ghost"
      >
        <Camera className="h-6 w-6" />
      </ActionButton>

      {/* Level Mode */}
      <ActionButton
        className={cn(
          levelMode !== 'stacked' ? 'bg-amber-500/20 text-amber-400' : 'hover:text-amber-400',
        )}
        label={`Niveles: ${levelMode === 'manual' ? 'Manual' : levelModeLabels[levelMode as keyof typeof levelModeLabels]}`}
        onClick={cycleLevelMode}
        size="icon"
        variant="ghost"
      >
        {levelMode === 'solo' && <Diamond className="h-6 w-6" />}
        {levelMode === 'exploded' && <Layers2 className="h-6 w-6" />}
        {(levelMode === 'stacked' || levelMode === 'manual') && <Layers className="h-6 w-6" />}
      </ActionButton>

      {/* Wall Mode */}
      <ActionButton
        className={cn(
          'p-0',
          wallMode !== 'cutaway'
            ? 'bg-white/10'
            : 'opacity-60 grayscale hover:bg-white/5 hover:opacity-100 hover:grayscale-0',
        )}
        label={`Muros: ${wallModeConfig[wallMode].label}`}
        onClick={cycleWallMode}
        size="icon"
        variant="ghost"
      >
        {(() => {
          const Icon = wallModeConfig[wallMode].icon
          return <Icon className="h-[28px] w-[28px]" />
        })()}
      </ActionButton>

      {/* Show Scans */}
      <ActionButton
        className={cn(
          'p-0',
          showScans
            ? 'bg-white/10'
            : 'opacity-60 grayscale hover:bg-white/5 hover:opacity-100 hover:grayscale-0',
        )}
        label={`Escaneos: ${showScans ? 'Visible' : 'Oculto'}`}
        onClick={() => setShowScans(!showScans)}
        size="icon"
        variant="ghost"
      >
        <img alt="Escaneos" className="h-[28px] w-[28px] object-contain" src={withBasePath('/icons/mesh.png')} />
      </ActionButton>

      {/* Show Guides */}
      <ActionButton
        className={cn(
          'p-0',
          showGuides
            ? 'bg-white/10'
            : 'opacity-60 grayscale hover:bg-white/5 hover:opacity-100 hover:grayscale-0',
        )}
        label={`Guías: ${showGuides ? 'Visible' : 'Oculto'}`}
        onClick={() => setShowGuides(!showGuides)}
        size="icon"
        variant="ghost"
      >
        <img alt="Guías" className="h-[28px] w-[28px] object-contain" src={withBasePath('/icons/floorplan.png')} />
      </ActionButton>
    </div>
  )
}
