import '@backstage/cli/asset-types';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@backstage/ui/css/styles.css';

// Backstage uses crypto.randomUUID in the browser. It is unavailable on an
// insecure public origin, while getRandomValues remains available.
if (globalThis.crypto && !globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => {
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      return Array.from(bytes, byte => byte.toString(16).padStart(2, '0'))
        .join('')
        .replace(
          /^(........)(....)(....)(....)(............)$/,
          '$1-$2-$3-$4-$5',
        );
    },
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(App.createRoot());
