import {exportProject,importProject,MAX_PROJECT_BYTES} from './projects.js';

export const MAX_SHARE_HASH_LENGTH=16384;
const prefix='#share=';
const tooLarge=()=>Error('Share link is too large. Export a .shellify.json project instead (16 KB link / 1 MB project limit).');
function requireCompression(){
  if(typeof CompressionStream!=='function'||typeof DecompressionStream!=='function')throw Error('Share links require a browser with CompressionStream support. Use a project file instead.');
}
async function readLimited(stream,limit){
  const reader=stream.getReader(),chunks=[];let size=0;
  try{
    while(true){
      const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>limit){await reader.cancel();throw tooLarge();}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
}
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');

export async function createShareHash(workspace){
  requireCompression();
  const source=exportProject(workspace),bytes=new TextEncoder().encode(source);
  if(bytes.length>MAX_PROJECT_BYTES)throw tooLarge();
  // Use the same validation gate as imported project files before sharing.
  importProject(source);
  const compressed=await readLimited(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate')),MAX_SHARE_HASH_LENGTH);
  const hash=prefix+encode(compressed);
  if(hash.length>MAX_SHARE_HASH_LENGTH)throw tooLarge();
  return hash;
}

export async function restoreShareHash(hash){
  if(hash.length>MAX_SHARE_HASH_LENGTH)throw tooLarge();
  if(!hash.startsWith(prefix))throw Error('Invalid share link: expected a Shellify project link.');
  const payload=hash.slice(prefix.length);
  if(!/^[A-Za-z0-9_-]+$/.test(payload)||payload.length%4===1)throw Error('Invalid share link: malformed base64url data.');
  requireCompression();
  try{
    const bytes=Uint8Array.from(atob(payload.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-payload.length%4)%4)),c=>c.charCodeAt(0));
    if(encode(bytes)!==payload)throw Error('Malformed base64url data.');
    const source=await readLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')),MAX_PROJECT_BYTES);
    return importProject(new TextDecoder('utf-8',{fatal:true}).decode(source));
  }catch(error){
    if(error.message.startsWith('Share link is too large'))throw error;
    throw Error('Invalid share link: the compressed project is corrupt or failed project validation.');
  }
}
