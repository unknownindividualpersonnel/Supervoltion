// Expanded opcode table for more 6502/65C816 instructions (subset)
// Each entry maps opcode byte to handler name and cycles (cycles approximate)
const Opcodes = {
  table: {
    // Implied / single-byte
    0xEA: { mnemonic: 'NOP', handler: 'op_NOP', cycles: 2 },
    0x00: { mnemonic: 'BRK', handler: 'op_BRK', cycles: 7 },
    0x40: { mnemonic: 'RTI', handler: 'op_RTI', cycles: 6 },
    0x60: { mnemonic: 'RTS', handler: 'op_RTS', cycles: 6 },

    // Loads: A
    0xA9: { mnemonic: 'LDA', handler: 'op_LDA_imm', cycles: 2 },
    0xA5: { mnemonic: 'LDA', handler: 'op_LDA_zp', cycles: 3 },
    0xB5: { mnemonic: 'LDA', handler: 'op_LDA_zpX', cycles: 4 },
    0xAD: { mnemonic: 'LDA', handler: 'op_LDA_abs', cycles: 4 },
    0xBD: { mnemonic: 'LDA', handler: 'op_LDA_absX', cycles: 4 },
    0xB9: { mnemonic: 'LDA', handler: 'op_LDA_absY', cycles: 4 },

    // Loads: X
    0xA2: { mnemonic: 'LDX', handler: 'op_LDX_imm', cycles: 2 },
    0xA6: { mnemonic: 'LDX', handler: 'op_LDX_zp', cycles: 3 },
    0xB6: { mnemonic: 'LDX', handler: 'op_LDX_zpY', cycles: 4 },
    0xAE: { mnemonic: 'LDX', handler: 'op_LDX_abs', cycles: 4 },
    0xBE: { mnemonic: 'LDX', handler: 'op_LDX_absY', cycles: 4 },

    // Stores
    0x85: { mnemonic: 'STA', handler: 'op_STA_zp', cycles: 3 },
    0x95: { mnemonic: 'STA', handler: 'op_STA_zpX', cycles: 4 },
    0x8D: { mnemonic: 'STA', handler: 'op_STA_abs', cycles: 4 },
    0x9D: { mnemonic: 'STA', handler: 'op_STA_absX', cycles: 5 },
    0x99: { mnemonic: 'STA', handler: 'op_STA_absY', cycles: 5 },

    // Arithmetic
    0x69: { mnemonic: 'ADC', handler: 'op_ADC_imm', cycles: 2 },
    0x65: { mnemonic: 'ADC', handler: 'op_ADC_zp', cycles: 3 },
    0x75: { mnemonic: 'ADC', handler: 'op_ADC_zpX', cycles: 4 },
    0x6D: { mnemonic: 'ADC', handler: 'op_ADC_abs', cycles: 4 },
    0x7D: { mnemonic: 'ADC', handler: 'op_ADC_absX', cycles: 4 },
    0x79: { mnemonic: 'ADC', handler: 'op_ADC_absY', cycles: 4 },
    0xE9: { mnemonic: 'SBC', handler: 'op_SBC_imm', cycles: 2 },

    // Logic
    0x29: { mnemonic: 'AND', handler: 'op_AND_imm', cycles: 2 },
    0x09: { mnemonic: 'ORA', handler: 'op_ORA_imm', cycles: 2 },
    0x49: { mnemonic: 'EOR', handler: 'op_EOR_imm', cycles: 2 },

    // Compare
    0xC9: { mnemonic: 'CMP', handler: 'op_CMPA_imm', cycles: 2 },

    // Branches
    0xF0: { mnemonic: 'BEQ', handler: 'op_BEQ_rel', cycles: 2 },
    0xD0: { mnemonic: 'BNE', handler: 'op_BNE_rel', cycles: 2 },
    0x10: { mnemonic: 'BPL', handler: 'op_BPL_rel', cycles: 2 },
    0x30: { mnemonic: 'BMI', handler: 'op_BMI_rel', cycles: 2 },

    // Shifts/rotates
    0x0A: { mnemonic: 'ASL', handler: 'op_ASL_acc', cycles: 2 },
    0x4A: { mnemonic: 'LSR', handler: 'op_LSR_acc', cycles: 2 },
    0x2A: { mnemonic: 'ROL', handler: 'op_ROL_acc', cycles: 2 },
    0x6A: { mnemonic: 'ROR', handler: 'op_ROR_acc', cycles: 2 },
    0x0E: { mnemonic: 'ASL', handler: 'op_ASL_abs', cycles: 6 },
    0x4E: { mnemonic: 'LSR', handler: 'op_LSR_abs', cycles: 6 },

    // Inc/Dec
    0xE8: { mnemonic: 'INX', handler: 'op_INX', cycles: 2 },
    0xC8: { mnemonic: 'INY', handler: 'op_INY', cycles: 2 },
    0xEE: { mnemonic: 'INC', handler: 'op_INC_abs', cycles: 6 },
    0xCE: { mnemonic: 'DEC', handler: 'op_DEC_abs', cycles: 6 },

    // Stack ops
    0x48: { mnemonic: 'PHA', handler: 'op_PHA', cycles: 3 },
    0x68: { mnemonic: 'PLA', handler: 'op_PLA', cycles: 4 },
    0x08: { mnemonic: 'PHP', handler: 'op_PHP', cycles: 3 },
    0x28: { mnemonic: 'PLP', handler: 'op_PLP', cycles: 4 }
  },
  lookup(opcode) { return this.table[opcode] || null; }
};

window.Opcodes = Opcodes;
