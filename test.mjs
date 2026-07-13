import { execSync } from 'child_process';
const start = Date.now();
try {
  execSync('node -e "setTimeout(() => {}, 2000)"', { timeout: 8000 });
  console.log('Success in', Date.now() - start, 'ms');
} catch (e) {
  console.error('Error in', Date.now() - start, 'ms:', e.message);
}
