import { Command } from 'commander';
import { formatToon, checkTwoPhaseConfirm, handleComplexInteraction } from '../utils';

export function registernodeconfigurationsCommand(program: Command) {
  const group = program.command('node-configurations').description("Operations on Node Configurations");

  
  group.command('edit-node')
    .description("Execute edit-node")
    
    .requiredOption('--data <value>', 'Argument data')
    
    .option('--file <path>', 'Provide arguments via JSON/YAML file')
    .option('--json', 'Output raw JSON instead of TOON')
    .action((opts) => {

    if (!opts.file) {
      return handleComplexInteraction('addEditNode');
    }

    // Placeholder for actual HTTP request execution
    const mockResult = { status: 'success', op: 'addEditNode', args: opts };
    if (opts.json) {
      console.log(JSON.stringify(mockResult, null, 2));
    } else {
      console.log(formatToon(mockResult));
      
      // Principle 9: Contextual disclosure (help block)
      console.log('\n--- Next steps ---');
      console.log('Run "<cli> ..." to view related operations.');
    }

    });

  
  group.command('download-node-config')
    .description("Execute download-node-config")
    
    .requiredOption('--data <value>', 'Argument data')
    
    .option('--file <path>', 'Provide arguments via JSON/YAML file')
    .option('--json', 'Output raw JSON instead of TOON')
    .action((opts) => {

    if (!opts.file) {
      return handleComplexInteraction('downloadNodeConfig');
    }

    // Placeholder for actual HTTP request execution
    const mockResult = { status: 'success', op: 'downloadNodeConfig', args: opts };
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
    console.log("Operations on Node Configurations");
    console.log('Run `<cli> node-configurations --help` for available commands.');
  });
}