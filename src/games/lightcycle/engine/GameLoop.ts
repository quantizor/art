/**
 * Game Loop
 *
 * Fixed timestep game loop that coordinates physics, AI, and rendering.
 * Runs at 60 Hz for physics, renders as fast as possible.
 */

import type { Dispatch } from 'react'
import type { GameAction } from '../state/GameContext'
import { GameActions } from '../state/GameContext'
import type { CycleState, GameState, TrailSegment } from '../types'
import {
  JUMP_COOLDOWN,
  JUMP_DURATION,
  MAX_DELTA,
  PHYSICS_TIMESTEP,
  TRAIL_BASE_Y,
  TRAIL_LIFETIME,
  TRAIL_FADE_DURATION,
  TURN_SPEED,
  TURN_THRESHOLD,
  normalizeAngle,
} from '../constants'
import { SceneManager } from '../scene/SceneManager'
import { CameraController } from '../scene/CameraController'
import { ArenaRenderer } from '../scene/ArenaRenderer'
import { LightcycleModel } from '../scene/LightcycleModel'
import { TrailRenderer } from '../scene/TrailRenderer'
import { GridSystem } from './GridSystem'
import { CollisionSystem } from './CollisionSystem'
import { AIController } from './AIController'
import { InputManager } from './InputManager'

interface CycleObjects {
  model: LightcycleModel
  trail: TrailRenderer
  /** Continuous position for smooth rendering */
  renderPosition: { x: number; z: number }
  /** Last turn position for trail segments */
  lastTurnPosition: { x: number; z: number }
  /** Y position at last turn (for trail segment Y data) */
  lastTurnY: number
  /** Whether this cycle's trail has started */
  trailStarted: boolean
  /** The angle at which the current segment was started (for consistent trail direction) */
  segmentAngle: number
}

export class GameLoop {
  private sceneManager: SceneManager
  private cameraController: CameraController
  private arenaRenderer: ArenaRenderer
  private gridSystem: GridSystem
  private collisionSystem: CollisionSystem
  private aiController: AIController
  private inputManager: InputManager

  private cycleObjects: Map<string, CycleObjects> = new Map()
  private dispatch: Dispatch<GameAction>
  private getState: () => GameState

  private animationFrameId: number | null = null
  private lastTime: number = 0
  private accumulator: number = 0
  private physicsTime: number = 0

  private countdownTimer: number = 0
  private autoRestartScheduled: boolean = false
  private trailPruneTimer: number = 0

  private canvas: HTMLCanvasElement

  constructor(
    canvas: HTMLCanvasElement,
    dispatch: Dispatch<GameAction>,
    getState: () => GameState
  ) {
    this.dispatch = dispatch
    this.getState = getState
    this.canvas = canvas

    // Initialize systems
    this.sceneManager = new SceneManager(canvas)
    this.cameraController = new CameraController(this.sceneManager.camera)
    this.arenaRenderer = new ArenaRenderer()
    this.gridSystem = new GridSystem()
    this.collisionSystem = new CollisionSystem()
    this.aiController = new AIController(this.collisionSystem)
    this.inputManager = new InputManager()

    // Add arena to scene
    this.sceneManager.scene.add(this.arenaRenderer.group)

    // Setup input handling
    this.inputManager.subscribe(this.handleInput)
    this.inputManager.enable()

    // Initialize mouse look for camera panning
    this.cameraController.initMouseLook(canvas)

    // Prevent context menu on right-click (used for mouse look)
    canvas.addEventListener('contextmenu', this.handleContextMenu)

    // Handle resize
    window.addEventListener('resize', this.handleResize)
  }

  private handleContextMenu = (e: Event): void => {
    e.preventDefault()
  }

  /**
   * Initialize cycle objects based on current state
   */
  initializeCycles(cycles: CycleState[]): void {
    // Clear existing
    for (const obj of this.cycleObjects.values()) {
      this.sceneManager.scene.remove(obj.model.group)
      this.sceneManager.scene.remove(obj.trail.group)
      obj.model.dispose()
      obj.trail.dispose()
    }
    this.cycleObjects.clear()

    // Create new cycle objects
    for (const cycle of cycles) {
      const model = new LightcycleModel(cycle.color)
      const trail = new TrailRenderer(cycle.color)

      model.setTransform(cycle.gridPosition, cycle.angle)

      // Attempt to load GLB model (falls back to geometric if it fails)
      model.loadModel('/models/lightcycle.glb').catch(() => {
        // Fallback already in place
      })

      this.sceneManager.scene.add(model.group)
      this.sceneManager.scene.add(trail.group)

      // Start trail immediately from spawn position (behind the cycle)
      const initialAttachPoint = this.getTrailAttachPoint(cycle.gridPosition, cycle.angle, 0)
      trail.startNewSegment(initialAttachPoint)
      trail.group.visible = true

      this.cycleObjects.set(cycle.id, {
        model,
        trail,
        renderPosition: { ...cycle.gridPosition },
        lastTurnPosition: { x: initialAttachPoint.x, z: initialAttachPoint.z },
        lastTurnY: TRAIL_BASE_Y,
        trailStarted: true,
        segmentAngle: cycle.angle,
      })
    }

    // Snap camera to player
    const player = cycles.find((c) => c.isPlayer)
    if (player) {
      const state = this.getState()
      this.cameraController.snapTo(state.cameraMode, player.gridPosition, player.direction)
    }
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.animationFrameId !== null) return

    this.lastTime = performance.now()
    this.accumulator = 0
    this.physicsTime = 0
    this.countdownTimer = 0

    this.animationFrameId = requestAnimationFrame(this.loop)
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * Main game loop
   */
  private loop = (currentTime: number): void => {
    const state = this.getState()

    // Calculate delta time
    let deltaTime = currentTime - this.lastTime
    this.lastTime = currentTime

    // Clamp delta to prevent spiral of death
    if (deltaTime > MAX_DELTA) {
      deltaTime = MAX_DELTA
    }

    // Handle different game phases
    switch (state.phase) {
      case 'countdown':
        this.updateCountdown(deltaTime)
        break

      case 'playing':
        // Fixed timestep physics
        this.accumulator += deltaTime

        while (this.accumulator >= PHYSICS_TIMESTEP) {
          this.physicsUpdate(PHYSICS_TIMESTEP, state, currentTime)
          this.physicsTime += PHYSICS_TIMESTEP
          this.accumulator -= PHYSICS_TIMESTEP
        }

        // Interpolation factor for smooth rendering
        const alpha = this.accumulator / PHYSICS_TIMESTEP
        this.interpolateRender(state, alpha, currentTime)
        break

      case 'paused':
      case 'menu':
        // Just render current state
        this.interpolateRender(state, 0, currentTime)
        break

      case 'gameOver':
        // Render current state
        this.interpolateRender(state, 0, currentTime)

        // In NPC mode, auto-restart after a brief delay
        if (state.isNPCMode && !this.autoRestartScheduled) {
          this.autoRestartScheduled = true
          setTimeout(() => {
            this.autoRestartScheduled = false
            this.dispatch(GameActions.restartGame())
            setTimeout(() => {
              const newState = this.getState()
              this.initializeCycles(newState.cycles)
            }, 0)
          }, 2000) // 2 second delay before restart
        }
        break
    }

    // Update camera
    const player = state.cycles.find((c) => c.isPlayer)
    const aliveCycles = state.cycles.filter((c) => c.isAlive)

    if (player) {
      const cycleObj = this.cycleObjects.get(player.id)
      if (cycleObj) {
        if (player.isAlive) {
          // Follow player
          this.cameraController.update(
            state.cameraMode,
            cycleObj.renderPosition,
            player.angle,
            deltaTime
          )
        } else if (aliveCycles.length > 0) {
          // Player dead - follow a random alive AI in top-down
          const spectateTarget = aliveCycles[0]
          const spectateObj = this.cycleObjects.get(spectateTarget.id)
          if (spectateObj) {
            this.cameraController.update(
              'topDown',
              spectateObj.renderPosition,
              spectateTarget.angle,
              deltaTime
            )
          }
        }
      }
    }

    // Render
    this.sceneManager.render()

    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.loop)
  }

  /**
   * Handle countdown phase
   */
  private updateCountdown(deltaTime: number): void {
    this.countdownTimer += deltaTime

    if (this.countdownTimer >= 1000) {
      this.countdownTimer = 0
      this.dispatch(GameActions.decrementCountdown())
    }
  }

  /**
   * Fixed timestep physics update
   */
  private physicsUpdate(dt: number, state: GameState, currentTime: number): void {
    // Build augmented cycles with live trail segments for collision detection
    const cyclesWithLiveTrails = this.getCyclesWithLiveTrails(state.cycles)
    const aliveCycles = state.cycles.filter((c) => c.isAlive)

    for (const cycle of aliveCycles) {
      // Check if jump has ended
      if (cycle.isJumping) {
        const elapsed = currentTime - cycle.jumpStartTime
        if (elapsed >= JUMP_DURATION) {
          this.dispatch(GameActions.endJump(cycle.id))
        }
      }

      // Handle curved turning
      if (cycle.isTurning && cycle.targetAngle !== -1) {
        const turnAmount = TURN_SPEED * (dt / 1000)
        const angleDiff = normalizeAngle(cycle.targetAngle - cycle.angle)

        if (Math.abs(angleDiff) <= TURN_THRESHOLD) {
          // Turn complete
          this.dispatch(GameActions.endTurn(cycle.id))
        } else {
          // Smoothly interpolate toward target
          const turnDir = angleDiff > 0 ? 1 : -1
          const newAngle = normalizeAngle(cycle.angle + turnDir * Math.min(turnAmount, Math.abs(angleDiff)))
          this.dispatch(GameActions.updateAngle(cycle.id, newAngle))
        }
      }

      // AI decision (also controls player in NPC mode)
      // Use augmented cycles so AI sees live trail segments too
      if (!cycle.isPlayer || state.isNPCMode) {
        const decision = this.aiController.getDecision(
          cycle,
          cyclesWithLiveTrails,
          this.physicsTime
        )

        if (decision.turn !== 'none' && !cycle.isTurning) {
          this.handleTurn(cycle.id, decision.turn, state)
        }

        // AI jumping
        if (decision.jump && !cycle.isJumping) {
          this.handleJump(cycle.id, currentTime)
        }
      }

      // Move cycle forward using current angle
      const movement = this.gridSystem.calculateMovement(dt, cycle.speed)
      const newPosition = this.gridSystem.moveForwardAngle(
        cycle.gridPosition,
        cycle.angle,
        movement
      )

      // Calculate jump Y offset
      let yOffset = 0
      if (cycle.isJumping) {
        yOffset = LightcycleModel.calculateJumpY(cycle.jumpStartTime, currentTime)
      }

      // Always check collision using augmented trails (includes live segments)
      const collision = this.collisionSystem.checkCollision(
        newPosition,
        cycle.id,
        cyclesWithLiveTrails,
        yOffset
      )

      if (collision.collided) {
        // Cycle dies
        this.dispatch(GameActions.killCycle(cycle.id))

        // Death explosion effect
        const cycleObj = this.cycleObjects.get(cycle.id)
        if (cycleObj) {
          cycleObj.model.explode(this.sceneManager.scene, () => {
            // Explosion complete
          })

          // If player died, switch to top-down spectator view
          if (cycle.isPlayer) {
            this.dispatch(GameActions.setCamera('topDown'))
          }
        }
        continue
      }

      // Update position
      this.dispatch(GameActions.updateCyclePosition(cycle.id, newPosition.x, newPosition.z))

      // Update trail continuously
      const cycleObj = this.cycleObjects.get(cycle.id)
      if (cycleObj) {
        cycleObj.renderPosition = { ...newPosition }

        // Extend trail from back of cycle (Y-aware, follows jumps)
        // Use the interpolating angle so the trail stays attached to the
        // model's actual back during smooth turns (creates a rounded corner)
        if (cycleObj.trailStarted) {
          const attachPoint = this.getTrailAttachPoint(newPosition, cycle.angle, yOffset)
          cycleObj.trail.extendLastSegment(attachPoint)
        }
      }
    }

    // Periodically prune expired trail segments from state
    this.trailPruneTimer += dt
    if (this.trailPruneTimer > 2000) {
      this.trailPruneTimer = 0
      this.dispatch(GameActions.pruneExpiredTrails(TRAIL_LIFETIME + TRAIL_FADE_DURATION))
    }
  }

  /**
   * Build augmented cycle states that include the "live" segment
   * (from last turn corner to current position) which isn't in state.trail.
   * This is critical for collision: without it, racers can drive through
   * the active segment of another racer's trail.
   */
  private getCyclesWithLiveTrails(stateCycles: CycleState[]): CycleState[] {
    return stateCycles.map((cycle) => {
      if (!cycle.isAlive) return cycle

      const cycleObj = this.cycleObjects.get(cycle.id)
      if (!cycleObj || !cycleObj.trailStarted) return cycle

      // Build the live segment: from lastTurnPosition to current trail attach point
      const currentAttach = this.getTrailAttachPoint(cycle.gridPosition, cycle.angle)

      const liveSegment: TrailSegment = {
        start: { ...cycleObj.lastTurnPosition },
        end: { x: currentAttach.x, z: currentAttach.z },
        direction: cycle.direction,
        startY: cycleObj.lastTurnY,
        endY: currentAttach.y,
        timestamp: performance.now(),
      }

      return {
        ...cycle,
        trail: [...cycle.trail, liveSegment],
      }
    })
  }

  /**
   * Get trail attachment point (back of cycle, Y-aware)
   */
  private getTrailAttachPoint(
    position: { x: number; z: number },
    angle: number,
    yOffset: number = 0
  ): { x: number; y: number; z: number } {
    // Offset behind the cycle (negative forward direction)
    const offset = 1.0 // Distance behind center
    return {
      x: position.x - Math.sin(angle) * offset,
      y: TRAIL_BASE_Y + yOffset,
      z: position.z + Math.cos(angle) * offset,
    }
  }

  /**
   * Handle cycle turn (initiates smooth curved turn)
   * Adds a corner point and records the trail segment with Y data
   */
  private handleTurn(cycleId: string, direction: 'left' | 'right', state: GameState): void {
    const cycle = state.cycles.find((c) => c.id === cycleId)
    if (!cycle || !cycle.isAlive || cycle.isTurning) return

    const cycleObj = this.cycleObjects.get(cycleId)
    if (!cycleObj) return

    // Compute current Y offset for trail attachment
    let yOffset = 0
    if (cycle.isJumping) {
      yOffset = LightcycleModel.calculateJumpY(cycle.jumpStartTime, performance.now())
    }

    // Get current trail position and add it as a corner point
    const cornerPoint = this.getTrailAttachPoint(cycle.gridPosition, cycle.angle, yOffset)

    // Add corner point to trail (forces a control point at this position)
    cycleObj.trail.extendLastSegment(cornerPoint)

    // Record for state tracking (with Y data and timestamp)
    const segment: TrailSegment = {
      start: { ...cycleObj.lastTurnPosition },
      end: { x: cornerPoint.x, z: cornerPoint.z },
      direction: cycle.direction,
      startY: cycleObj.lastTurnY,
      endY: cornerPoint.y,
      timestamp: performance.now(),
    }
    this.dispatch(GameActions.addTrailSegment(cycleId, segment))
    cycleObj.lastTurnPosition = { x: cornerPoint.x, z: cornerPoint.z }
    cycleObj.lastTurnY = cornerPoint.y

    // Calculate the NEW segment's angle
    const turnAmount = direction === 'left' ? -Math.PI / 2 : Math.PI / 2
    cycleObj.segmentAngle = normalizeAngle(cycle.angle + turnAmount)

    // Initiate smooth turn
    this.dispatch(GameActions.startTurn(cycleId, direction))
  }

  /**
   * Handle jump
   */
  private handleJump(cycleId: string, currentTime: number): void {
    const state = this.getState()
    const cycle = state.cycles.find((c) => c.id === cycleId)
    if (!cycle || !cycle.isAlive || cycle.isJumping) return

    // Check cooldown
    if (currentTime - cycle.lastJumpTime < JUMP_COOLDOWN) return

    this.dispatch(GameActions.startJump(cycleId, currentTime))
  }

  /**
   * Interpolate render positions for smooth visuals
   */
  private interpolateRender(state: GameState, alpha: number, currentTime: number): void {
    for (const cycle of state.cycles) {
      const cycleObj = this.cycleObjects.get(cycle.id)
      if (!cycleObj) continue

      // Calculate jump Y offset
      let yOffset = 0
      if (cycle.isJumping) {
        yOffset = LightcycleModel.calculateJumpY(cycle.jumpStartTime, currentTime)
      }

      // Update model transform with continuous angle
      cycleObj.model.setTransform(cycleObj.renderPosition, cycle.angle, yOffset)
      cycleObj.model.setVisible(cycle.isAlive)
      cycleObj.model.setFallbackMode(state.useFallbackModel)
    }
  }

  /**
   * Handle input actions
   */
  private handleInput = (action: string): void => {
    const state = this.getState()
    const currentTime = performance.now()

    // Take control from NPC mode on first player input
    if (state.isNPCMode && (action === 'turnLeft' || action === 'turnRight' || action === 'jump' || action === 'confirm')) {
      this.dispatch(GameActions.takeControl())
    }

    switch (action) {
      case 'turnLeft':
        if (state.phase === 'playing') {
          this.handleTurn('player', 'left', state)
        }
        break

      case 'turnRight':
        if (state.phase === 'playing') {
          this.handleTurn('player', 'right', state)
        }
        break

      case 'jump':
        if (state.phase === 'playing') {
          this.handleJump('player', currentTime)
        }
        break

      case 'toggleCamera':
        this.dispatch(GameActions.toggleCamera())
        break

      case 'toggleModel':
        this.dispatch(GameActions.toggleModel())
        break

      case 'pause':
        if (state.phase === 'playing') {
          this.dispatch(GameActions.pauseGame())
        } else if (state.phase === 'paused') {
          this.dispatch(GameActions.resumeGame())
        }
        break

      case 'confirm':
        if (state.phase === 'playing') {
          // Space/Enter also triggers jump during gameplay
          this.handleJump('player', currentTime)
        } else if (state.phase === 'menu') {
          this.dispatch(GameActions.startGame())
        } else if (state.phase === 'gameOver') {
          this.dispatch(GameActions.restartGame())
          // Re-initialize cycles after restart
          setTimeout(() => {
            const newState = this.getState()
            this.initializeCycles(newState.cycles)
          }, 0)
        } else if (state.phase === 'paused') {
          this.dispatch(GameActions.resumeGame())
        }
        break
    }
  }

  /**
   * Handle window resize
   */
  private handleResize = (): void => {
    this.sceneManager.resize()
  }

  /**
   * Reset game state
   */
  reset(): void {
    // Clear trails
    for (const obj of this.cycleObjects.values()) {
      obj.trail.clear()
      obj.trailStarted = false
    }

    // Reset AI
    this.aiController.reset()

    // Reset timers
    this.accumulator = 0
    this.physicsTime = 0
    this.countdownTimer = 0

    // Re-initialize cycles
    const state = this.getState()
    this.initializeCycles(state.cycles)
  }

  /**
   * Cleanup all resources
   */
  dispose(): void {
    this.stop()
    this.inputManager.dispose()
    this.cameraController.dispose()
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu)
    window.removeEventListener('resize', this.handleResize)

    // Dispose cycle objects
    for (const obj of this.cycleObjects.values()) {
      obj.model.dispose()
      obj.trail.dispose()
    }
    this.cycleObjects.clear()

    // Dispose scene
    this.arenaRenderer.dispose()
    this.sceneManager.dispose()
  }
}
