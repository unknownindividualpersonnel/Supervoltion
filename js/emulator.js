// Updated Emulator harness to process CPU pending interrupts properly and reflect DMA behavior
class Emulator {
  constructor(consoleEl, canvasEl) {
    this.mem = new Memory();
    this.cpu = new CPU65C816(this.mem);
    this.consoleEl = consoleEl;
    this.ppu = new SPPU(this.mem, this.cpu, canvasEl);

    this.mem.setWriteHook(0x006000, (v) => { this.log(String.fromCharCode(v)); });

    // CPU VBlank callback -> set pending NMI
    this.cpu.onVBlank = () => {
      this.log('[emu] PPU: VBlank started (requesting NMI)\n');
      // SNES usually generates NMI on VBlank if enabled; we set pendingNMI
      this.cpu.pendingNMI = true;
    };
  }

  log(s) { if (this.consoleEl) { this.consoleEl.textContent += s; this.consoleEl.scrollTop = this.consoleEl.scrollHeight; } else console.log('[emu]', s); }

  loadROMBytes(bytes) {
    const format = ROMMap.detectFormat(bytes);
    const result = ROMMap.mapToMemory(this.mem, bytes, format);
    this.format = format;
    this.log(`ROM loaded (${format}) mapped ${result.mappedBanks} banks, bankSize=${result.bankSize}\n`);
    if (format === 'lorom') { const loadAddr = 0x008000; this.mem.write16(0x0000, loadAddr & 0xFFFF); this.mem.write8(0x0002, 0x00); this.cpu.PC = loadAddr; this.cpu.PB = 0x00; this.cpu.DB = 0x00; }
    else { const loadAddr = 0x0000; this.mem.write16(0x0000, loadAddr & 0xFFFF); this.mem.write8(0x0002, 0x00); this.cpu.PC = loadAddr; this.cpu.PB = 0x00; this.cpu.DB = 0x00; }
  }

  loadDemoProgram() {
    // Demo that performs DMA from ROM mapped region to VRAM using 0x4300 DMA registers
    const base = 0x0500; const prog = [];
    const WR = (addr24, val) => { const low = addr24 & 0xFF; const hi = (addr24 >> 8) & 0xFF; prog.push(0xA9); prog.push(val & 0xFF); prog.push(0x8D); prog.push(low); prog.push(hi); };
    // Setup DMA registers in bank 0x00 region 0x4300..
    // srcBank = 0x00; srcAddr = 0x008000; length = 0x0200; dest = VRAM(0)
    // write srcBank
    WR(0x004302, 0x00);
    // write srcAddr low/high (0x008000 -> low=0x00, high=0x80)
    WR(0x004303, 0x00); WR(0x004304, 0x80);
    // write length low/high
    WR(0x004305, 0x00); WR(0x004306, 0x02);
    // write dest
    WR(0x004301, 0x00);
    // trigger (write to 0x4307)
    WR(0x004307, 0x01);
    prog.push(0x00);
    this.mem.loadAt(base, new Uint8Array(prog)); this.mem.write16(0x0000, base); this.cpu.PC = base; this.cpu.PB = 0x00; this.cpu.DB = 0x00;
    this.log('Demo DMA program loaded at 0x0500\n');
  }

  start() {
    this.cpu.running = true;
    const stepChunk = () => {
      if (!this.cpu.running) return;
      for (let i = 0; i < 1000; i++) {
        if (!this.cpu.running) break;
        this.cpu.step();
        // after each instruction, advance PPU by approximate cycles
        this.ppu.step(3);
        // if CPU requested IRQ/NMI handling it will be serviced at start of next instruction via cpu.step()
      }
      setTimeout(stepChunk, 0);
    };
    stepChunk();
  }

  stop() { this.cpu.running = false; }
  stepOnce() { this.cpu.step(); this.ppu.step(3); }
}

window.Emulator = Emulator;
