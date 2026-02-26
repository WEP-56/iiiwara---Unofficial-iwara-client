;(function () {
  'use strict'
  const PALETTE_BG = {
    blue:   'hsla(220, 22%, 6%, ',
    purple: 'hsla(265, 22%, 6%, ',
    green:  'hsla(158, 22%, 5%, ',
    pink:   'hsla(335, 22%, 6%, ',
    custom: 'hsla(220, 12%, 6%, ',
  }
  const GlassManager = {
    active: false,
    _instances: new Map(),
    _config: {
      scale:      14,
      blur:       2,
      saturation: 155,
      aberration: 25,
      bgOpacity:  0.50,
      mode:       'standard',
    },
    enable(palette, config) {
      this.active = true
      if (config) Object.assign(this._config, config)
      document.body.dataset.glass = 'on'
      this._updateBgLayer(palette || 'blue')
      requestAnimationFrame(() => {
        this._mountCards()
      })
    },
    disable() {
      this.active = false
      document.body.dataset.glass = 'off'
      this._destroyAll()
    },
    onPaletteChange(newPalette) {
      if (!this.active) return
      this._updateBgLayer(newPalette)
    },
    mountNewCards(container) {
      if (!this.active) return
      this._mountCards(container)
    },
    updateConfig(partialConfig) {
      Object.assign(this._config, partialConfig)
      if (!this.active) return
      if (partialConfig.bgOpacity !== undefined) {
        const bg = document.getElementById('app-bg')
        if (bg) {
          const palette = document.body.dataset.glasspalette || 'blue'
          bg.style.background = (PALETTE_BG[palette] || PALETTE_BG.blue) + partialConfig.bgOpacity + ')'
        }
      }
      this._instances.forEach(instance => {
        try {
          instance.update({
            scale:      this._config.scale,
            blur:       this._config.blur,
            saturation: this._config.saturation,
            aberration: this._config.aberration,
            mode:       this._config.mode,
          })
        } catch (e) {}
      })
    },
    _updateBgLayer(palette) {
      const bg = document.getElementById('app-bg')
      if (!bg) return
      const base = PALETTE_BG[palette] || PALETTE_BG.blue
      bg.style.background = base + this._config.bgOpacity + ')'
      document.body.dataset.glasspalette = palette
    },
    _mountCards(container) {
      if (!window.LiquidWeb) return
      const target = container || document
      const cards = target.querySelectorAll('.card, .vcard, .icard')
      cards.forEach(el => {
        if (el.dataset.liquidMounted) return
        if (el.children.length !== 1) return
        try {
          const instance = new window.LiquidWeb(el, {
            scale: this._config.scale,
            blur: this._config.blur,
            saturation: this._config.saturation,
            aberration: this._config.aberration,
            mode: this._config.mode,
            init: true
          })
          el.dataset.liquidMounted = '1'
          this._instances.set(el, instance)
        } catch (e) {
          console.warn('[GlassManager] LiquidWeb mount failed on', el, e.message)
        }
      })
    },
    _destroyAll() {
      this._instances.forEach(instance => {
        try { instance.destroy() } catch (e) {}
      })
      this._instances.clear()
      document.querySelectorAll('[data-liquid-mounted]').forEach(el => {
        el.removeAttribute('data-liquid-mounted')
      })
    },
  }
  window.GlassManager = GlassManager
})()
