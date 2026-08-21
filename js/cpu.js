// CPU improvements: more opcode handlers and addressing usage
const FLAG_C = 0x01; const FLAG_Z = 0x02; const FLAG_I = 0x04; const FLAG_D = 0x08; const FLAG_X = 0x10; const FLAG_M = 0x20; const FLAG_V = 0x40; const FLAG_N = 0x80;

class CPU65C816 {
  constructor(memory) {
    this.mem = memory; this.A = 0; this.X = 0; this.Y = 0; this.SP = 0x01FF; this.D = 0x0000; this.DB = 0x00; this.PB = 0x00; this.P = 0x34; this.PC = 0x0000; this.cycles = 0; this.running = false; this.pendingNMI = false; this.pendingIRQ = false; this.vblank = false;
  }

  reset() { const lo = this.mem.read8(0x0000); const hi = this.mem.read8(0x0001); this.PC = (hi<<8)|lo; this.cycles = 7; }

  push8(val) { const addr = (this.SP & 0xFFFF); this.mem.write8(addr, val & 0xFF); this.SP = (this.SP - 1) & 0xFFFF; }
  push16(val) { this.push8((val>>>8)&0xFF); this.push8(val&0xFF); }
  pull8() { this.SP = (this.SP + 1) & 0xFFFF; const addr = (this.SP & 0xFFFF); return this.mem.read8(addr); }
  pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi<<8); }

  fetch8() { const addr = (this.PB << 16) | (this.PC & 0xFFFF); const v = this.mem.read8(addr); this.PC = (this.PC + 1) & 0xFFFF; return v; }
  fetch16() { const lo = this.fetch8(); const hi = this.fetch8(); return lo | (hi<<8); }

  step() {
    if (this.pendingNMI) { this._enterNMI(); this.pendingNMI = false; }
    if (this.pendingIRQ && !(this.P & FLAG_I)) { this._enterIRQ(); this.pendingIRQ = false; }
    const opcode = this.fetch8(); const entry = window.Opcodes.lookup(opcode);
    if (!entry) { console.log(`Unhandled opcode 0x${opcode.toString(16)} at PB=0x${this.PB.toString(16)} PC=0x${(this.PC-1).toString(16)}`); this.running=false; return; }
    const h = entry.handler; if (typeof this[h] === 'function') { this[h](); this.cycles += entry.cycles; } else { console.log(`Missing handler ${h}`); this.running=false; }
  }

  _enterNMI() { const pc = this.PC & 0xFFFF; this.push16(pc); this.push8(this.P); const lo = this.mem.read8(0xFFFA); const hi = this.mem.read8(0xFFFB); this.PC = (hi<<8)|lo; this.P &= ~FLAG_D; this.P |= FLAG_I; console.log('NMI enter ->', this.PC.toString(16)); }
  _enterIRQ() { const pc = this.PC & 0xFFFF; this.push16(pc); this.push8(this.P); const lo = this.mem.read8(0xFFFE); const hi = this.mem.read8(0xFFFF); this.PC = (hi<<8)|lo; this.P |= FLAG_I; console.log('IRQ enter ->', this.PC.toString(16)); }

  // Handlers
  op_NOP() {}
  op_BRK() { this.running=false; }
  op_RTI() { this.P = this.pull8(); this.PC = this.pull16(); }
  op_RTS() { const ret = this.pull16(); this.PC = (ret + 1) & 0xFFFF; }

  // Loads
  op_LDA_imm() { const v = window.Addressing.imm8(this); this.A = v & 0xFF; this.setZN(this.A); }
  op_LDA_zp() { const addr = window.Addressing.zp(this); this.A = this.mem.read8(addr); this.setZN(this.A); }
  op_LDA_zpX() { const addr = window.Addressing.zpX(this); this.A = this.mem.read8(addr); this.setZN(this.A); }
  op_LDA_abs() { const addr = window.Addressing.abs(this); this.A = this.mem.read8(addr); this.setZN(this.A); }
  op_LDA_absX() { const addr = window.Addressing.absX(this); this.A = this.mem.read8(addr); this.setZN(this.A); }
  op_LDA_absY() { const addr = window.Addressing.absY(this); this.A = this.mem.read8(addr); this.setZN(this.A); }

  op_LDX_imm() { const v = window.Addressing.imm8(this); this.X = v & 0xFF; this.setZN(this.X); }
  op_LDX_zp() { const a = window.Addressing.zp(this); this.X = this.mem.read8(a); this.setZN(this.X); }
  op_LDX_zpY() { const a = window.Addressing.zpY(this); this.X = this.mem.read8(a); this.setZN(this.X); }
  op_LDX_abs() { const a = window.Addressing.abs(this); this.X = this.mem.read8(a); this.setZN(this.X); }
  op_LDX_absY() { const a = window.Addressing.absY(this); this.X = this.mem.read8(a); this.setZN(this.X); }

  // Stores
  op_STA_zp() { const addr = window.Addressing.zp(this); this.mem.write8(addr, this.A & 0xFF); }
  op_STA_zpX() { const addr = window.Addressing.zpX(this); this.mem.write8(addr, this.A & 0xFF); }
  op_STA_abs() { const addr = window.Addressing.abs(this); this.mem.write8(addr, this.A & 0xFF); }
  op_STA_absX() { const addr = window.Addressing.absX(this); this.mem.write8(addr, this.A & 0xFF); }
  op_STA_absY() { const addr = window.Addressing.absY(this); this.mem.write8(addr, this.A & 0xFF); }

  // Arithmetic
  op_ADC_imm() { const v = window.Addressing.imm8(this); const carry = (this.P & FLAG_C)?1:0; const res = this.A + v + carry; const overflow = (~(this.A ^ v) & (this.A ^ res)) & 0x80; if (res > 0xFF) this.P |= FLAG_C; else this.P &= ~FLAG_C; if (overflow) this.P |= FLAG_V; else this.P &= ~FLAG_V; this.A = res & 0xFF; this.setZN(this.A); }
  op_ADC_zp() { const addr = window.Addressing.zp(this); const v = this.mem.read8(addr); this._adc(v); }
  op_ADC_abs() { const addr = window.Addressing.abs(this); const v = this.mem.read8(addr); this._adc(v); }
  op_ADC_absX() { const addr = window.Addressing.absX(this); const v = this.mem.read8(addr); this._adc(v); }
  op_ADC_absY() { const addr = window.Addressing.absY(this); const v = this.mem.read8(addr); this._adc(v); }
  _adc(v) { const carry = (this.P & FLAG_C)?1:0; const res = this.A + v + carry; const overflow = (~(this.A ^ v) & (this.A ^ res)) & 0x80; if (res > 0xFF) this.P |= FLAG_C; else this.P &= ~FLAG_C; if (overflow) this.P |= FLAG_V; else this.P &= ~FLAG_V; this.A = res & 0xFF; this.setZN(this.A); }
  op_SBC_imm() { const v = window.Addressing.imm8(this); const carry = (this.P & FLAG_C)?1:0; // SBC = A - v - (1-C)
    const borrow = (this.A - v - (1 - carry)); // signed calc
    if (borrow >= 0) this.P |= FLAG_C; else this.P &= ~FLAG_C; // set carry if no borrow
    // overflow detection
    const overflow = ((this.A ^ v) & (this.A ^ borrow)) & 0x80; if (overflow) this.P |= FLAG_V; else this.P &= ~FLAG_V; this.A = borrow & 0xFF; this.setZN(this.A);
  }

  // Logic
  op_AND_imm() { const v = window.Addressing.imm8(this); this.A &= v; this.A &= 0xFF; this.setZN(this.A); }
  op_ORA_imm() { const v = window.Addressing.imm8(this); this.A |= v; this.A &= 0xFF; this.setZN(this.A); }
  op_EOR_imm() { const v = window.Addressing.imm8(this); this.A ^= v; this.A &= 0xFF; this.setZN(this.A); }

  // Compare A
  op_CMPA_imm() { const v = window.Addressing.imm8(this); const res = (this.A - v) & 0x1FF; if ((this.A & 0xFF) >= (v & 0xFF)) this.P |= FLAG_C; else this.P &= ~FLAG_C; this.setZN(res & 0xFF); }

  // Branches
  op_BEQ_rel() { const t = window.Addressing.rel(this); if (this.P & FLAG_Z) this.PC = t & 0xFFFF; }
  op_BNE_rel() { const t = window.Addressing.rel(this); if (!(this.P & FLAG_Z)) this.PC = t & 0xFFFF; }
  op_BPL_rel() { const t = window.Addressing.rel(this); if (!(this.P & FLAG_N)) this.PC = t & 0xFFFF; }
  op_BMI_rel() { const t = window.Addressing.rel(this); if (this.P & FLAG_N) this.PC = t & 0xFFFF; }

  // Shifts/rotates (accumulator)
  op_ASL_acc() { const carry = (this.A & 0x80) ? 1 : 0; this.A = (this.A << 1) & 0xFF; this.P = (this.P & ~FLAG_C) | (carry ? FLAG_C : 0); this.setZN(this.A); }
  op_LSR_acc() { const carry = (this.A & 0x01) ? 1 : 0; this.A = (this.A >>> 1) & 0xFF; this.P = (this.P & ~FLAG_C) | (carry ? FLAG_C : 0); this.setZN(this.A); }
  op_ROL_acc() { const oldC = (this.P & FLAG_C) ? 1 : 0; const newC = (this.A & 0x80) ? 1 : 0; this.A = ((this.A << 1) & 0xFF) | oldC; this.P = (this.P & ~FLAG_C) | (newC ? FLAG_C : 0); this.setZN(this.A); }
  op_ROR_acc() { const oldC = (this.P & FLAG_C) ? 1 : 0; const newC = (this.A & 0x01) ? 1 : 0; this.A = ((oldC << 7) | (this.A >>> 1)) & 0xFF; this.P = (this.P & ~FLAG_C) | (newC ? FLAG_C : 0); this.setZN(this.A); }
  op_ASL_abs() { const a = window.Addressing.abs(this); let v = this.mem.read8(a); const carry = (v & 0x80) ? 1 : 0; v = (v << 1) & 0xFF; this.mem.write8(a, v); this.P = (this.P & ~FLAG_C) | (carry?FLAG_C:0); this.setZN(v); }
  op_LSR_abs() { const a = window.Addressing.abs(this); let v = this.mem.read8(a); const carry = (v & 0x01)?1:0; v = (v >>> 1) & 0xFF; this.mem.write8(a, v); this.P = (this.P & ~FLAG_C)|(carry?FLAG_C:0); this.setZN(v); }

  // Inc/Dec
  op_INX() { this.X = (this.X + 1) & 0xFF; this.setZN(this.X); }
  op_INY() { this.Y = (this.Y + 1) & 0xFF; this.setZN(this.Y); }
  op_INC_abs() { const a = window.Addressing.abs(this); const v = (this.mem.read8(a) + 1) & 0xFF; this.mem.write8(a, v); this.setZN(v); }
  op_DEC_abs() { const a = window.Addressing.abs(this); const v = (this.mem.read8(a) - 1) & 0xFF; this.mem.write8(a, v); this.setZN(v); }

  // Stack ops
  op_PHA() { this.push8(this.A & 0xFF); }
  op_PLA() { this.A = this.pull8() & 0xFF; this.setZN(this.A); }
  op_PHP() { this.push8(this.P & 0xFF); }
  op_PLP() { this.P = this.pull8() & 0xFF; }

  setZN(val) { if ((val & 0x80)!==0) this.P |= FLAG_N; else this.P &= ~FLAG_N; if ((val & 0xFF)===0) this.P |= FLAG_Z; else this.P &= ~FLAG_Z; }
}

window.CPU65C816 = CPU65C816;
