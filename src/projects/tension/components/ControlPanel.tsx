/**
 * Control Panel
 *
 * Collapsible HUD overlay for adjusting simulation parameters.
 * Slides into the top of the screen when collapsed.
 */

import { useState, useRef } from 'react'
import { Badge } from '~/ui/Badge'
import { Button } from '~/ui/Button'
import { Slider } from '~/ui/Slider'
import { Select } from '~/ui/Select'
import { MAX_SEED_COUNT } from '../constants'
import { getAvailableTypes } from '../profiles'
import { decodeSeed, randomSeedString } from '../engine/SeededRandom'
import type { CrystalType, SimulationParams, ColorParams, SimulationPhase, GrowthPattern } from '../types'

interface ControlPanelProps {
  crystalType: CrystalType
  onCrystalTypeChange: (type: CrystalType) => void
  phase: SimulationPhase
  particleCount: number
  simParams: SimulationParams
  colorParams: ColorParams
  onSimParamsChange: (params: SimulationParams) => void
  onColorParamsChange: (params: ColorParams) => void
  onReset: () => void
  onSave: () => void
  onRandomize: () => void
  seedString: string
  onSeedChange: (seed: string) => void
}

export function ControlPanel({
  crystalType,
  onCrystalTypeChange,
  phase,
  particleCount,
  simParams,
  colorParams,
  onSimParamsChange,
  onColorParamsChange,
  onReset,
  onSave,
  onRandomize,
  seedString,
  onSeedChange,
}: ControlPanelProps) {
  const [collapsed, setCollapsed] = useState(true)
  const [localSeed, setLocalSeed] = useState(seedString)
  const [copied, setCopied] = useState(false)
  const seedInputRef = useRef<HTMLInputElement>(null)

  // Sync local seed when parent changes it (e.g. on randomize)
  if (localSeed !== seedString && document.activeElement !== seedInputRef.current) {
    setLocalSeed(seedString)
  }

  const phaseBadgeVariant =
    phase === 'growing' ? 'primary' : phase === 'paused' ? 'warning' : phase === 'complete' ? 'info' : 'default'

  return (
    <div className="absolute top-6 right-4 pointer-events-auto z-20 flex items-start gap-1.5">
      {/* Randomize button — 3D die */}
      <button
        onClick={onRandomize}
        className="bg-black/80 border border-[var(--color-border-default)] p-2 px-2.5 text-white/70 hover:text-white cursor-pointer select-none"
        title="Randomize"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* 3D die at an angle — isometric cube with dots */}
          <path d="M12 2L2 7v10l10 5 10-5V7L12 2z" />
          <path d="M12 22V12" />
          <path d="M22 7L12 12" />
          <path d="M2 7l10 5" />
          {/* Dots on visible faces */}
          <circle cx="7" cy="13" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="17" cy="13" r="0.8" fill="currentColor" stroke="none" />
          <circle cx="12" cy="7" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {/* Save button */}
      <button
        onClick={onSave}
        className="bg-black/80 border border-[var(--color-border-default)] p-2 px-2.5 text-white/70 hover:text-white cursor-pointer select-none"
        title="Save image"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      {/* Drawer */}
      <div className="w-56">
        {/* Header bar — always visible */}
        <div
          className="bg-black/80 border border-[var(--color-border-default)] p-2 px-3 flex items-center justify-between cursor-pointer select-none"
          onClick={() => setCollapsed((c) => !c)}
        >
          <div className="flex items-center gap-2">
            <Badge variant={phaseBadgeVariant} size="sm">
              {phase}
            </Badge>
            <span className="text-xs text-white/50 font-mono">
              {particleCount.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={seedInputRef}
              type="text"
              value={localSeed}
              maxLength={8}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const v = e.target.value.toLowerCase().replace(/[^0-9a-z]/g, '').slice(0, 8)
                setLocalSeed(v)
              }}
              onBlur={() => {
                // Validate and apply seed
                const decoded = decodeSeed(localSeed)
                if (localSeed.length === 0 || decoded === 0) {
                  // Invalid — generate a new random seed
                  const fallback = randomSeedString()
                  setLocalSeed(fallback)
                  onSeedChange(fallback)
                } else {
                  onSeedChange(localSeed)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
              }}
              className="w-[4.2rem] bg-transparent border border-white/20 px-1.5 py-0.5 text-[10px] font-mono text-white/70 focus:text-white focus:border-white/50 outline-none tracking-wider"
              title="Seed — paste a seed to reproduce a design"
            />
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigator.clipboard.writeText(seedString)
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              }}
              className="text-[10px] text-white/40 hover:text-white/70 font-mono cursor-pointer"
              title="Copy seed"
            >
              {copied ? 'ok' : 'cp'}
            </button>
          </div>
          <span
            className="text-[10px] text-white hover:text-white/70 uppercase tracking-widest font-mono"
          >
            {collapsed ? 'show' : 'hide'}
          </span>
        </div>

        {/* Expandable controls — animated with max-height + opacity */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            collapsed ? 'max-h-0 opacity-0' : 'max-h-[28rem] opacity-100'
          }`}
        >
          <div className="bg-black/80 border border-[var(--color-border-default)] border-t-0 p-3 pt-3 flex flex-col gap-3">
            <Slider
              label="Seeds"
              min={1}
              max={MAX_SEED_COUNT}
              step={1}
              value={simParams.seedCount}
              onChange={(e) =>
                onSimParamsChange({ ...simParams, seedCount: Number(e.target.value) })
              }
            />
            <Slider
              label="Speed"
              min={50}
              max={50000}
              step={50}
              value={simParams.stepsPerFrame}
              onChange={(e) =>
                onSimParamsChange({ ...simParams, stepsPerFrame: Number(e.target.value) })
              }
            />
            <Select
              label="Crystal"
              size="sm"
              value={crystalType}
              onChange={(e) => onCrystalTypeChange(e.target.value as CrystalType)}
            >
              {getAvailableTypes().map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
            <Select
              label="Pattern"
              size="sm"
              value={colorParams.growthPattern}
              onChange={(e) =>
                onColorParamsChange({ ...colorParams, growthPattern: e.target.value as GrowthPattern })
              }
            >
              <option value="linear">Linear</option>
              <option value="radial">Radial</option>
            </Select>

            <Button variant="danger" size="sm" onClick={onReset} className="w-full">
              Reset
            </Button>

            <div className="text-[10px] text-white/40 leading-tight">
              <span className="text-white/60">Click</span> to add seed
              {' · '}
              <span className="text-white/60">Space</span> to pause
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
