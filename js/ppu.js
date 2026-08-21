// Proper S-PPU device that responds to CPU register reads/writes and advances with cycles.
class SPPU {
  constructor(memory, cpu, canvasEl) {
    this.mem = memory;
    this.cpu = cpu; // callback hooks will call into CPU when needed

    // VRAM (64KB), OAM (544 bytes typical), CGRAM (512 bytes for 15-bit colors)
    this.vram = new Uint8Array(64 * 1024);
    this.oam = new Uint8Array(544);
    this.cgram = new Uint8Array(512);

    // Internal registers (simplified / essential subset)
    this.vramAddr = 0; // 24-bit
    this.vramInc = 1;  // increment after write
    this.ppuStatus = 0; // status flags, includes VBlank bit

    // timing
    this.masterCycles = 0; // count CPU cycles passed in
    this.scanline = 0;
    this.frame = 0;
    this.inVBlank = false;

    // canvas rendering
    this.canvas = canvasEl;
    this.width = 256; this.height = 224;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.imageData = this.ctx.createImageData(this.width, this.height);
      this.fb = new Uint8ClampedArray(this.width * this.height * 4);
    }

    // register handlers: SNES PPU registers are usually at 0x2100-0x213F ranges;
    // we register handlers for every bank for addresses 0x2100..0x21FF so CPU can access them via banked addresses.
    this._registerMemoryHandlers();
  }

  _registerMemoryHandlers() {
    // For every bank 0x00..0xFF, map low-16 addresses between 0x2100 and 0x21FF
    for (let bank = 0; bank < 256; bank++) {
      const base = (bank << 16) | 0x2100;
      const start = base;
      const end = (bank << 16) | 0x21FF;
      this.mem.setWriteHookRange(start, end, (v, addr) => this._onRegisterWrite(addr & 0xFFFF, v));
      // Optionally: reads can be implemented if needed by adding read hooks; our Memory currently lacks readHook API.
    }
  }

  _onRegisterWrite(offset16, value) {
    // offset16 is low 16 bits of address like 0x2100..0x21FF
    // implement simplified subset of PPU registers:
    switch (offset16 & 0xFF) {
      case 0x00: // 0x2100 - INIDISP: screen brightness / enable (simplified)
        // we'll treat bit 7 as screen display enable (0 = off, 1 = on)
        this.ppuStatus = (this.ppuStatus & ~0x80) | ((value & 0x80) ? 0x80 : 0);
        break;
      case 0x01: // 0x2101 - Unused here
        break;
      case 0x05: // 0x2105 - VRAM address low (we'll map 2105/2106/2107 simplified)
      case 0x06:
      case 0x07:
        // We'll use a custom sequence: writes to 2105=low, 2106=mid, 2107=high for vramAddr
        if ((offset16 & 0xFF) === 0x05) { this._vramAddrLow = value; }
        if ((offset16 & 0xFF) === 0x06) { this._vramAddrMid = value; }
        if ((offset16 & 0xFF) === 0x07) {
          this._vramAddrHigh = value;
          this.vramAddr = ((this._vramAddrHigh & 0xFF) << 16) | ((this._vramAddrMid & 0xFF) << 8) | (this._vramAddrLow & 0xFF);
        }
        break;
      case 0x08: // 0x2108 - VRAM write port (write data to VRAM at vramAddr, then increment)
        this.writeVRAM(this.vramAddr & 0xFFFF, value);
        this.vramAddr = (this.vramAddr + this.vramInc) & 0xFFFFFF;
        break;
      case 0x0A: // 0x210A - OAM addr (low)
      case 0x0B: // 0x210B - OAM data port
        // Simplified: write OAM sequentially using 0x210B as data
        if ((offset16 & 0xFF) === 0x0A) { this._oamAddr = value; }
        if ((offset16 & 0xFF) === 0x0B) {
          const idx = this._oamAddr & 0x1FF; this.oam[idx] = value; this._oamAddr = (this._oamAddr + 1) & 0x1FF;
        }
        break;
      case 0x0C: // 0x210C - CGRAM addr
      case 0x0D: // 0x210D - CGRAM data
        if ((offset16 & 0xFF) === 0x0C) { this._cgramAddr = value & 0x1FF; }
        if ((offset16 & 0xFF) === 0x0D) { const a = this._cgramAddr & 0x1FF; this.cgram[a] = value; this._cgramAddr = (this._cgramAddr + 1) & 0x1FF; }
        break;
      case 0x20: // 0x2120 - set VRAM increment (simplified: value 1 or 32)
        this.vramInc = (value === 0x20) ? 32 : 1;
        break;
      default:
        // unhandled register — ignore for now
        break;
    }
  }

  writeVRAM(offset, value) {
    const o = offset & (this.vram.length - 1);
    this.vram[o] = value & 0xFF;
    // For rendering: map linear VRAM bytes into framebuffer palette indices.
    this._vramToFb(o, value & 0xFF);
  }

  _vramToFb(vramOffset, val) {
    // Simple mapping: write val as grayscale into pixel at index = vramOffset
    if (!this.imageData) return;
    const px = vramOffset % (this.width * this.height);
    const base = px * 4;
    this.fb[base + 0] = val;
    this.fb[base + 1] = val;
    this.fb[base + 2] = val;
    this.fb[base + 3] = 0xFF;
  }

  renderFrame() {
    if (!this.imageData) return;
    this.imageData.data.set(this.fb);
    this.ctx.putImageData(this.imageData, 0, 0);
  }

  step(cycles) {
    // Advance internal counters by CPU cycles. We'll convert CPU cycles to PPU dot ticks roughly.
    this.masterCycles += cycles;
    // approximate: SNES: ~1364 PPU dots per scanline; CPU cycles scale differs; for simplicity assume 1 CPU cycle ~= 4 PPU dots
    const dots = this.masterCycles * 4;
    // if enough dots pass for a scanline, advance scanline
    while (dots >= (this.scanline + 1) * 1364) {
      // advance scanline
      this.scanline++;
      if (this.scanline === 224) {
        // start VBlank
        this.inVBlank = true;
        this.ppuStatus |= 0x80; // set VBlank bit
        // let CPU know (callback)
        if (this.cpu && typeof this.cpu.onVBlank === 'function') this.cpu.onVBlank();
      }
      if (this.scanline >= 262) {
        // end of frame
        this.renderFrame();
        this.frame++;
        this.scanline = 0;
        this.inVBlank = false;
        this.ppuStatus &= ~0x80;
      }
    }
    // consume masterCycles (reset for simplicity)
    this.masterCycles = 0;
  }
}

window.SPPU = SPPU;
