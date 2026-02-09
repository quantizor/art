/**
 * Input Manager
 *
 * Handles keyboard input for the lightcycle game.
 */

import { KEY_MAPPINGS } from '../constants'
import type { InputAction } from '../types'

type InputCallback = (action: InputAction) => void

export class InputManager {
  private callbacks: Set<InputCallback> = new Set()
  private pressedKeys: Set<string> = new Set()
  private enabled = false

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return

    // Prevent default for game keys
    const mapping = KEY_MAPPINGS.find((m) => m.key === event.code)
    if (mapping) {
      event.preventDefault()

      // Prevent key repeat
      if (this.pressedKeys.has(event.code)) return
      this.pressedKeys.add(event.code)

      this.emit(mapping.action)
    }
  }

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code)
  }

  private handleBlur = (): void => {
    // Clear pressed keys when window loses focus
    this.pressedKeys.clear()
  }

  /**
   * Start listening for input
   */
  enable(): void {
    if (this.enabled) return

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleBlur)
    this.enabled = true
  }

  /**
   * Stop listening for input
   */
  disable(): void {
    if (!this.enabled) return

    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleBlur)
    this.pressedKeys.clear()
    this.enabled = false
  }

  /**
   * Subscribe to input events
   */
  subscribe(callback: InputCallback): () => void {
    this.callbacks.add(callback)
    return () => {
      this.callbacks.delete(callback)
    }
  }

  /**
   * Emit action to all subscribers
   */
  private emit(action: InputAction): void {
    for (const callback of this.callbacks) {
      callback(action)
    }
  }

  /**
   * Check if a key is currently pressed
   */
  isPressed(key: string): boolean {
    return this.pressedKeys.has(key)
  }

  /**
   * Get all currently pressed keys
   */
  getPressedKeys(): string[] {
    return Array.from(this.pressedKeys)
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.disable()
    this.callbacks.clear()
  }
}
