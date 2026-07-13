import { Command } from 'commander';
import { formatToon, checkTwoPhaseConfirm, handleComplexInteraction } from '../utils';

export function registerorganizationcataloguesCommand(program: Command) {
  const group = program.command('organization---catalogues').description("Operations on Organization & Catalogues");

  
  group.command('all-organization')
    .description("Execute all-organization")
    
    .requiredOption('--filterModel <value>', 'Argument filterModel')
    
    .option('--file <path>', 'Provide arguments via JSON/YAML file')
    .option('--json', 'Output raw JSON instead of TOON')
    .action((opts) => {

    if (!opts.file) {
      return handleComplexInteraction('getAllOrganizationList');
    }

    // Placeholder for actual HTTP request execution
    const mockResult = { status: 'success', op: 'getAllOrganizationList', args: opts };
    if (opts.json) {
      console.log(JSON.stringify(mockResult, null, 2));
    } else {
      console.log(formatToon(mockResult));
      
      // Principle 9: Contextual disclosure (help block)
      console.log('\n--- Next steps ---');
      console.log('Run "<cli> ..." to view related operations.');
    }

    });

  
  group.command('catelogue-category')
    .description("Execute catelogue-category")
    
    .requiredOption('--data <value>', 'Argument data')
    .requiredOption('--filterModel <value>', 'Argument filterModel')
    
    .option('--file <path>', 'Provide arguments via JSON/YAML file')
    .option('--json', 'Output raw JSON instead of TOON')
    .action((opts) => {

    if (!opts.file) {
      return handleComplexInteraction('getCatelogueCategory');
    }

    // Placeholder for actual HTTP request execution
    const mockResult = { status: 'success', op: 'getCatelogueCategory', args: opts };
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
    console.log("Operations on Organization & Catalogues");
    console.log('Run `<cli> organization---catalogues --help` for available commands.');
  });
}