import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
const root=resolve('dist');
http.createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+'\\') && !path.startsWith(root+'/') && path!==root)throw Error();const file=path===root?resolve(root,'index.html'):path;res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}}).listen(Number(process.env.SHELLIFY_PORT||4173),'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
