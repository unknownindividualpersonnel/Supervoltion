// Updated CPU core to use Opcodes table and Addressing helpers
class CPU65C816 {
  constructor(memory) {
    this.mem = memory;
    this.A = 0;
    this.X = 0;
    this.Y = 0;
    this.SP = 0x01FF;
    this.D = 0x0000;
    this.DB = 0x00;
    this.PB = 0x00;
    this.P = 0x34;
    this.PC = 0x0000;
    this.cycles = 0;
    this.running = false;
    this.onOutput = null;
  }

  reset() {
    const lo = this.mem.read8(0x0000);
    const hi = this.mem.read8(0x0001);
    this.PC = (hi << 8) | lo;
    this.cycles = 7;
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
    const entry = window.Opcodes.lookup(opcode);
    if (!entry) {
      console.log(`Unhandled opcode 0x${opcode.toString(16)} at PB=0x${this.PB.toString(16)} PC=0x${(this.PC-1).toString(16)}`);
      this.running = false;
      return;
    }

    // call handler by name
    const handlerName = entry.handler;
    if (typeof this[handlerName] === 'function') {
      this[handlerName](entry);
      this.cycles += entry.cycles;
    } else {
      console.log(`Opcode handler ${handlerName} not implemented`);
      this.running = false;
    }
  }

  // Handlers
  op_NOP() { /* nothing */ }

  op_LDA_imm() {
    const v = window.Addressing.imm8(this);
    this.A = v & 0xFF;
    this.setZN(this.A & 0xFF);
  }

  op_LDX_imm() {
    const v = window.Addressing.imm8(this);
    this.X = v & 0xFF;
    this.setZN(this.X & 0xFF);
  }

  op_STA_abs() {
    const full = window.Addressing.abs(this); // returns 24-bit address
    this.mem.write8(full, this.A & 0xFF);
  }

  op_JMP_abs() {
    const addr16 = window.Addressing.abs16(this);
    this.PC = addr16 & 0xFFFF;
  }

  op_BRK() {
    // For now, halting behavior
    this.running = false;
  }

  op_INX() {
    this.X = (this.X + 1) & 0xFF;
    this.setZN(this.X & 0xFF);
  }

  setZN(val) {
    if ((val & 0x80) !== 0) this.P |= 0x80; else this.P &= ~0x80;
    if ((val & 0xFF) === 0) this.P |= 0x02; else this.P &= ~0x02;
  }
}

window.CPU65C816 = CPU65C816;
