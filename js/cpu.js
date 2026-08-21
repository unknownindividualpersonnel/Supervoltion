// Updated CPU core with more ALU ops and branch handlers
// Flag bit masks (simple mapping)
const FLAG_C = 0x01; // Carry
const FLAG_Z = 0x02; // Zero
const FLAG_I = 0x04; // IRQ disable
const FLAG_D = 0x08; // Decimal
const FLAG_X = 0x10; // Index width
const FLAG_M = 0x20; // Accumulator width
const FLAG_V = 0x40; // Overflow
const FLAG_N = 0x80; // Negative

class CPU65C816 {
  constructor(memory) {
    this.mem = memory;
    this.A = 0; this.X = 0; this.Y = 0;
    this.SP = 0x01FF; this.D = 0x0000; this.DB = 0x00; this.PB = 0x00;
    this.P = 0x34; // default
    this.PC = 0x0000; this.cycles = 0; this.running = false;
  }

  reset() {
    const lo = this.mem.read8(0x0000);
    const hi = this.mem.read8(0x0001);
    this.PC = (hi << 8) | lo;
    this.cycles = 7;
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
    if (!entry) { console.log(`Unhandled opcode 0x${opcode.toString(16)} at PB=0x${this.PB.toString(16)} PC=0x${(this.PC-1).toString(16)}`); this.running = false; return; }
    const handlerName = entry.handler;
    if (typeof this[handlerName] === 'function') {
      this[handlerName]();
      this.cycles += entry.cycles;
    } else { console.log(`Opcode handler ${handlerName} not implemented`); this.running = false; }
  }

  // Basic handlers
  op_NOP() {}
  op_LDA_imm() { const v = window.Addressing.imm8(this); this.A = v & 0xFF; this.setZN(this.A); }
  op_LDX_imm() { const v = window.Addressing.imm8(this); this.X = v & 0xFF; this.setZN(this.X); }
  op_STA_abs() { const full = window.Addressing.abs(this); this.mem.write8(full, this.A & 0xFF); }
  op_JMP_abs() { const addr16 = window.Addressing.abs16(this); this.PC = addr16 & 0xFFFF; }
  op_BRK() { this.running = false; }
  op_INX() { this.X = (this.X + 1) & 0xFF; this.setZN(this.X); }

  // ALU
  op_ADC_imm() {
    const v = window.Addressing.imm8(this);
    const carry = (this.P & FLAG_C) ? 1 : 0;
    const res = this.A + v + carry;
    // overflow detection for signed 8-bit
    const overflow = (~(this.A ^ v) & (this.A ^ res)) & 0x80;
    if (res > 0xFF) this.P |= FLAG_C; else this.P &= ~FLAG_C;
    if (overflow) this.P |= FLAG_V; else this.P &= ~FLAG_V;
    this.A = res & 0xFF;
    this.setZN(this.A);
  }

  op_AND_imm() { const v = window.Addressing.imm8(this); this.A = (this.A & v) & 0xFF; this.setZN(this.A); }
  op_ORA_imm() { const v = window.Addressing.imm8(this); this.A = (this.A | v) & 0xFF; this.setZN(this.A); }
  op_EOR_imm() { const v = window.Addressing.imm8(this); this.A = (this.A ^ v) & 0xFF; this.setZN(this.A); }

  // Compare A
  op_CMPA_imm() {
    const v = window.Addressing.imm8(this);
    const res = (this.A - v) & 0x1FF; // allow borrow check
    if ((this.A & 0xFF) >= (v & 0xFF)) this.P |= FLAG_C; else this.P &= ~FLAG_C;
    this.setZN(res & 0xFF);
  }

  // Branches
  op_BEQ_rel() {
    const target = window.Addressing.rel(this);
    if (this.P & FLAG_Z) {
      this.PC = target & 0xFFFF;
    }
  }
  op_BNE_rel() {
    const target = window.Addressing.rel(this);
    if (!(this.P & FLAG_Z)) {
      this.PC = target & 0xFFFF;
    }
  }

  setZN(val) {
    if ((val & 0x80) !== 0) this.P |= FLAG_N; else this.P &= ~FLAG_N;
    if ((val & 0xFF) === 0) this.P |= FLAG_Z; else this.P &= ~FLAG_Z;
  }
}

window.CPU65C816 = CPU65C816;
