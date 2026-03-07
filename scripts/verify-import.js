import { pathToFileURL } from 'url';
import path from 'path';

const commandPath = path.resolve('src/commands/roles/reactionrole.js');
const commandUrl = pathToFileURL(commandPath).href;

console.log(`Attempting to import: ${commandUrl}`);

try {
    const command = await import(commandUrl);
    console.log('Import successful!');
    console.log('Has data?', !!command.data);
    console.log('Has execute?', !!command.execute);

    // Check database exports if possible, but reactionrole.js already imports them.
    // If imports inside reactionrole.js failed, this import would throw.

} catch (error) {
    console.error('Import failed:', error);
}
