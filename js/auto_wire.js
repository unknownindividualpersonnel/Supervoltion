// Auto-integration glue: wire SystemBus <-> CPU <-> PPU together at runtime.
// This script is intentionally defensive: it waits for the various pieces
// (SystemBus, Memory, CPU class, and PPU) to be available and then hooks
// them together. It does not copy implementation — just performs wiring.
(function(){
  function BusMemoryAdapter(bus){
    this.bus = bus;
  }
  BusMemoryAdapter.prototype.read8 = function(addr24){
    const bank = (addr24 >>> 16) & 0xFF; const addr = addr24 & 0xFFFF;
    return this.bus.read(bank, addr) & 0xFF;
  };
  BusMemoryAdapter.prototype.write8 = function(addr24, val){
    const bank = (addr24 >>> 16) & 0xFF; const addr = addr24 & 0xFFFF;
    this.bus.write(bank, addr, val & 0xFF);
  };
  BusMemoryAdapter.prototype.read16 = function(addr24){
    const lo = this.read8(addr24); const hi = this.read8((addr24+1)&0xFFFFFF);
    return lo | (hi<<8);
  };
  BusMemoryAdapter.prototype.write16 = function(addr24, val){ this.write8(addr24, val & 0xFF); this.write8((addr24+1)&0xFFFFFF, (val>>>8)&0xFF); };

  function ensureWire(){
    if (!window.SystemBus || !window.Memory || !window.CPU65C816) return false;
    if (!window.systemBus){ window.systemBus = new window.SystemBus(); console.log('systemBus: created'); }
    if (!window.busMemAdapter){ window.busMemAdapter = new BusMemoryAdapter(window.systemBus); console.log('busMemAdapter: created'); }

    // Attach PPU if available
    if (window.PPU && !window._PPU_attached){
      try{ window.PPU.attachPPU(window.systemBus); window._PPU_attached = true; console.log('PPU: attached to systemBus'); }
      catch(e){ console.warn('PPU attach failed', e); }
    }

    // Wrap CPU65C816.prototype.step to tick the bus with the returned cycles
    const CPU = window.CPU65C816;
    if (CPU && !CPU.prototype._wiredToBus){
      const orig = CPU.prototype.step;
      CPU.prototype.step = function(){
        // Ensure this.mem is connected to the adapter
        if (!this.mem){ this.mem = window.busMemAdapter; }
        const consumed = orig.apply(this, arguments);
        try{ if (window.systemBus && typeof consumed === 'number' && consumed > 0) window.systemBus.tick(consumed); }catch(e){ console.warn('systemBus.tick error', e); }
        return consumed;
      };
      CPU.prototype._wiredToBus = true;
      console.log('CPU65C816: step wrapped to advance systemBus by consumed cycles');
    }

    // If a global cpu instance exists and has no mem, connect it
    if (window.cpu && !window.cpu.mem){ window.cpu.mem = window.busMemAdapter; console.log('global cpu instance wired to bus adapter'); }

    return true;
  }

  // Try immediately and keep trying until success (short polling)
  if (!ensureWire()){
    const id = setInterval(()=>{ if (ensureWire()){ clearInterval(id); } }, 50);
  }
})();
