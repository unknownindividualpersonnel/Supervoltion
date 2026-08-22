// Compatibility shim to expose the new PPU API as the legacy SPPU global
// Some older code (emulator.js / other integrations) expect a global SPPU
// object with attach/renderFrame. We expose that interface by forwarding to
// window.PPU when available, and provide safe fallbacks that log helpful
// errors when the real PPU implementation isn't loaded yet.
(function(){
  function makeShim(){
    if (window.SPPU && window.SPPU.__isShim) return; // already installed

    const shim = {
      __isShim: true,
      attach(bus){
        if (window.PPU && typeof window.PPU.attachPPU === 'function'){
          window.PPU.attachPPU(bus);
        } else {
          console.warn('PPU implementation not present yet — attach deferred');
          // fallback: try to attach later when PPU loads
          const id = setInterval(()=>{
            if (window.PPU && typeof window.PPU.attachPPU === 'function'){
              clearInterval(id);
              window.PPU.attachPPU(bus);
              console.log('PPU: attached (deferred)');
            }
          }, 50);
        }
      },
      renderFrame(bus){
        if (window.PPU && typeof window.PPU.renderFrame === 'function') return window.PPU.renderFrame(bus);
        console.warn('PPU.renderFrame not available — returning empty frame');
        const WIDTH = 256, HEIGHT = 224;
        const frame = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
        for (let i=3;i<frame.length;i+=4) frame[i]=255;
        return frame;
      }
    };

    window.SPPU = shim;
    // Also mirror old single-function globals if code expects them
    window.attachPPU = function(bus){ return shim.attach(bus); };
    window.renderFrame = function(bus){ return shim.renderFrame(bus); };
    console.log('SPPU shim installed (for compatibility with legacy integrations)');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', makeShim); else makeShim();
})();
