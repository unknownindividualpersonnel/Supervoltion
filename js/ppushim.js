// SPPU compatibility constructor shim for legacy emulator code that uses `new SPPU(mem,cpu,canvas)`.
// This adapter forwards to the new PPU implementation when available and provides a minimal
// implementation when it's not. It also exposes step() so older emulator loops can call it.
(function(){
  function SPPU(mem, cpu, canvas){
    this.mem = mem;
    this.cpu = cpu;
    this.canvas = canvas || null;
    this._attached = false;
    // Try to attach the modern PPU implementation if present
    if (window.PPU && typeof window.PPU.attachPPU === 'function' && window.systemBus){
      try {
        window.PPU.attachPPU(window.systemBus);
        this._attached = true;
      } catch(e){
        console.warn('SPPU shim: PPU.attachPPU threw', e);
      }
    } else {
      // Defer attach until PPU or systemBus becomes available
      const tryAttach = () => {
        if (!this._attached && window.PPU && typeof window.PPU.attachPPU === 'function' && window.systemBus){
          try{ window.PPU.attachPPU(window.systemBus); this._attached = true; console.log('SPPU shim: deferred PPU attached'); } catch(e){ console.warn('SPPU shim deferred attach failed', e); }
        }
      };
      this._attachInt = setInterval(tryAttach, 100);
    }
  }

  SPPU.prototype._renderToCanvas = function(frame){
    if (!this.canvas) return;
    try{
      const ctx = this.canvas.getContext('2d');
      if (!this._imageData || this._imageData.data.length !== frame.length){
        this._imageData = new ImageData(new Uint8ClampedArray(frame), 256, 224);
      } else {
        // copy into existing ImageData buffer
        this._imageData.data.set(frame);
      }
      ctx.putImageData(this._imageData, 0, 0);
    } catch(e){ console.warn('SPPU shim render error', e); }
  };

  // step(n): emulate stepping the PPU by n pseudo-cycles; older code calls ppu.step(3)
  SPPU.prototype.step = function(n){
    // If modern PPU is attached, render a frame snapshot
    if (window.PPU && typeof window.PPU.renderFrame === 'function' && window.systemBus){
      const frame = window.PPU.renderFrame(window.systemBus);
      this._renderToCanvas(frame);
    } else {
      // fallback: fill canvas with a checker or leave black
      if (this.canvas){
        const ctx = this.canvas.getContext('2d');
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
      }
    }
  };

  SPPU.prototype.renderNow = function(){ this.step(0); };

  // Expose global constructor for legacy code
  window.SPPU = window.SPPU || SPPU;
  // also provide a no-op attach/renderFrame for other callsites
  if (!window.SPPU.attach) window.SPPU.attach = function(bus){ if (window.PPU && window.PPU.attachPPU) return window.PPU.attachPPU(bus); };
  if (!window.SPPU.renderFrame) window.SPPU.renderFrame = function(bus){ return (window.PPU && window.PPU.renderFrame) ? window.PPU.renderFrame(bus) : (new Uint8ClampedArray(256*224*4)); };
  console.log('SPPU constructor shim installed (legacy compatibility)');
})();
