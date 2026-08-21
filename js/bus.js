// System bus: RAM/ROM/PPU/APU stubs, simple LoROM/HiROM mapping helpers.
// Implemented originally (not copied) as a compact, pragmatic core used
// to mount ROM bytes, provide basic VRAM/OAM/CGRAM storage, and expose
// read/write hooks used by the CPU and PPU layers.
class SystemBus {
  constructor() {
    // Work RAM (WRAM) 128KB mapped at bank 7E/7F
    this.wram = new Uint8Array(0x20000);
    // Cartridge SRAM (battery-backed) emulate up to 128KB
    this.sram = new Uint8Array(0x20000);
    // Video/sprite/palette memory
    this.vram = new Uint8Array(0x10000); // 64KB
    this.oam  = new Uint8Array(544);     // 512 + 32 extra
    this.cgram = new Uint8Array(512);    // 256 * 2

    // Linear ROM store (raw file contents after header strip)
    this.rom = new Uint8Array(0);
    this.romMapped = false;
    this.isHiRom = false;
    this.header = null;

    // simple open-bus value
    this.openBus = 0;

    // approximate H/V timing
    this.dotCounter = 0;
    this.DOTS_PER_LINE = 341; // approximate
    this.LINES_PER_FRAME = 262;
    this.field = false;
    this.nmiPending = false;
    this.nmiPendingLatched = false;

    // basic APU stub state
    this.apuReady = false; // once the CPU writes to apu ports we echo writes
    this.apuPorts = new Uint8Array(4);
    this.apuWritten = [false, false, false, false];

    // DMA and math registers (lightweight)
    this.mpyA = 0xFF; this.mpyB = 0xFF; this.mulResult = 0;
    this.divDividend = 0xFFFF; this.divDivisor = 0; this.divQuot = 0; this.divRem = 0;

    // Expose read/write handlers for PPU/IO ranges that higher layers may call
    this.ppuRead = null;  // optional function(addr) -> byte
    this.ppuWrite = null; // optional function(addr, byte)
    this.ioRead = null;   // optional CPU IO reads ($4200-$421F etc.)
    this.ioWrite = null;
  }

  // strip copier header if necessary; then store raw bytes and attempt header detection
  loadROMBytes(bytes) {
    let data = bytes;
    if ((data.length % 1024) === 512) data = data.subarray(512);
    this.rom = new Uint8Array(data);

    // basic heuristic for header detection: try two common offsets and pick one
    const tryParse = (off) => {
      if (off + 32 > this.rom.length) return null;
      const map = this.rom[off + 0x15];
      const romSizeByte = this.rom[off + 0x17];
      const checksum = this.rom[off+0x1C] | (this.rom[off+0x1D]<<8);
      const complement = this.rom[off+0x1E] | (this.rom[off+0x1F]<<8);
      let title = '';
      for (let i = 0; i < 21; i++) {
        const c = this.rom[off + i];
        if (c >= 0x20 && c < 0x7F) title += String.fromCharCode(c);
      }
      return {
        map, romSizeByte, title: title.trim(), checksum, complement,
        checksumOk: ((checksum ^ complement) === 0xFFFF)
      };
    };

    const lo = tryParse(0x7FC0), hi = tryParse(0xFFC0);
    // choose best candidate: checksum ok preferred, otherwise title present
    if (hi && hi.checksumOk) { this.isHiRom = true; this.header = hi; }
    else if (lo && lo.checksumOk) { this.isHiRom = false; this.header = lo; }
    else if (hi && hi.title) { this.isHiRom = true; this.header = hi; }
    else if (lo && lo.title) { this.isHiRom = false; this.header = lo; }
    else { this.isHiRom = false; this.header = null; }

    this.romMapped = true;

    // if a global ROM mapper helper exists, use it to place ROM into memory
    if (typeof window.ROMMap === 'object' && typeof window.ROMMap.mapToMemory === 'function'){
      // ROMMap expects a "memory-like" object with .loadAt(addr, Uint8Array)
      // We'll provide a tiny proxy that writes into our virtual address space
      const proxy = {
        loadAt: (addr24, arr) => {
          // write to internal ROM buffer at linear location relative to addr24
          // For simplicity, map the chunk into the internal rom array (not into wram)
          // This is an adapter so ROMMap can be reused if present.
          // The ROMMap implementation should call mem.loadAt with bank:addr addresses
          // but in our case we also allow faster bulk copies if they target bank*addr offsets.
          // We'll ignore the 24-bit wrap and just append if addresses are out of range.
          const off = addr24 & 0xFFFFFF;
          if (off + arr.length <= this.rom.length) {
            this.rom.set(arr, off);
          } else {
            // fallback: if ROMMap maps into a separate "memory" region, copy into sram/rom as best-effort
            for (let i=0;i<arr.length;i++){
              const idx = (off + i) % this.rom.length;
              this.rom[idx] = arr[i];
            }
          }
        }
      };
      try {
        window.ROMMap.mapToMemory(proxy, this.rom, this.isHiRom ? 'hirom' : 'lorom');
      } catch(e){
        // non-fatal: mapping helper failed; we still have linear ROM bytes
        console.warn('ROMMap mapping failed:', e);
      }
    }
  }

  // approximate rom offset resolver for LoROM/HiROM
  romOffset(bank, addr){
    bank &= 0xFF; addr &= 0xFFFF;
    if (this.isHiRom){
      const b = bank & 0x3F;
      return b * 0x10000 + addr;
    } else {
      if (addr < 0x8000) return -1;
      const b = bank & 0x7F;
      return b * 0x8000 + (addr - 0x8000);
    }
  }

  read(bank, addr){
    bank &= 0xFF; addr &= 0xFFFF;
    this.openBus = (this.openBus + 1) & 0xFF; // trivial open-bus evolution

    // WRAM banks 0x7E/0x7F
    if (bank === 0x7E || bank === 0x7F){
      const off = ((bank - 0x7E) << 16) | addr;
      return this.wram[off & 0x1FFFF];
    }

    // small WRAM mirror at low addresses
    if (addr < 0x2000) return this.wram[addr & 0x1FFFF];

    // PPU range
    if ((bank & 0x40) === 0 && addr >= 0x2100 && addr <= 0x213F){
      if (typeof this.ppuRead === 'function') return this.ppuRead(addr);
      return this.openBus;
    }

    // CPU IO
    if ((bank & 0x40) === 0 && addr >= 0x4200 && addr <= 0x421F){
      if (typeof this.ioRead === 'function') return this.ioRead(addr);
      return this.openBus;
    }

    // APU stub space (simple handshake at $2140-$2143 in bank 00)
    if ((bank & 0x40) === 0 && addr >= 0x2140 && addr <= 0x2143){
      const p = addr & 0x03;
      if (!this.apuWritten[p]) return p === 0 ? 0xAA : (p===1?0xBB: this.openBus);
      return this.apuPorts[p];
    }

    // SRAM window for LoROM
    if (!this.isHiRom && addr >= 0x6000 && addr < 0x8000){
      const off = ((bank & 0x7F) * 0x8000) + (addr - 0x6000);
      return this.sram[off % this.sram.length];
    }

    // ROM read
    const roff = this.romOffset(bank, addr);
    if (roff >= 0 && this.rom && roff < this.rom.length) return this.rom[roff];

    return this.openBus;
  }

  write(bank, addr, val){
    bank &= 0xFF; addr &= 0xFFFF; val &= 0xFF;
    this.openBus = val;

    if (bank === 0x7E || bank === 0x7F){
      const off = ((bank - 0x7E) << 16) | addr;
      this.wram[off & 0x1FFFF] = val; return;
    }
    if (addr < 0x2000){ this.wram[addr & 0x1FFFF] = val; return; }

    if ((bank & 0x40) === 0 && addr >= 0x2100 && addr <= 0x213F){ if (typeof this.ppuWrite === 'function'){ this.ppuWrite(addr, val); } return; }
    if ((bank & 0x40) === 0 && addr >= 0x4200 && addr <= 0x421F){ if (typeof this.ioWrite === 'function') this.ioWrite(addr, val); return; }

    if ((bank & 0x40) === 0 && addr >= 0x2140 && addr <= 0x2143){ const p = addr & 0x03; this.apuPorts[p] = val; this.apuWritten[p] = true; this.apuReady = true; return; }

    if (!this.isHiRom && addr >= 0x6000 && addr < 0x8000){ const off = ((bank & 0x7F) * 0x8000) + (addr - 0x6000); this.sram[off % this.sram.length] = val; return; }

    // writes to ROM or unmapped space are ignored in this simple model
  }

  tick(cycles){
    // advance an approximate dot counter
    this.dotCounter += cycles;
    const frameNow = Math.floor(this.dotCounter / (this.DOTS_PER_LINE * this.LINES_PER_FRAME));
    const fieldNow = (frameNow % 2) === 1;
    if (fieldNow !== this.field){
      this.field = fieldNow;
      // latch NMI pending on frame flip
      this.nmiPending = true;
      this.nmiPendingLatched = true;
    }
  }
}

window.SystemBus = SystemBus;
