// Small CPU test suite for the subset implemented so far
const CpuTests = {
  runAll(outputCallback) {
    const log = (s) => {
      if (outputCallback) outputCallback(s + '\n');
      else console.log(s);
    };

    // Test 1: LDA immediate and STA absolute
    (function(){
      const mem = new Memory();
      const cpu = new CPU65C816(mem);
      // program at 0x0100: LDA #$42 ; STA $6000 ; BRK
      const prog = [0xA9, 0x42, 0x8D, 0x00, 0x60, 0x00];
      mem.loadAt(0x0100, new Uint8Array(prog));
      mem.write16(0x0000, 0x0100);
      cpu.PC = 0x0100;
      cpu.PB = 0x00; cpu.DB = 0x00;
      cpu.step(); // LDA
      cpu.step(); // STA
      if (mem.read8(0x006000) === 0x42) {
        log('Test 1 passed: LDA/STA basic');
      } else {
        log('Test 1 FAILED: STA did not write expected value');
      }
    })();

    // Test 2: INX and flags
    (function(){
      const mem = new Memory();
      const cpu = new CPU65C816(mem);
      const prog = [0xA2, 0xFF, 0xE8, 0xE8, 0x00]; // LDX #$FF ; INX ; INX ; BRK
      mem.loadAt(0x0200, new Uint8Array(prog));
      mem.write16(0x0000, 0x0200);
      cpu.PC = 0x0200; cpu.PB = 0x00; cpu.DB = 0x00;
      cpu.step(); // LDX
      cpu.step(); // INX -> 0x00, Z should be set
      const zSet = (cpu.P & 0x02) !== 0;
      cpu.step(); // INX -> 0x01
      if (zSet && cpu.X === 1) {
        log('Test 2 passed: INX and Z flag behavior');
      } else {
        log('Test 2 FAILED: INX or Z flag incorrect');
      }
    })();

    log('CPU tests completed');
  }
};

window.CpuTests = CpuTests;
