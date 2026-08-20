// Minimal 65C816-like CPU core skeleton (subset of instructions)
// This is an incremental implementation: start here and expand.

class CPU65C816 {
  constructor(memory) {
    this.mem = memory;
    // 16-bit/8-bit registers — start in emulation mode for simplicity
    this.A = 0; // accumulator (can be 8 or 16-bit)
    this.X = 0;
    this.Y = 0;
    this.SP = 0x01FF; // stack pointer (16-bit in native, 8-bit in emulation), start at 0x01FF
    this.D = 0; // direct page
    this.DB = 0; // data bank register
    this.PB = 0; // program bank register
    this.P = 0x34; // processor status: default with IRQ disabled (for dev)
    this.PC = 0x0000; // program counter (16-bit), bank in PB
    this.cycles = 0;

    this.running = false;
    this.onOutput = null; // callback for emulated IO
  }

  reset() {
    // For our simple model, use vector at 0x0000/0x0001 as reset vector
    const lo = this.mem.read8(0x0000);
    const hi = this.mem.read8(0x0001);
    this.PC = (hi << 8) | lo;
    this.cycles = 7; // reset penalty
    console.log(`CPU reset, PC=0x${this.PC.toString(16)}`);
  }

  fetch8() {
    const addr = (this.PB << 16) | (this.PC & 0xFFFF);
    const v = this.mem.read8(addr);
    this.PC = (this.PC + 1) & 0xFFFF;
    return v;
  }

  fetch16() {
    const lo = this.fetch8();
    const hi = this.fetch8();
    return lo | (hi << 8);
  }

  step() {
    const opcode = this.fetch8();
    // simple opcode handler for a few instructions
    switch (opcode) {
      case 0xEA: // NOP
        this.cycles += 2;
        break;
      case 0xA9: // LDA immediate (8-bit)
        {
          const value = this.fetch8();
          this.A = value & 0xFF;
          this.setZN(this.A & 0xFF);
          this.cycles += 2;
        }
        break;
      case 0xA2: // LDX immediate
        {
          const value = this.fetch8();
          this.X = value & 0xFF;
          this.setZN(this.X & 0xFF);
          this.cycles += 2;
        }
        break;
      case 0x8D: // STA absolute
        {
          const addr = this.fetch16();
          const full = (this.DB << 16) | addr;
          this.mem.write8(full, this.A & 0xFF);
          this.cycles += 4;
        }
        break;
      case 0x4C: // JMP absolute
        {
          const addr = this.fetch16();
          this.PC = addr & 0xFFFF;
          this.cycles += 3;
        }
        break;
      case 0x00: // BRK — stop for now
        console.log('BRK encountered — halting');
        this.running = false;
        this.cycles += 7;
        break;
      case 0xE8: // INX
        this.X = (this.X + 1) & 0xFF;
        this.setZN(this.X);
        this.cycles += 2;
        break;
      default:
        console.log(`Unhandled opcode 0x${opcode.toString(16)} at PC=0x${((this.PB<<16)|( (this.PC-1)&0xFFFF)).toString(16)}`);
        this.running = false;
        break;
    }
  }

  runFrame(maxCycles = 100000) {
    this.running = true;
    let cycles = 0;
    while (this.running && cycles < maxCycles) {
      this.step();
      cycles++;
    }
    return cycles;
  }

  setZN(val) {
    // val is 8-bit value
    if ((val & 0x80) !== 0) this.P |= 0x80; else this.P &= ~0x80;
    if ((val & 0xFF) === 0) this.P |= 0x02; else this.P &= ~0x02;
  }
}

window.CPU65C816 = CPU65C816;
