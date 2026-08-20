// Minimal opcode table for subset of instructions
// Each entry: {mnemonic, mode, cycles, handler}
// mode is a string key for Addressing helper when applicable

const Opcodes = {
  table: {
    0xEA: { mnemonic: 'NOP', mode: null, cycles: 2, handler: 'op_NOP' },
    0xA9: { mnemonic: 'LDA', mode: 'imm8', cycles: 2, handler: 'op_LDA_imm' },
    0xA2: { mnemonic: 'LDX', mode: 'imm8', cycles: 2, handler: 'op_LDX_imm' },
    0x8D: { mnemonic: 'STA', mode: 'abs', cycles: 4, handler: 'op_STA_abs' },
    0x4C: { mnemonic: 'JMP', mode: 'abs16', cycles: 3, handler: 'op_JMP_abs' },
    0x00: { mnemonic: 'BRK', mode: null, cycles: 7, handler: 'op_BRK' },
    0xE8: { mnemonic: 'INX', mode: null, cycles: 2, handler: 'op_INX' }
  },
  lookup(opcode) {
    return this.table[opcode] || null;
  }
};

window.Opcodes = Opcodes;
