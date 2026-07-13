import { Command } from 'commander';
import { formatToon, checkTwoPhaseConfirm, handleComplexInteraction } from '../utils';

export function registeriec104sCommand(program: Command) {
  const group = program.command('iec-104s').description("Operations on Iec 104s");

  
  group.command('iec104-hierarchy')
    .description("Execute iec104-hierarchy")
    
    .requiredOption('--data <value>', 'Argument data')
    
    .option('--file <path>', 'Provide arguments via JSON/YAML file')
    .option('--json', 'Output raw JSON instead of TOON')
    .action((opts) => {

    if (!opts.file) {
      return handleComplexInteraction('getIec104Hierarchy');
    }

    // Placeholder for actual HTTP request execution
    const mockResult = { status: 'success', op: 'getIec104Hierarchy', args: opts };
    if (opts.json) {
      console.log(JSON.stringify(mockResult, null, 2));
    } else {
      console.log(formatToon(mockResult));
      
      // Principle 9: Contextual disclosure (help block)
      console.log('\n--- Next steps ---');
      console.log('Run "<cli> ..." to view related operations.');
    }

    });

  
  group.command('iec104-data-source')
    .description("Execute iec104-data-source")
    
    .requiredOption('--action <value>', 'Argument action')
    .requiredOption('--id <value>', 'Argument id')
    .requiredOption('--orgId <value>', 'Argument orgId')
    .requiredOption('--purpose <value>', 'Argument purpose')
    .requiredOption('--Reference <value>', 'Argument Reference')
    .option('--force', 'Bypass two-phase confirmation')
    .option('--file <path>', 'Provide arguments via JSON/YAML file')
    .option('--json', 'Output raw JSON instead of TOON')
    .action((opts) => {
    checkTwoPhaseConfirm('removeIEC104DataSource', !!opts.force);

    if (!opts.file && Object.keys(opts).length === 0) {
      console.log('Interactive wizard placeholder for removeIEC104DataSource...');
      // AXI real implementation would prompt here
    }

    // Placeholder for actual HTTP request execution
    const mockResult = { status: 'success', op: 'removeIEC104DataSource', args: opts };
    if (opts.json) {
      console.log(JSON.stringify(mockResult, null, 2));
    } else {
      console.log(formatToon(mockResult));
      
      // Principle 9: Contextual disclosure (help block)
      console.log('\n--- Next steps ---');
      console.log('Run "<cli> ..." to view related operations.');
    }

    });
  
  // Principle 8: No args -> live top-level data
  group.action(() => {
    console.log("Operations on Iec 104s");
    console.log('Run `<cli> iec-104s --help` for available commands.');
  });
}