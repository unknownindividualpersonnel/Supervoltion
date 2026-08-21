// Emulator harness connecting Memory + CPU + PPU
class Emulator {
  constructor(consoleEl, canvasEl) {
    this.mem = new Memory();
    this.cpu = new CPU65C816(this.mem);
    this.consoleEl = consoleEl;
    this.ppu = null;
    if (canvasEl) {
      this.ppu = new PPU(canvasEl);
      // map a small VRAM window into memory at 0x007000.. for demo
      const fbSize = this.ppu.width * this.ppu.height;
      const start = 0x007000;
      const end = start + fbSize - 1;
      this.mem.setWriteHookRange(start, end, (v, addr) => {
        const off = addr - start;
        this.ppu.writeVram(off, v);
      });
      // expose framebuffer size to UI
      const el = document.getElementById('fb-size'); if (el) el.textContent = fbSize;
      // start render loop
      const renderLoop = () => { if (this.ppu) this.ppu.renderToCanvas(); requestAnimationFrame(renderLoop); };
      requestAnimationFrame(renderLoop);
    }

    // keep simple console output hook at 0x006000 as before
    this.mem.setWriteHook(0x006000, (v) => { this.log(String.fromCharCode(v)); });
  }

  log(s) {
    if (this.consoleEl) { this.consoleEl.textContent += s; this.consoleEl.scrollTop = this.consoleEl.scrollHeight; }
    else console.log('[emu]', s);
  }

  loadROMBytes(bytes) {
    const loadAddr = 0x008000;
    this.mem.loadAt(loadAddr, bytes);
    this.mem.write16(0x0000, loadAddr & 0xFFFF);
    this.mem.write8(0x0002, (loadAddr >>> 16) & 0xFF);
    this.cpu.PB = 0x00; this.cpu.DB = 0x00; this.cpu.PC = loadAddr & 0xFFFF;
    this.log(`ROM loaded ${bytes.length} bytes at 0x${loadAddr.toString(16)}\n`);
  }

  loadDemoProgram() {
    // Demo: write pattern into VRAM-mapped region and then halt
    const prog = [
      // simple loop writing incrementing values into VRAM region starting at 0x007000
      0xA9, 0x00,             // LDA #$00
      0x8D, 0x00, 0x70,       // STA $7000 (low/high) -> maps to 0x007000
      0xE8,                   // INX
      0xA9, 0x01,             // LDA #$01
      0x8D, 0x01, 0x70,
      0x00                    // BRK
    ];
    // place at 0x0300
    const base = 0x0300;
    this.mem.loadAt(base, new Uint8Array(prog));
    this.mem.write16(0x0000, base);
    this.cpu.PC = base; this.cpu.PB = 0x00; this.cpu.DB = 0x00;
    this.log('Demo program loaded at 0x0300\n');
  }

  start() {
    this.cpu.running = true;
    const stepChunk = () => {
      if (!this.cpu.running) return;
      for (let i = 0; i < 1000; i++) {
        if (!this.cpu.running) break;
        this.cpu.step();
      }
      setTimeout(stepChunk, 0);
    };
    stepChunk();
  }

  stop() { this.cpu.running = false; }
  stepOnce() { this.cpu.step(); }
}

window.Emulator = Emulator;
