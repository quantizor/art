/**
 * Grid System
 *
 * Manages grid-based movement and positioning.
 * Converts between continuous positions and grid cells.
 */

import { ARENA_HALF, BASE_SPEED, DIRECTION_VECTORS, CELL_SIZE } from '../constants'
import type { GridDirection, GridPosition } from '../types'

export class GridSystem {
  /**
   * Move a position forward by a given amount in a direction
   */
  moveForward(
    position: GridPosition,
    direction: GridDirection,
    distance: number
  ): GridPosition {
    const vector = DIRECTION_VECTORS[direction]
    return {
      x: position.x + vector.x * distance,
      z: position.z + vector.z * distance,
    }
  }

  /**
   * Move a position forward by a given amount using continuous angle
   * angle: 0 = north (-z), PI/2 = east (+x), PI = south (+z), -PI/2 = west (-x)
   */
  moveForwardAngle(
    position: GridPosition,
    angle: number,
    distance: number
  ): GridPosition {
    // In Three.js convention: 0 angle points -Z (north), positive rotation is clockwise from above
    return {
      x: position.x + Math.sin(angle) * distance,
      z: position.z - Math.cos(angle) * distance,
    }
  }

  /**
   * Calculate movement distance for a given delta time
   */
  calculateMovement(deltaTime: number, speedMultiplier: number = 1): number {
    return BASE_SPEED * speedMultiplier * (deltaTime / 1000)
  }

  /**
   * Check if a position is within the arena bounds
   */
  isInBounds(position: GridPosition, margin: number = 0.5): boolean {
    const maxCoord = ARENA_HALF - margin
    return (
      position.x >= -maxCoord &&
      position.x <= maxCoord &&
      position.z >= -maxCoord &&
      position.z <= maxCoord
    )
  }

  /**
   * Snap a position to the nearest grid cell center
   */
  snapToGrid(position: GridPosition): GridPosition {
    return {
      x: Math.round(position.x / CELL_SIZE) * CELL_SIZE,
      z: Math.round(position.z / CELL_SIZE) * CELL_SIZE,
    }
  }

  /**
   * Get the grid cell coordinates for a position
   */
  getGridCell(position: GridPosition): GridPosition {
    return {
      x: Math.floor(position.x / CELL_SIZE),
      z: Math.floor(position.z / CELL_SIZE),
    }
  }

  /**
   * Calculate distance between two positions
   */
  distance(a: GridPosition, b: GridPosition): number {
    const dx = b.x - a.x
    const dz = b.z - a.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  /**
   * Check if two positions are at the same grid cell
   */
  sameCell(a: GridPosition, b: GridPosition): boolean {
    const cellA = this.getGridCell(a)
    const cellB = this.getGridCell(b)
    return cellA.x === cellB.x && cellA.z === cellB.z
  }

  /**
   * Get the distance to the nearest wall in a given direction
   */
  distanceToWall(position: GridPosition, direction: GridDirection): number {
    switch (direction) {
      case 'north':
        return position.z + ARENA_HALF
      case 'south':
        return ARENA_HALF - position.z
      case 'east':
        return ARENA_HALF - position.x
      case 'west':
        return position.x + ARENA_HALF
    }
  }

  /**
   * Get positions in a line from start in a direction
   */
  getLinePositions(
    start: GridPosition,
    direction: GridDirection,
    length: number,
    step: number = CELL_SIZE
  ): GridPosition[] {
    const positions: GridPosition[] = []
    const vector = DIRECTION_VECTORS[direction]

    for (let d = step; d <= length; d += step) {
      positions.push({
        x: start.x + vector.x * d,
        z: start.z + vector.z * d,
      })
    }

    return positions
  }

  /**
   * Clamp position to arena bounds
   */
  clampToBounds(position: GridPosition, margin: number = 0.5): GridPosition {
    const maxCoord = ARENA_HALF - margin
    return {
      x: Math.max(-maxCoord, Math.min(maxCoord, position.x)),
      z: Math.max(-maxCoord, Math.min(maxCoord, position.z)),
    }
  }
}
