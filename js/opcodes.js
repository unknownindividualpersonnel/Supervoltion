// Extend opcode table with more ALU and branch instructions
const Opcodes = {
  table: {
    0xEA: { mnemonic: 'NOP', mode: null, cycles: 2, handler: 'op_NOP' },
    0xA9: { mnemonic: 'LDA', mode: 'imm8', cycles: 2, handler: 'op_LDA_imm' },
    0xA2: { mnemonic: 'LDX', mode: 'imm8', cycles: 2, handler: 'op_LDX_imm' },
    0x8D: { mnemonic: 'STA', mode: 'abs', cycles: 4, handler: 'op_STA_abs' },
    0x4C: { mnemonic: 'JMP', mode: 'abs16', cycles: 3, handler: 'op_JMP_abs' },
    0x00: { mnemonic: 'BRK', mode: null, cycles: 7, handler: 'op_BRK' },
    0xE8: { mnemonic: 'INX', mode: null, cycles: 2, handler: 'op_INX' },

    // ALU
    0x69: { mnemonic: 'ADC', mode: 'imm8', cycles: 2, handler: 'op_ADC_imm' },
    0x29: { mnemonic: 'AND', mode: 'imm8', cycles: 2, handler: 'op_AND_imm' },
    0x09: { mnemonic: 'ORA', mode: 'imm8', cycles: 2, handler: 'op_ORA_imm' },
    0x49: { mnemonic: 'EOR', mode: 'imm8', cycles: 2, handler: 'op_EOR_imm' },

    // Compare
    0xC9: { mnemonic: 'CMP', mode: 'imm8', cycles: 2, handler: 'op_CMPA_imm' },

    // Branches
    0xF0: { mnemonic: 'BEQ', mode: 'rel', cycles: 2, handler: 'op_BEQ_rel' },
    0xD0: { mnemonic: 'BNE', mode: 'rel', cycles: 2, handler: 'op_BNE_rel' }
  },
  lookup(opcode) { return this.table[opcode] || null; }
};

window.Opcodes = Opcodes;
