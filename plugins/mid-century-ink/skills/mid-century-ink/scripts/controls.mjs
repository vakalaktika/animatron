#!/usr/bin/env node
// Portable controls use the very same application importer and evaluator as Composer.
import { runMotionCommand } from './motion-program.mjs';
try {
 const result = runMotionCommand(process.argv.slice(2), 'rig');
 console.log(`Wrote ${result.output}: Rig 4; ${result.controllers} controllers; ${result.constraints} constraints; ${result.sampleCount} evaluated times. ${result.notes.join(' ')}`);
} catch (error) { console.error(`controls: ${error.message}`); process.exitCode = 1; }
