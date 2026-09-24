import {cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await cp('public','dist',{recursive:true});
console.log('Static assets built. Vercel serves api/search.js as a Node function.');
