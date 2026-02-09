/**
 * Arena Renderer
 *
 * Creates the TRON-style arena with grid floor and boundary walls.
 */

import * as THREE from 'three'
import { ARENA_COLORS, ARENA_SIZE, ARENA_HALF, WALL_HEIGHT, CELL_SIZE } from '../constants'

export class ArenaRenderer {
  group: THREE.Group

  private floor: THREE.Mesh
  private walls: THREE.Group
  private gridLines: THREE.LineSegments

  constructor() {
    this.group = new THREE.Group()

    // Create floor
    this.floor = this.createFloor()
    this.group.add(this.floor)

    // Create grid lines
    this.gridLines = this.createGridLines()
    this.group.add(this.gridLines)

    // Create boundary walls
    this.walls = this.createWalls()
    this.group.add(this.walls)
  }

  private createFloor(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE)
    const material = new THREE.MeshStandardMaterial({
      color: ARENA_COLORS.floor,
      roughness: 0.9,
      metalness: 0.1,
    })

    const floor = new THREE.Mesh(geometry, material)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true

    return floor
  }

  private createGridLines(): THREE.LineSegments {
    const points: THREE.Vector3[] = []

    // Main grid lines (every cell)
    for (let i = -ARENA_HALF; i <= ARENA_HALF; i += CELL_SIZE * 4) {
      // X-axis lines
      points.push(new THREE.Vector3(-ARENA_HALF, 0.01, i))
      points.push(new THREE.Vector3(ARENA_HALF, 0.01, i))
      // Z-axis lines
      points.push(new THREE.Vector3(i, 0.01, -ARENA_HALF))
      points.push(new THREE.Vector3(i, 0.01, ARENA_HALF))
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: ARENA_COLORS.gridLine,
      transparent: true,
      opacity: 0.6,
    })

    const lines = new THREE.LineSegments(geometry, material)

    // Add accent lines (major divisions)
    const accentPoints: THREE.Vector3[] = []
    const majorStep = CELL_SIZE * 16

    for (let i = -ARENA_HALF; i <= ARENA_HALF; i += majorStep) {
      accentPoints.push(new THREE.Vector3(-ARENA_HALF, 0.02, i))
      accentPoints.push(new THREE.Vector3(ARENA_HALF, 0.02, i))
      accentPoints.push(new THREE.Vector3(i, 0.02, -ARENA_HALF))
      accentPoints.push(new THREE.Vector3(i, 0.02, ARENA_HALF))
    }

    const accentGeometry = new THREE.BufferGeometry().setFromPoints(accentPoints)
    const accentMaterial = new THREE.LineBasicMaterial({
      color: ARENA_COLORS.gridLineAccent,
      transparent: true,
      opacity: 0.8,
    })

    const accentLines = new THREE.LineSegments(accentGeometry, accentMaterial)
    lines.add(accentLines)

    return lines
  }

  private createWalls(): THREE.Group {
    const walls = new THREE.Group()

    // Wall geometry - thin boxes along each edge
    const wallThickness = 0.5
    const wallGeometryNS = new THREE.BoxGeometry(ARENA_SIZE + wallThickness * 2, WALL_HEIGHT, wallThickness)
    const wallGeometryEW = new THREE.BoxGeometry(wallThickness, WALL_HEIGHT, ARENA_SIZE)

    // Wall material with emissive glow at edges
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: ARENA_COLORS.wall,
      emissive: ARENA_COLORS.wallGlow,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.8,
    })

    // North wall
    const northWall = new THREE.Mesh(wallGeometryNS, wallMaterial)
    northWall.position.set(0, WALL_HEIGHT / 2, -ARENA_HALF - wallThickness / 2)
    walls.add(northWall)

    // South wall
    const southWall = new THREE.Mesh(wallGeometryNS, wallMaterial)
    southWall.position.set(0, WALL_HEIGHT / 2, ARENA_HALF + wallThickness / 2)
    walls.add(southWall)

    // East wall
    const eastWall = new THREE.Mesh(wallGeometryEW, wallMaterial)
    eastWall.position.set(ARENA_HALF + wallThickness / 2, WALL_HEIGHT / 2, 0)
    walls.add(eastWall)

    // West wall
    const westWall = new THREE.Mesh(wallGeometryEW, wallMaterial)
    westWall.position.set(-ARENA_HALF - wallThickness / 2, WALL_HEIGHT / 2, 0)
    walls.add(westWall)

    // Add glowing edge strips on top of walls
    this.addWallEdgeGlow(walls)

    return walls
  }

  private addWallEdgeGlow(walls: THREE.Group): void {
    const edgeThickness = 0.1
    const edgeHeight = 0.2

    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: ARENA_COLORS.wallGlow,
      transparent: true,
      opacity: 1,
    })

    // Create edge strips for each wall
    const edgeNS = new THREE.BoxGeometry(ARENA_SIZE + 1, edgeHeight, edgeThickness)
    const edgeEW = new THREE.BoxGeometry(edgeThickness, edgeHeight, ARENA_SIZE)

    // North edge
    const northEdge = new THREE.Mesh(edgeNS, edgeMaterial)
    northEdge.position.set(0, WALL_HEIGHT + edgeHeight / 2, -ARENA_HALF - 0.25)
    walls.add(northEdge)

    // South edge
    const southEdge = new THREE.Mesh(edgeNS, edgeMaterial)
    southEdge.position.set(0, WALL_HEIGHT + edgeHeight / 2, ARENA_HALF + 0.25)
    walls.add(southEdge)

    // East edge
    const eastEdge = new THREE.Mesh(edgeEW, edgeMaterial)
    eastEdge.position.set(ARENA_HALF + 0.25, WALL_HEIGHT + edgeHeight / 2, 0)
    walls.add(eastEdge)

    // West edge
    const westEdge = new THREE.Mesh(edgeEW, edgeMaterial)
    westEdge.position.set(-ARENA_HALF - 0.25, WALL_HEIGHT + edgeHeight / 2, 0)
    walls.add(westEdge)
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose())
        } else {
          object.material.dispose()
        }
      }
      if (object instanceof THREE.LineSegments) {
        object.geometry.dispose()
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => mat.dispose())
        } else {
          object.material.dispose()
        }
      }
    })
  }
}
