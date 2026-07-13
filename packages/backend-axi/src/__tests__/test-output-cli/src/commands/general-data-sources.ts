import { Command } from 'commander';
import { formatToon, checkTwoPhaseConfirm, handleComplexInteraction } from '../utils';

export function registergeneraldatasourcesCommand(program: Command) {
  const group = program.command('general-data-sources').description("Operations on General Data Sources");

  
  group.command('edit-data-source')
    .description("Execute edit-data-source")
    
    .requiredOption('--filterModel <value>', 'Argument filterModel')
    
    .option('--file <path>', 'Provide arguments via JSON/YAML file')
    .option('--json', 'Output raw JSON instead of TOON')
    .action((opts) => {

    if (!opts.file) {
      return handleComplexInteraction('addEditDataSource');
    }

    // Placeholder for actual HTTP request execution
    const mockResult = { status: 'success', op: 'addEditDataSource', args: opts };
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
    console.log("Operations on General Data Sources");
    console.log('Run `<cli> general-data-sources --help` for available commands.');
  });
}