// Updated S-PPU device implementing simplified DMA registers and triggering
class SPPU {
  constructor(memory, cpu, canvasEl) {
    this.mem = memory;
    this.cpu = cpu;

    this.vram = new Uint8Array(64 * 1024);
    this.oam = new Uint8Array(544);
    this.cgram = new Uint8Array(512);

    this.vramAddr = 0; this.vramInc = 1; this.ppuStatus = 0;
    this.masterCycles = 0; this.scanline = 0; this.frame = 0; this.inVBlank = false;

    this.canvas = canvasEl; this.width = 256; this.height = 224;
    if (this.canvas) { this.ctx = this.canvas.getContext('2d'); this.imageData = this.ctx.createImageData(this.width, this.height); this.fb = new Uint8ClampedArray(this.width * this.height * 4); }

    // DMA channel registers (we implement one generic channel for simplicity)
    this._dma = {
      srcBank: 0, srcAddr: 0, dest: 0, size: 0, control: 0, enabled: false
    };

    this._registerMemoryHandlers();
  }

  _registerMemoryHandlers() {
    for (let bank = 0; bank < 256; bank++) {
      const base2100 = (bank << 16) | 0x2100;
      const start2100 = base2100;
      const end2100 = (bank << 16) | 0x21FF;
      this.mem.setWriteHookRange(start2100, end2100, (v, addr) => this._onRegisterWrite(addr & 0xFFFF, v));

      const base4300 = (bank << 16) | 0x4300;
      const start4300 = base4300;
      const end4300 = (bank << 16) | 0x437F;
      this.mem.setWriteHookRange(start4300, end4300, (v, addr) => this._onDMAWrite(addr & 0xFFFF, v));
    }
  }

  _onRegisterWrite(offset16, value) {
    switch (offset16 & 0xFF) {
      case 0x05: case 0x06: case 0x07:
        if ((offset16 & 0xFF) === 0x05) { this._vramAddrLow = value; }
        if ((offset16 & 0xFF) === 0x06) { this._vramAddrMid = value; }
        if ((offset16 & 0xFF) === 0x07) { this._vramAddrHigh = value; this.vramAddr = ((this._vramAddrHigh & 0xFF) << 16) | ((this._vramAddrMid & 0xFF) << 8) | (this._vramAddrLow & 0xFF); }
        break;
      case 0x08:
        this.writeVRAM(this.vramAddr & 0xFFFF, value);
        this.vramAddr = (this.vramAddr + this.vramInc) & 0xFFFFFF;
        break;
      case 0x0A: case 0x0B:
        if ((offset16 & 0xFF) === 0x0A) { this._oamAddr = value; }
        if ((offset16 & 0xFF) === 0x0B) { const idx = this._oamAddr & 0x1FF; this.oam[idx] = value; this._oamAddr = (this._oamAddr + 1) & 0x1FF; }
        break;
      case 0x0C: case 0x0D:
        if ((offset16 & 0xFF) === 0x0C) { this._cgramAddr = value & 0x1FF; }
        if ((offset16 & 0xFF) === 0x0D) { const a = this._cgramAddr & 0x1FF; this.cgram[a] = value; this._cgramAddr = (this._cgramAddr + 1) & 0x1FF; }
        break;
      case 0x20:
        this.vramInc = (value === 0x20) ? 32 : 1;
        break;
      default:
        break;
    }
  }

  _onDMAWrite(offset16, value) {
    // Implement a simplified DMA register layout; we'll use 0x4300..0x4307 for one channel:
    // 0x4300: control (enable bit)
    // 0x4301: dest (0=VRAM,1=OAM,2=CGRAM)
    // 0x4302: src bank
    // 0x4303: src addr low
    // 0x4304: src addr high
    // 0x4305: length low
    // 0x4306: length high
    // 0x4307: trigger (write any value to start)
    const reg = offset16 & 0xFF;
    switch (reg) {
      case 0x00: this._dma.control = value; this._dma.enabled = !!(value & 0x80); break;
      case 0x01: this._dma.dest = value & 0xFF; break;
      case 0x02: this._dma.srcBank = value & 0xFF; break;
      case 0x03: this._dma.srcAddrLow = value & 0xFF; break;
      case 0x04: this._dma.srcAddrHigh = value & 0xFF; break;
      case 0x05: this._dma.lenLow = value & 0xFF; break;
      case 0x06: this._dma.lenHigh = value & 0xFF; break;
      case 0x07:
        // trigger DMA now
        this._dma.srcAddr = (this._dma.srcAddrHigh << 8) | this._dma.srcAddrLow;
        this._dma.size = ((this._dma.lenHigh << 8) | this._dma.lenLow) || 0x10000;
        this._performDMA();
        break;
      default: break;
    }
  }

  _performDMA() {
    const size = this._dma.size;
    const srcBank = this._dma.srcBank & 0xFF;
    let srcAddr = this._dma.srcAddr & 0xFFFF;
    const dest = this._dma.dest & 0xFF;
    // copy byte-by-byte for now
    for (let i = 0; i < size; i++) {
      const value = this.mem.read8((srcBank << 16) | srcAddr);
      if (dest === 0) {
        // VRAM
        this.writeVRAM(srcAddr & 0xFFFF, value);
      } else if (dest === 1) {
        // OAM
        const idx = srcAddr & 0x1FF; this.oam[idx] = value;
      } else if (dest === 2) {
        const idx = srcAddr & 0x1FF; this.cgram[idx] = value;
      }
      srcAddr = (srcAddr + 1) & 0xFFFF;
    }
    // signal DMA completion by clearing enable
    this._dma.enabled = false;
    this._dma.control = 0;
    // Optionally set a PPU status flag or trigger IRQ; many games don't expect IRQ on DMA completion
    this.cpu && (this.cpu.pendingIRQ = true);
  }

  writeVRAM(offset, value) {
    const o = offset & (this.vram.length - 1);
    this.vram[o] = value & 0xFF;
    this._vramToFb(o, value & 0xFF);
  }

  _vramToFb(vramOffset, val) {
    if (!this.imageData) return;
    const px = vramOffset % (this.width * this.height);
    const base = px * 4;
    this.fb[base + 0] = val; this.fb[base + 1] = val; this.fb[base + 2] = val; this.fb[base + 3] = 0xFF;
  }

  renderFrame() { if (!this.imageData) return; this.imageData.data.set(this.fb); this.ctx.putImageData(this.imageData, 0, 0); }

  step(cycles) {
    this.masterCycles += cycles;
    const dots = this.masterCycles * 4;
    while (dots >= (this.scanline + 1) * 1364) {
      this.scanline++;
      if (this.scanline === 224) {
        this.inVBlank = true; this.ppuStatus |= 0x80; if (this.cpu && typeof this.cpu.onVBlank === 'function') this.cpu.onVBlank();
      }
      if (this.scanline >= 262) { this.renderFrame(); this.frame++; this.scanline = 0; this.inVBlank = false; this.ppuStatus &= ~0x80; }
    }
    this.masterCycles = 0;
  }
}

window.SPPU = SPPU;
